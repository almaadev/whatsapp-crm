import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Message from "@/shared/models/Message";
import Lead from "@/shared/models/Lead";
import redis from "@/shared/lib/db/redis";
import Activity from "@/shared/models/Activity";
import { serverCustomerService } from "@/server/services/serverCustomerService";
import { sanitizeChatList } from "@/shared/utils/privacy";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { normalizePhone, getPhoneVariations } from "@/shared/utils/phoneUtils";

const REDIS_CACHE_TTL = 30;

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    if (redis && redis.status === "ready") {
      try {
        const cachedData = await redis.get("chats:main_inbox_data");
        if (cachedData) {
          const rawChats = JSON.parse(cachedData);
          const sanitizedChats = sanitizeChatList(rawChats, session.user);
          return NextResponse.json(sanitizedChats);
        }
      } catch (e) {}
    }

    await connectDB();

    const { getBranchFilterForUser } = await import("@/shared/utils/serverAuth");
    const { branchQuery } = await getBranchFilterForUser(session);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const customers = await Customer.find(branchQuery)
      .populate("currentAddressId")
      .lean();

    const inboxCustomers = customers.filter(
      (c) => !c.activeRouteCategory || c.activeRouteCategory === "Direct Lead"
    );

    // Collect all phone variations for inbox customers to fetch complete message history
    const allSearchPhones = new Set();
    inboxCustomers.forEach((c) => {
      if (c.phone) {
        const vars = getPhoneVariations(c.phone);
        vars.forEach((v) => allSearchPhones.add(v));
      }
    });
    const searchPhones = Array.from(allSearchPhones);

    // Fetch messages for allowed inbox customers in the last 60 days
    let msgs = [];
    if (searchPhones.length > 0) {
      try {
        msgs = await Message.find({ 
          phone: { $in: searchPhones },
          timestamp: { $gte: sixtyDaysAgo },
          chatType: { $in: ["Direct Lead", null, undefined] }
        })
          .populate({ path: "sendBy", select: "name" })
          .lean();
      } catch (populateErr) {
        console.error("[GET /api/chats] sendBy populate failed, using fallback:", populateErr.message);
        msgs = await Message.find({ 
          phone: { $in: searchPhones },
          timestamp: { $gte: sixtyDaysAgo },
          chatType: { $in: ["Direct Lead", null, undefined] }
        }).lean();
      }
    }

    // Group messages by canonical phone identity
    const msgsByCanonicalPhone = new Map();
    msgs.forEach((m) => {
      const norm = normalizePhone(m.phone);
      if (!norm) return;
      if (!msgsByCanonicalPhone.has(norm)) {
        msgsByCanonicalPhone.set(norm, []);
      }
      msgsByCanonicalPhone.get(norm).push(m);
    });

    const Branch = (await import("@/shared/models/Branch")).default;
    const branches = await Branch.find().select("name code").lean();
    const branchMap = {};
    branches.forEach((b) => {
      branchMap[b._id.toString()] = { name: b.name, code: b.code || "" };
    });

    // Fetch latest activities to resolve lastHandled info
    const latestActivities = await Activity.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$customerId", latest: { $first: "$$ROOT" } } },
      {
        $lookup: {
          from: "users",
          localField: "latest.actorId",
          foreignField: "_id",
          as: "actor"
        }
      },
      { $unwind: { path: "$actor", preserveNullAndEmptyArrays: true } }
    ]);
    const lastHandledMap = new Map();
    latestActivities.forEach(act => {
      if (act.actor) {
        lastHandledMap.set(act._id.toString(), {
          name: act.actor.name || "Unknown",
          role: act.actor.role || "",
          department: act.actor.department || "",
          userId: act.actor._id ? act.actor._id.toString() : ""
        });
      }
    });

    // Build conversation structures and deduplicate per customer
    const chats = [];
    const seenCustomers = new Set();

    for (const c of inboxCustomers) {
      const custId = c._id.toString();
      const normPhone = normalizePhone(c.phone);

      // Deduplicate by customerId or canonical phone
      if (seenCustomers.has(custId) || (normPhone && seenCustomers.has(normPhone))) {
        continue;
      }
      seenCustomers.add(custId);
      if (normPhone) seenCustomers.add(normPhone);

      const lastHandled = lastHandledMap.get(custId) || null;
      const bId = c.branchId ? (c.branchId._id ? c.branchId._id.toString() : c.branchId.toString()) : null;
      const bObj = bId && branchMap[bId] ? branchMap[bId] : null;

      const customerMsgs = (normPhone ? msgsByCanonicalPhone.get(normPhone) : null) || [];
      customerMsgs.sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0));

      const latestMsg = customerMsgs.length > 0 ? customerMsgs[customerMsgs.length - 1] : null;

      let msgText = latestMsg ? (latestMsg.message || "") : "";
      if (!msgText && latestMsg && latestMsg.mediaUrl) {
        if (latestMsg.mediaType?.includes("video")) msgText = "🎥 Video";
        else if (latestMsg.mediaType?.includes("audio")) msgText = "🎵 Audio";
        else if (latestMsg.mediaType?.includes("pdf") || latestMsg.mediaType?.includes("document")) msgText = "📄 Document";
        else msgText = "📷 Photo";
      }

      const resolvedName = resolveCustomerDisplayName({
        phone: c.phone,
        customerName: c.name,
        name: c.name,
        senderName: latestMsg ? (latestMsg.senderName || latestMsg.profileName) : ""
      });

      chats.push({
        customerId: custId,
        phone: c.phone,
        canonicalPhone: normPhone || c.phone,
        name: resolvedName,
        message: msgText,
        direction: latestMsg ? latestMsg.direction : "INBOUND",
        city: c.currentAddressId?.city || c.city || "",
        activeRouteCategory: c.activeRouteCategory || "Direct Lead",
        status: c.status || "New",
        priority: c.priority ?? "Medium",
        messageStatus: latestMsg ? (latestMsg.status || "RECEIVED") : "RECEIVED",
        read: latestMsg ? (latestMsg.read || "TRUE") : "TRUE",
        unreadCount: c.unreadCount || 0,
        timestamp: latestMsg ? new Date(latestMsg.timestamp || latestMsg.createdAt).toISOString() : new Date(c.updatedAt || c.createdAt).toISOString(),
        twilioSid: latestMsg ? (latestMsg.twilioSid || "") : "",
        associate: c.assignedTo || "",
        role: "sales",
        isClosed: c.isClosed || false,
        isChatClosed: c.isClosed || false,
        mediaUrl: latestMsg ? (latestMsg.mediaUrl || "") : "",
        lastHandled,
        mediaType: latestMsg ? (latestMsg.mediaType || "") : "",
        lastSeenAt: latestMsg ? new Date(latestMsg.timestamp || latestMsg.createdAt).toISOString() : new Date(c.updatedAt || c.createdAt).toISOString(),
        senderName: latestMsg ? (latestMsg.senderName || latestMsg.associateName || "") : "",
        senderRole: latestMsg ? (latestMsg.role || "") : "",
        sendBy: latestMsg ? latestMsg.sendBy : null,
        branchId: bId,
        branchName: bObj ? bObj.name : "Unassigned Branch",
        branchCode: bObj ? bObj.code : "",
        history: customerMsgs
      });
    }

    const filteredChats = chats.filter((chat) => chat.phone && !chat.phone.includes("whatsapp:+14155238886"));
    filteredChats.sort((a, b) => new Date(b.lastSeenAt || b.timestamp || 0) - new Date(a.lastSeenAt || a.timestamp || 0));

    if (redis && redis.status === "ready")
      await redis.set("chats:main_inbox_data", JSON.stringify(filteredChats), "EX", REDIS_CACHE_TTL);

    const sanitizedChats = sanitizeChatList(filteredChats, session.user);
    return NextResponse.json(sanitizedChats);
  } catch (error) {
    console.error("[GET /api/chats] Unhandled error:", error.message, "\n", error.stack);
    return NextResponse.json({ success: false, message: "Failed to load chats" }, { status: 500 });
  }
}

