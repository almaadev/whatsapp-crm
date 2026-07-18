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

const REDIS_CACHE_TTL = 30;

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    if (redis && redis.status === "ready") {
      try {
        const cachedData = await redis.get("chats:main_inbox_data");
        if (cachedData) return NextResponse.json(JSON.parse(cachedData));
      } catch (e) {}
    }

    await connectDB();

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const customers = await Customer.find({})
      .populate({ path: "chatHistory.performedBy", select: "name role department" })
      .lean();

    // Safe populate â€” fall back if sendBy has old non-ObjectId values
    let msgs;
    try {
      msgs = await Message.find({ timestamp: { $gte: sixtyDaysAgo } })
        .populate({ path: "sendBy", select: "name" })
        .lean();
    } catch (populateErr) {
      console.error("[GET /api/chats] sendBy populate failed, using fallback:", populateErr.message);
      msgs = await Message.find({ timestamp: { $gte: sixtyDaysAgo } }).lean();
    }

    const allMessages = msgs.map((m) => ({
      ...m,
      categoryLabel: null,
      time: new Date(m.timestamp || m.createdAt || 0).getTime(),
    }));

    allMessages.sort((a, b) => a.time - b.time);

    const contactMap = new Map();
    customers.forEach((c) => {
      let lastHandled = null;
      if (c.chatHistory && c.chatHistory.length > 0) {
        const latest = c.chatHistory[c.chatHistory.length - 1];
        if (latest.performedBy) {
          lastHandled = {
            name: latest.performedBy.name || "Unknown",
            role: latest.performedBy.role || "",
            department: latest.performedBy.department || "",
          };
        }
      }
      contactMap.set(c.phone, {
        name: c.name,
        status: c.status,
        city: c.city,
        assignedTo: c.assignedTo,
        activeRouteCategory: c.activeRouteCategory,
        unreadCount: c.unreadCount || 0,
        priority: c.priority,
        lastHandled,
      });
    });

    const chats = allMessages
      .map((msg) => {
        const customerInfo = contactMap.get(msg.phone) || {};
        return {
          phone: msg.phone,
          name: customerInfo.name || msg.senderName || msg.phone,
          message: msg.message || "",
          direction: msg.direction,
          city: customerInfo.city || "",
          activeRouteCategory: customerInfo.activeRouteCategory,
          status: customerInfo.status || "New",
          priority: customerInfo.priority ?? "Medium",
          messageStatus: msg.status || "RECEIVED",
          read: msg.read || "TRUE",
          timestamp: new Date(msg.time).toISOString(),
          twilioSid: msg.twilioSid || "",
          associate: customerInfo.assignedTo || "",
          categoryLabel: msg.categoryLabel,
          role: "sales",
          isChatClosed: msg.isChatClosed,
          mediaUrl: msg.mediaUrl || "",
          lastHandled: customerInfo.lastHandled || null,
          mediaType: msg.mediaType || "",
          lastSeenAt: new Date(msg.time).toISOString(),
          senderName: msg.senderName || msg.associateName || "",
          senderRole: msg.role || "",
          sendBy: msg.sendBy || null,
          ...customerInfo,
        };
      })
      .filter((chat) => chat.phone && !chat.phone.includes("whatsapp:+14155238886"));

    if (redis && redis.status === "ready")
      await redis.set("chats:main_inbox_data", JSON.stringify(chats), "EX", REDIS_CACHE_TTL);

    return NextResponse.json(chats);
  } catch (error) {
    console.error("[GET /api/chats] Unhandled error:", error.message, "\n", error.stack);
    return NextResponse.json({ success: false, message: "Failed to load chats" }, { status: 500 });
  }
}

