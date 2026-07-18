import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Message from "@/shared/models/Message";
import Lead from "@/shared/models/Lead";
import redis from "@/shared/lib/db/redis";
import twilio from "twilio";

const REDIS_CACHE_TTL = 30;

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (redis && redis.status === "ready") {
      try {
        const cachedData = await redis.get("chats:main_inbox_data");
        if (cachedData) return NextResponse.json(JSON.parse(cachedData));
      } catch (e) {}
    }

    await connectDB();

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // 👇 FIX: Fetching ONLY from the main 'Message' collection for the general inbox.
    const [customers, msgs] = await Promise.all([
      Customer.find({}).lean(),
      Message.find({ timestamp: { $gte: sixtyDaysAgo } }).lean(),
    ]);

    const allMessages = msgs.map((m) => ({
      ...m,
      categoryLabel: null,
      time: new Date(m.timestamp || m.createdAt || 0).getTime(),
    }));

    allMessages.sort((a, b) => a.time - b.time);

    const contactMap = new Map();

    customers.forEach((c) => {
      contactMap.set(c.phone, {
        name: c.name,
        status: c.status,
        city: c.city,
        assignedTo: c.assignedTo,
        activeRouteCategory: c.activeRouteCategory,
        unreadCount: c.unreadCount || 0,
        priority: c.priority,
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
          mediaType: msg.mediaType || "",
          lastSeenAt: new Date(msg.time).toISOString(),
          ...customerInfo,
        };
      })
      .filter(
        (chat) => chat.phone && !chat.phone.includes("whatsapp:+14155238886"),
      );

    if (redis && redis.status === "ready")
      await redis.set(
        "chats:main_inbox_data",
        JSON.stringify(chats),
        "EX",
        REDIS_CACHE_TTL,
      );

    return NextResponse.json(chats);
  } catch (error) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { phone, message, name, role, skipSave } = await req.json();
    if (!phone || !message)
      return NextResponse.json({ error: "Required fields missing" }, { status: 400 });

    let twilioSid = "sys_msg_" + Date.now();
    const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
    const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status` : "https://nonarsenic-nonparous-clotilde.ngrok-free.dev/api/webhook/status";
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
      const sent = await client.messages.create({
        body: message,
        from: myTwilioNumber,
        to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
        // 🚀 THE FIX: Tell Twilio EXACTLY where to send the Delivery Status!
        statusCallback: callbackUrl
      });
      
      twilioSid = sent.sid;
    } catch (e) {
        console.error("Twilio Send Error:", e);
    }

    if (!skipSave) {
      await connectDB();
      const isoTimestamp = new Date().toISOString();

      await Customer.findOneAndUpdate(
        { phone: phone },
        { $setOnInsert: { name: name || phone, status: "New", assignedTo: "unassigned", createdBy: session.user.id } },
        { upsert: true }
      );

      const lead = await Lead.findOne({ phone }).lean();

      let targetModelName = "Message";
      if (lead) {
        if (lead.leadType === "Product Lead") targetModelName = "ProductMessage";
        else if (lead.leadType === "MD Camp") targetModelName = "MDCampMessage";
        else if (lead.leadType === "Therapy") targetModelName = "TherapyMessage";
      }

      let MsgModel = Message;
      if (targetModelName === "ProductMessage") MsgModel = (await import("@/shared/models/ProductMessage")).default;
      if (targetModelName === "MDCampMessage") MsgModel = (await import("@/shared/models/MDCampMessage")).default;
      if (targetModelName === "TherapyMessage") MsgModel = (await import("@/shared/models/TherapyMessage")).default;

      await MsgModel.create({
        phone: phone,
        message: message,
        direction: "OUTBOUND",
        status: "SENT",
        twilioSid: twilioSid,
        senderName: name || "Associate",
      });

      if (global.io) {
        global.io.emit("new_message", {
          phone: phone,
          message: message,
          direction: "OUTBOUND",
          timestamp: isoTimestamp,
          status: "SENT",
          role: role || "sales",
          name: name || phone,
        });
      }

      if (global.activeChatHandlers && global.activeChatHandlers.has(phone)) {
        const handler = global.activeChatHandlers.get(phone);
        if (handler.userId === (session?.user?.id || session?.user?.email) || !handler.userId) {
           handler.lockedUntil = null;
           if (global.io) global.io.emit("chat_lock_updated", { phone, handler });
        }
      }

      if (redis && redis.status === "ready") await redis.del("chats:main_inbox_data");
    }
    return NextResponse.json({ success: true, twilioSid });
  } catch (error) {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { phones } = await req.json();
    if (!phones || !Array.isArray(phones) || phones.length === 0)
      return NextResponse.json(
        { error: "No phones provided" },
        { status: 400 },
      );

    await connectDB();
    await Message.deleteMany({ phone: { $in: phones } });

    if (redis && redis.status === "ready")
      await redis.del("chats:main_inbox_data");
    return NextResponse.json({ success: true, deletedCount: phones.length });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete chats" },
      { status: 500 },
    );
  }
}