export async function POST(req) {
  const isoTimestamp = new Date().toISOString();

  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch (authErr) {}

    if (!session && process.env.NODE_ENV !== "test" && process.env.TWILIO_VALIDATE_SIGNATURE !== "false") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    if (!session) {
      session = { user: { id: "test_admin_id", _id: "test_admin_id", name: "System Admin", role: "superAdmin" } };
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid request body — expected JSON" }, { status: 400 });
    }

    const { phone, message, name, role, skipSave, senderNumber, mediaUrl, mediaType, media, messageType, mediaId } = body;
    if (!phone || (!message && !mediaUrl && !mediaId && !media))
      return NextResponse.json({ success: false, message: "Required fields missing: phone and message/mediaUrl" }, { status: 400 });

    await connectDB();
    const Media = (await import("@/shared/models/Media")).default;

    // Step 1: Resolve Media Document from MongoDB if mediaId or media is provided
    let mediaDoc = null;
    const targetMediaId = mediaId || media?.id || media?._id;
    if (targetMediaId) {
      try {
        mediaDoc = await Media.findById(targetMediaId);
      } catch (findErr) {
        console.warn("[POST /api/chats] Media lookup warning:", findErr.message);
      }
    }

    // Determine final permanent secure URL from Media document or payload
    const resolvedMediaUrl = mediaDoc?.secureUrl || mediaDoc?.cloudinaryUrl || mediaUrl || media?.secureUrl || media?.url || "";
    const detectedMsgType = mediaDoc?.mediaType || messageType || (mediaType?.includes("video") ? "video" : mediaType?.includes("audio") ? "audio" : (mediaType?.includes("pdf") || mediaType?.includes("document")) ? "document" : resolvedMediaUrl ? "image" : "text");
    const isPdfDoc = detectedMsgType === "document" || mediaType?.includes("pdf") || media?.mimeType === "application/pdf" || mediaDoc?.mimeType === "application/pdf";

    // Step 2: Pre-flight Media Accessibility Validation (FAIL FAST)
    if (resolvedMediaUrl) {
      if (isPdfDoc) {
        console.log(`[CLOUDINARY PDF SEND]\nresourceType: raw\npublicId: ${mediaDoc?.cloudinaryPublicId || media?.publicId || ""}\nsecureUrl: ${resolvedMediaUrl}`);
      }

      const { validateMediaUrl } = await import("@/server/services/cloudinaryService");
      try {
        await validateMediaUrl(resolvedMediaUrl, mediaDoc?.mimeType || media?.mimeType || mediaType || (isPdfDoc ? "application/pdf" : undefined));
      } catch (valErr) {
        console.error("[POST /api/chats] Media validation failed before Twilio dispatch:", valErr.message);
        return NextResponse.json(
          {
            success: false,
            code: "MEDIA_NOT_ACCESSIBLE",
            error: "MEDIA_NOT_ACCESSIBLE",
            message: `PDF/media could not be sent: ${valErr.message}. If you are on the Cloudinary free plan, please ensure 'PDF and ZIP files delivery' is enabled in Cloudinary Console -> Settings -> Security.`,
          },
          { status: 422 }
        );
      }

      if (isPdfDoc) {
        console.log(`[TWILIO PDF DISPATCH]\nmediaUrl: ${resolvedMediaUrl}\nto: ${phone}`);
      }
    }

    // Step 3: Send via Centralized Twilio Service
    let twilioSid = "sys_msg_" + Date.now();
    let actualSenderNumber = senderNumber;

    try {
      const { sendWhatsAppMessage } = await import("@/features/admin/services/twilioService");
      const sent = await sendWhatsAppMessage(phone, message || "", {
        senderNumber,
        user: session.user,
        mediaUrl: resolvedMediaUrl || null,
      });
      twilioSid = sent.sid;
      actualSenderNumber = sent.senderNumber;
      if (isPdfDoc) {
        console.log(`[TWILIO RESPONSE]\nsid: ${twilioSid}\nstatus: ${sent.status || "sent"}`);
      }
    } catch (twilioErr) {
      // NOTE: On Twilio send failure, DO NOT delete Cloudinary asset or Media document.
      if (isPdfDoc) {
        console.error(`[TWILIO ERROR]\ncode: ${twilioErr.code || "UNKNOWN"}\nmessage: ${twilioErr.message}`);
      } else {
        console.error("[POST /api/chats] Twilio error:", twilioErr.message, { phone, userId: session.user.id });
      }
      return NextResponse.json(
        {
          success: false,
          code: twilioErr.code || "TWILIO_SEND_FAILED",
          message: twilioErr.message || "Twilio failed to dispatch message.",
          mediaId: mediaDoc?._id || null,
          mediaUrl: resolvedMediaUrl || null,
        },
        { status: twilioErr.message?.includes("Forbidden") ? 403 : 400 }
      );
    }

    if (!skipSave) {
      let customerDoc = null;
      try {
        const phoneVariations = getPhoneVariations(phone);
        customerDoc = await Customer.findOne({ phone: { $in: phoneVariations } }).lean();
        if (!customerDoc) {
          const { customer } = await serverCustomerService.updateCustomer(phone, { name: name || phone, status: "New", source: "Whatsapp" }, session);
          customerDoc = customer;
        }
      } catch (customerErr) {
        console.error("[POST /api/chats] Customer upsert error:", customerErr.message, { phone, userId: session.user.id });
      }

      let MsgModel = Message;
      const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

      const rawUserId = session?.user?.id || session?.user?._id;
      const mongooseMod = (await import("mongoose")).default;
      const validUserId = (rawUserId && mongooseMod.Types.ObjectId.isValid(String(rawUserId))) ? String(rawUserId) : null;

      const resolvedDocName = mediaDoc?.originalFilename || media?.originalFileName || media?.originalFilename || media?.filename || (detectedMsgType === "document" ? "document.pdf" : "whatsapp_media");
      const resolvedPublicId = mediaDoc?.cloudinaryPublicId || media?.publicId || media?.cloudinaryPublicId || "";
      const resolvedResourceType = mediaDoc?.cloudinaryResourceType || media?.resourceType || (detectedMsgType === "document" ? "raw" : detectedMsgType === "video" || detectedMsgType === "audio" ? "video" : "image");
      const resolvedMime = mediaDoc?.mimeType || media?.mimeType || mediaType || (detectedMsgType === "document" ? "application/pdf" : "image/jpeg");

      let savedMsgDoc = null;
      try {
        savedMsgDoc = await MsgModel.create({
          phone,
          message: message || "",
          direction: "OUTBOUND",
          status: "SENT",
          twilioSid,
          senderName: name || "Associate",
          senderNumber: actualSenderNumber,
          role: role || session?.user?.role || "associate",
          sendBy: validUserId,
          messageType: detectedMsgType,
          mediaUrl: resolvedMediaUrl || "",
          mediaType: detectedMsgType,
          media: resolvedMediaUrl ? {
            id: mediaDoc?._id || null,
            mediaId: mediaDoc?._id || null,
            url: resolvedMediaUrl,
            secureUrl: resolvedMediaUrl,
            cloudinaryUrl: resolvedMediaUrl,
            publicId: resolvedPublicId,
            cloudinaryPublicId: resolvedPublicId,
            resourceType: resolvedResourceType,
            cloudinaryResourceType: resolvedResourceType,
            folder: mediaDoc?.folder || (detectedMsgType === "document" ? "whatsapp-crm/documents" : detectedMsgType === "video" ? "whatsapp-crm/videos" : detectedMsgType === "audio" ? "whatsapp-crm/audio" : "whatsapp-crm/images"),
            mimeType: resolvedMime,
            fileType: detectedMsgType,
            extension: mediaDoc?.extension || (detectedMsgType === "document" ? ".pdf" : ""),
            originalFileName: resolvedDocName,
            originalFilename: resolvedDocName,
            filename: resolvedDocName,
            fileSize: mediaDoc?.fileSize || media?.fileSize || 0,
            size: mediaDoc?.size || media?.size || media?.fileSize || 0,
            duration: mediaDoc?.duration || media?.duration || 0,
            width: mediaDoc?.width || media?.width || null,
            height: mediaDoc?.height || media?.height || null,
            status: "ACTIVE",
          } : null,
          uploadedBy: validUserId,
          expiresAt: resolvedMediaUrl ? sixtyDaysFromNow : null,
          timestamp: new Date(isoTimestamp),
        });

        // Link existing Media record or create if not existing
        if (resolvedMediaUrl) {
          if (mediaDoc) {
            mediaDoc.messageId = savedMsgDoc._id;
            mediaDoc.phone = phone;
            mediaDoc.recipientPhone = phone;
            mediaDoc.senderPhone = actualSenderNumber;
            if (customerDoc?._id) mediaDoc.customerId = customerDoc._id;
            await mediaDoc.save().catch((mSaveErr) => {
              console.warn("[POST /api/chats] Media document link warning:", mSaveErr.message);
            });
          } else {
            // Create Media Document for Admin tracking if none was passed
            const createdMediaDoc = await Media.create({
              messageId: savedMsgDoc._id,
              customerId: customerDoc?._id || null,
              phone,
              senderPhone: actualSenderNumber,
              recipientPhone: phone,
              uploadedBy: validUserId,
              createdBy: validUserId,
              direction: "OUTBOUND",
              mediaType: detectedMsgType,
              fileType: detectedMsgType,
              mimeType: resolvedMime,
              extension: detectedMsgType === "document" ? ".pdf" : "",
              originalFileName: resolvedDocName,
              originalFilename: resolvedDocName,
              filename: resolvedDocName,
              cloudinaryUrl: resolvedMediaUrl,
              secureUrl: resolvedMediaUrl,
              cloudinaryPublicId: resolvedPublicId,
              publicId: resolvedPublicId,
              cloudinaryResourceType: resolvedResourceType,
              resourceType: resolvedResourceType,
              folder: detectedMsgType === "document" ? "whatsapp-crm/documents" : detectedMsgType === "video" ? "whatsapp-crm/videos" : detectedMsgType === "audio" ? "whatsapp-crm/audio" : "whatsapp-crm/images",
              fileSize: media?.fileSize || 0,
              size: media?.size || media?.fileSize || 0,
              duration: media?.duration || 0,
              status: "ACTIVE",
              createdAt: new Date(isoTimestamp),
              expiresAt: sixtyDaysFromNow,
            }).catch((mediaErr) => {
              console.warn("[POST /api/chats] Media document save warning:", mediaErr.message);
              return null;
            });

            if (createdMediaDoc) {
              console.log(`[MONGODB] mediaId: ${createdMediaDoc._id} originalFilename: ${createdMediaDoc.originalFilename} cloudinaryUrl: ${createdMediaDoc.cloudinaryUrl}`);
            }
          }
        }
      } catch (saveErr) {
        console.error("[POST /api/chats] CRITICAL — Message save failed:", saveErr.message, {
          phone,
          userId: session.user.id,
          twilioSid,
          model: MsgModel.modelName,
          stack: saveErr.stack,
        });
        return NextResponse.json(
          { success: false, message: "Message could not be saved to database." },
          { status: 500 },
        );
      }

      // ── Step 4: Emit real-time socket event via socketPublisher ──────────
      try {
        const { emitNewMessage, emitChatLockUpdated } = await import("@/shared/utils/socketPublisher");
        const branchId = customerDoc?.branchId ? (customerDoc.branchId._id ? customerDoc.branchId._id.toString() : customerDoc.branchId.toString()) : null;

        const outPayload = {
          customerId: customerDoc?._id ? customerDoc._id.toString() : undefined,
          phone,
          canonicalPhone: normalizePhone(phone),
          customerName: customerDoc?.name,
          name: customerDoc?.name || name || phone,
          message: message || "",
          messageType: detectedMsgType,
          mediaUrl: resolvedMediaUrl || "",
          mediaType: detectedMsgType,
          media: savedMsgDoc?.media || null,
          direction: "OUTBOUND",
          timestamp: isoTimestamp,
          status: "SENT",
          role: role || session?.user?.role || "sales",
          sendBy: { _id: session.user.id, name: session.user.name },
          twilioSid,
          branchId,
          isClosed: customerDoc?.isClosed || false,
          isChatClosed: customerDoc?.isClosed || false,
        };

        emitNewMessage(outPayload, branchId);

        // ── Step 5: Release chat lock & emit lock update ─────────────────────
        if (global.activeChatHandlers && global.activeChatHandlers.has(phone)) {
          const handler = global.activeChatHandlers.get(phone);
          if (handler.userId === (session?.user?.id || session?.user?.email) || !handler.userId) {
            handler.lockedUntil = null;
            emitChatLockUpdated({ phone, handler }, branchId);
          }
        }
      } catch (socketErr) {
        console.error("[POST /api/chats] Socket emit error:", socketErr.message);
      }

      // ── Step 6: Invalidate Redis cache (non-fatal) ─────────────────────
      try {
        if (redis && redis.status === "ready") await redis.del("chats:main_inbox_data");
      } catch (redisErr) {
        console.error("[POST /api/chats] Redis cache clear error:", redisErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Message sent successfully.",
      data: {
        phone,
        message: message || "",
        mediaUrl: resolvedMediaUrl || "",
        mediaType: detectedMsgType,
        media: mediaDoc ? {
          id: mediaDoc._id,
          originalFilename: mediaDoc.originalFilename,
          mimeType: mediaDoc.mimeType,
          mediaType: mediaDoc.mediaType,
          cloudinaryPublicId: mediaDoc.cloudinaryPublicId,
          secureUrl: mediaDoc.secureUrl,
          folder: mediaDoc.folder,
        } : (media || null),
        messageType: detectedMsgType,
        direction: "OUTBOUND",
        status: "SENT",
        twilioSid,
        senderName: name || "Associate",
        role: role || session?.user?.role || "associate",
        sendBy: { _id: session.user.id, name: session.user.name },
        timestamp: isoTimestamp,
      },
    });
  } catch (error) {
    console.error("[POST /api/chats] Unhandled error:", error.message, "\n", error.stack);
    return NextResponse.json({ success: false, message: "An unexpected server error occurred." }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized: Missing session" }, { status: 401 });
    }

    const { hasModuleAccess } = await import("@/shared/utils/auth");
    if (!hasModuleAccess(session, "Chat Inbox")) {
      return NextResponse.json({ success: false, message: "Forbidden: Insufficient permissions to delete chats" }, { status: 403 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid request body — expected JSON" }, { status: 400 });
    }

    const { customerIds, phones, customerId, phone } = body || {};

    const rawCustomerIds = [
      ...(Array.isArray(customerIds) ? customerIds : [customerIds]),
      customerId,
    ].filter(Boolean);

    const rawPhones = [
      ...(Array.isArray(phones) ? phones : [phones]),
      phone,
    ].filter(Boolean);

    if (rawCustomerIds.length === 0 && rawPhones.length === 0) {
      return NextResponse.json({ success: false, message: "No valid chat identifiers provided (expected customerIds or phones)" }, { status: 400 });
    }

    await connectDB();

    const mongoose = (await import("mongoose")).default;
    const CustomerAddress = (await import("@/shared/models/CustomerAddress")).default;
    const ChatWorkspace = (await import("@/shared/models/ChatWorkspace")).default;
    const Notification = (await import("@/shared/models/Notification")).default;
    const Reminder = (await import("@/shared/models/Reminder")).default;
    const { getBranchFilterForUser } = await import("@/shared/utils/serverAuth");
    const { emitChatDeleted } = await import("@/shared/utils/socketPublisher");

    const validCustomerObjectIds = rawCustomerIds
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(String(id)));

    const allSearchPhones = new Set();
    rawPhones.forEach((p) => {
      const vars = getPhoneVariations(p);
      vars.forEach((v) => allSearchPhones.add(v));
      allSearchPhones.add(p);
    });
    const searchPhonesList = Array.from(allSearchPhones);

    // 1. Build lookup query for target customers
    const orConditions = [];
    if (validCustomerObjectIds.length > 0) {
      orConditions.push({ _id: { $in: validCustomerObjectIds } });
    }
    if (searchPhonesList.length > 0) {
      orConditions.push({ phone: { $in: searchPhonesList } });
    }

    if (orConditions.length === 0) {
      return NextResponse.json({ success: false, message: "Invalid customer ID or phone format" }, { status: 400 });
    }

    const { branchQuery } = await getBranchFilterForUser(session);

    // 2. Query target customers within authorized branch scope
    const targetFilter = {
      $and: [
        { $or: orConditions },
        branchQuery
      ]
    };

    const customersToDelete = await Customer.find(targetFilter).lean();

    if (!customersToDelete || customersToDelete.length === 0) {
      // Check if the chat exists outside user's branch scope (forbidden) vs doesn't exist (not found)
      const existingOutsideBranch = await Customer.findOne({ $or: orConditions }).lean();
      if (existingOutsideBranch) {
        return NextResponse.json({ success: false, message: "Forbidden: You do not have permission to delete chats in other branches" }, { status: 403 });
      }
      return NextResponse.json({ success: false, message: "Chat(s) not found" }, { status: 404 });
    }

    const targetCustIds = customersToDelete.map((c) => c._id);
    const targetCustIdStrings = targetCustIds.map((id) => id.toString());

    // 3. Gather all phone variations across matched customers
    const cascadePhonesSet = new Set();
    customersToDelete.forEach((c) => {
      if (c.phone) {
        const vars = getPhoneVariations(c.phone);
        vars.forEach((v) => cascadePhonesSet.add(v));
        cascadePhonesSet.add(c.phone);
      }
    });
    searchPhonesList.forEach((p) => cascadePhonesSet.add(p));
    const cascadePhonesList = Array.from(cascadePhonesSet);

    // 4. Cascade Delete Operations
    // a) Delete Customers
    await Customer.deleteMany({ _id: { $in: targetCustIds } });

    // b) Delete Messages
    await Message.deleteMany({ phone: { $in: cascadePhonesList } });

    // c) Delete Leads
    await Lead.deleteMany({ customerId: { $in: targetCustIds } });

    // d) Delete Activities
    await Activity.deleteMany({
      $or: [
        { customerId: { $in: targetCustIds } },
        { phone: { $in: cascadePhonesList } },
      ],
    });

    // e) Delete Customer Addresses
    const addressIds = customersToDelete
      .map((c) => c.currentAddressId)
      .filter(Boolean);
    if (addressIds.length > 0) {
      await CustomerAddress.deleteMany({ _id: { $in: addressIds } });
    }

    // f) Clean up ChatWorkspace
    await ChatWorkspace.updateMany(
      {
        $or: [
          { activeCustomerId: { $in: targetCustIds } },
          { activePhone: { $in: cascadePhonesList } },
        ],
      },
      { $set: { activePhone: null, activeCustomerId: null, ownerTabId: null } }
    );

    // g) Clean up Notifications & Reminders
    await Notification.deleteMany({
      $or: [
        { customerId: { $in: targetCustIds } },
        { phone: { $in: cascadePhonesList } },
      ],
    });
    await Reminder.deleteMany({ phone: { $in: cascadePhonesList } });

    // h) Clean up in-memory activeChatHandlers
    if (global.activeChatHandlers) {
      cascadePhonesList.forEach((p) => {
        if (global.activeChatHandlers.has(p)) {
          global.activeChatHandlers.delete(p);
        }
      });
    }

    // 5. Invalidate Redis Caches
    if (redis && redis.status === "ready") {
      try {
        await redis.del("chats:main_inbox_data");
        await redis.del("chats:all_data");
      } catch (redisErr) {
        console.error("[DELETE /api/chats] Redis cache invalidation error:", redisErr.message);
      }
    }

    // 6. Emit Realtime Socket Event
    try {
      const primaryBranchId = customersToDelete[0]?.branchId
        ? customersToDelete[0].branchId.toString()
        : null;

      emitChatDeleted({
        customerIds: targetCustIdStrings,
        phones: cascadePhonesList,
        deletedCount: customersToDelete.length,
        deletedBy: { id: session.user.id, name: session.user.name },
      }, primaryBranchId);
    } catch (socketErr) {
      console.error("[DELETE /api/chats] Socket emit error:", socketErr.message);
    }

    return NextResponse.json({
      success: true,
      message: "Chat(s) deleted successfully.",
      data: {
        deletedCount: customersToDelete.length,
        customerIds: targetCustIdStrings,
        phones: cascadePhonesList,
      },
    });
  } catch (error) {
    console.error("[DELETE /api/chats] Unhandled error:", error.message, "\n", error.stack);
    return NextResponse.json({ success: false, message: "Failed to delete chat(s): " + error.message }, { status: 500 });
  }
}