export async function POST(req) {
  // âœ… ROOT CAUSE FIX: isoTimestamp declared at the TOP of the handler so it is
  // accessible in both the if(!skipSave) block AND the final return statement.
  // Previously it was declared inside if(!skipSave) but used outside â†’ ReferenceError â†’ 500.
  const isoTimestamp = new Date().toISOString();

  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, message: "Invalid request body â€” expected JSON" }, { status: 400 });
    }

    const { phone, message, name, role, skipSave } = body;
    if (!phone || !message)
      return NextResponse.json({ success: false, message: "Required fields missing: phone and message" }, { status: 400 });

    // â”€â”€ Step 1: Send via Twilio (non-fatal â€” fallback SID used on failure) â”€â”€â”€â”€â”€â”€
    let twilioSid = "sys_msg_" + Date.now();
    const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
    const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status`
      : "https://nonarsenic-nonparous-clotilde.ngrok-free.dev/api/webhook/status";

    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const sent = await client.messages.create({
        body: message,
        from: myTwilioNumber,
        to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
        statusCallback: callbackUrl,
      });
      twilioSid = sent.sid;
    } catch (twilioErr) {
      console.error("[POST /api/chats] Twilio error:", twilioErr.message, { phone, userId: session.user.id });
    }

    if (!skipSave) {
      await connectDB();

      // â”€â”€ Step 2a: Ensure Customer record exists (non-fatal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      try {
        await Customer.findOneAndUpdate(
          { phone },
          {
            $setOnInsert: {
              name: name || phone,
              status: "New",
              assignedTo: "unassigned",
              createdBy: session.user.id,
              chatHistory: [{
                action: "Started",
                performedBy: session.user.id,
                timestamp: new Date(),
                notes: "First outbound message sent",
              }],
            },
          },
          { upsert: true },
        );
      } catch (customerErr) {
        console.error("[POST /api/chats] Customer upsert error:", customerErr.message, { phone, userId: session.user.id });
      }

      // â”€â”€ Step 2b: Determine correct message collection based on lead type â”€â”€
      let MsgModel = Message;
      try {
        const lead = await Lead.findOne({ phone }).lean();
        if (lead) {
          if (lead.leadType === "Product Lead")
            MsgModel = (await import("@/shared/models/ProductMessage")).default;
          else if (lead.leadType === "MD Camp")
            MsgModel = (await import("@/shared/models/MDCampMessage")).default;
          else if (lead.leadType === "Therapy")
            MsgModel = (await import("@/shared/models/TherapyMessage")).default;
        }
      } catch (leadErr) {
        console.error("[POST /api/chats] Lead lookup error:", leadErr.message, { phone });
      }

      // â”€â”€ Step 2c: Save message â€” FATAL if this fails â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      try {
        await MsgModel.create({
          phone,
          message,
          direction: "OUTBOUND",
          status: "SENT",
          twilioSid,
          senderName: name || "Associate",
          role: role || session?.user?.role || "associate",
          sendBy: session.user.id,
          timestamp: new Date(isoTimestamp),
        });
      } catch (saveErr) {
        console.error("[POST /api/chats] CRITICAL â€” Message save failed:", saveErr.message, {
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

      // â”€â”€ Step 3: Emit real-time socket event (non-fatal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      try {
        if (global.io) {
          global.io.emit("new_message", {
            phone,
            message,
            direction: "OUTBOUND",
            timestamp: isoTimestamp,
            status: "SENT",
            role: role || "sales",
            name: name || phone,
            sendBy: { _id: session.user.id, name: session.user.name },
            twilioSid,
          });
        }
      } catch (socketErr) {
        console.error("[POST /api/chats] Socket emit error:", socketErr.message);
      }

      // â”€â”€ Step 4: Release chat lock (non-fatal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      try {
        if (global.activeChatHandlers && global.activeChatHandlers.has(phone)) {
          const handler = global.activeChatHandlers.get(phone);
          if (handler.userId === (session?.user?.id || session?.user?.email) || !handler.userId) {
            handler.lockedUntil = null;
            if (global.io) global.io.emit("chat_lock_updated", { phone, handler });
          }
        }
      } catch (lockErr) {
        console.error("[POST /api/chats] Chat lock release error:", lockErr.message);
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
