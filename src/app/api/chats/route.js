import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Message from "@/shared/models/Message";
import Lead from "@/shared/models/Lead";
import redis from "@/shared/lib/db/redis";
import twilio from "twilio";
import User from "@/shared/models/User";
import Activity from "@/shared/models/Activity";
import { serverCustomerService } from "@/server/services/serverCustomerService";
import { sanitizeChatList } from "@/shared/utils/privacy";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";

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
    const allowedPhones = inboxCustomers.map((c) => c.phone);

    // Fetch messages for allowed inbox customers in the last 60 days
    let msgs;
    try {
      msgs = await Message.find({ 
        phone: { $in: allowedPhones },
        timestamp: { $gte: sixtyDaysAgo },
        chatType: { $in: ["Direct Lead", null, undefined] }
      })
        .populate({ path: "sendBy", select: "name" })
        .lean();
    } catch (populateErr) {
      console.error("[GET /api/chats] sendBy populate failed, using fallback:", populateErr.message);
      msgs = await Message.find({ 
        phone: { $in: allowedPhones },
        timestamp: { $gte: sixtyDaysAgo },
        chatType: { $in: ["Direct Lead", null, undefined] }
      }).lean();
    }

    // Group messages by phone
    const msgsByPhone = {};
    msgs.forEach((m) => {
      if (!msgsByPhone[m.phone]) {
        msgsByPhone[m.phone] = [];
      }
      msgsByPhone[m.phone].push(m);
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

    // Build conversation structures
    const chats = inboxCustomers.map((c) => {
      const lastHandled = lastHandledMap.get(c._id.toString()) || null;
      const bId = c.branchId ? (c.branchId._id ? c.branchId._id.toString() : c.branchId.toString()) : null;
      const bObj = bId && branchMap[bId] ? branchMap[bId] : null;

      const customerMsgs = msgsByPhone[c.phone] || [];
      customerMsgs.sort((a, b) => new Date(a.timestamp || a.createdAt || 0) - new Date(b.timestamp || b.createdAt || 0));

      const latestMsg = customerMsgs.length > 0 ? customerMsgs[customerMsgs.length - 1] : null;

      let msgText = latestMsg ? (latestMsg.message || "") : "";
      if (!msgText && latestMsg && latestMsg.mediaUrl) {
        if (latestMsg.mediaType?.includes("video")) msgText = "🎥 Video";
        else if (latestMsg.mediaType?.includes("audio")) msgText = "🎵 Audio";
        else if (latestMsg.mediaType?.includes("pdf") || latestMsg.mediaType?.includes("document")) msgText = "📄 Document";
        else msgText = "📷 Photo";
      }

      return {
        phone: c.phone,
        name: resolveCustomerDisplayName({ phone: c.phone, customerName: c.name, senderName: latestMsg ? latestMsg.senderName : "" }),
        message: msgText,
        direction: latestMsg ? latestMsg.direction : "INBOUND",
        city: c.currentAddressId?.city || c.city || "",
        activeRouteCategory: c.activeRouteCategory || "Direct Lead",
        status: c.status || "New",
        priority: c.priority ?? "Medium",
        messageStatus: latestMsg ? (latestMsg.status || "RECEIVED") : "RECEIVED",
        read: latestMsg ? (latestMsg.read || "TRUE") : "TRUE",
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
      };
    }).filter((chat) => chat.phone && !chat.phone.includes("whatsapp:+14155238886"));

    chats.sort((a, b) => new Date(b.lastSeenAt || b.timestamp || 0) - new Date(a.lastSeenAt || a.timestamp || 0));

    if (redis && redis.status === "ready")
      await redis.set("chats:main_inbox_data", JSON.stringify(chats), "EX", REDIS_CACHE_TTL);

    const sanitizedChats = sanitizeChatList(chats, session.user);
    return NextResponse.json(sanitizedChats);
  } catch (error) {
    console.error("[GET /api/chats] Unhandled error:", error.message, "\n", error.stack);
    return NextResponse.json({ success: false, message: "Failed to load chats" }, { status: 500 });
  }
}

export async function POST(req) {
  const isoTimestamp = new Date().toISOString();

  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid request body — expected JSON" }, { status: 400 });
    }

    const { phone, message, name, role, skipSave, senderNumber } = body;
    if (!phone || !message)
      return NextResponse.json({ success: false, message: "Required fields missing: phone and message" }, { status: 400 });

    // Step 1: Send via Centralized Twilio Service
    let twilioSid = "sys_msg_" + Date.now();
    let actualSenderNumber = senderNumber;

    try {
      const { sendWhatsAppMessage } = await import("@/features/admin/services/twilioService");
      const sent = await sendWhatsAppMessage(phone, message, {
        senderNumber,
        user: session.user,
      });
      twilioSid = sent.sid;
      actualSenderNumber = sent.senderNumber;
    } catch (twilioErr) {
      console.error("[POST /api/chats] Twilio error:", twilioErr.message, { phone, userId: session.user.id });
      return NextResponse.json(
        { success: false, message: twilioErr.message },
        { status: twilioErr.message.includes("Forbidden") ? 403 : 400 }
      );
    }

    if (!skipSave) {
      await connectDB();

      try {
        const existingCustomer = await Customer.findOne({ phone }).lean();
        if (!existingCustomer) {
          await serverCustomerService.updateCustomer(phone, { name: name || phone, status: "New", source: "Whatsapp" }, session);
        }
      } catch (customerErr) {
        console.error("[POST /api/chats] Customer upsert error:", customerErr.message, { phone, userId: session.user.id });
      }

      let MsgModel = Message;

      try {
        await MsgModel.create({
          phone,
          message,
          direction: "OUTBOUND",
          status: "SENT",
          twilioSid,
          senderName: name || "Associate",
          senderNumber: actualSenderNumber,
          role: role || session?.user?.role || "associate",
          sendBy: session.user.id,
          timestamp: new Date(isoTimestamp),
        });
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

      // ── Step 3: Emit real-time socket event via socketPublisher ──────────
      try {
        const { emitNewMessage, emitChatLockUpdated } = await import("@/shared/utils/socketPublisher");
        const customerDoc = await Customer.findOne({ phone }).lean();
        const branchId = customerDoc?.branchId ? customerDoc.branchId.toString() : null;

        const outPayload = {
          phone,
          message,
          direction: "OUTBOUND",
          timestamp: isoTimestamp,
          status: "SENT",
          role: role || session?.user?.role || "sales",
          name: name || phone,
          sendBy: { _id: session.user.id, name: session.user.name },
          twilioSid,
          branchId,
        };

        emitNewMessage(outPayload, branchId);

        // ── Step 4: Release chat lock & emit lock update ─────────────────────
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

      // â”€â”€ Step 5: Invalidate Redis cache (non-fatal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        message,
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
    if (!session)
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    const { phones } = await req.json();
    if (!phones || !Array.isArray(phones) || phones.length === 0)
      return NextResponse.json({ success: false, message: "No phones provided" }, { status: 400 });

    await connectDB();
    await Message.deleteMany({ phone: { $in: phones } });

    if (redis && redis.status === "ready")
      await redis.del("chats:main_inbox_data");

    return NextResponse.json({ success: true, data: { deletedCount: phones.length } });
  } catch (error) {
    console.error("[DELETE /api/chats] Error:", error.message, "\n", error.stack);
    return NextResponse.json({ success: false, message: "Failed to delete chats" }, { status: 500 });
  }
}
