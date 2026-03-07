import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Message from "@/models/Message";
import redis from "@/lib/redis";
import twilio from "twilio";

const REDIS_CACHE_TTL = 30;

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (redis && redis.status === 'ready') {
      try {
        const cachedData = await redis.get("chats:all_data");
        if (cachedData) return NextResponse.json(JSON.parse(cachedData));
      } catch (e) { console.error("Redis Error", e); }
    }

    await connectDB();

    // 🚀 NEW LOGIC: Only fetch messages from the last 60 days to prevent server crash
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [customers, messages] = await Promise.all([
      Customer.find({}).lean(),
      Message.find({ timestamp: { $gte: sixtyDaysAgo } }).sort({ timestamp: 1 }).lean()
    ]);

    const contactMap = new Map();
    customers.forEach(c => {
      contactMap.set(c.phone, { name: c.name, status: c.status, assignedTo: c.assignedTo, unreadCount: c.unreadCount || 0 });
    });

    const chats = messages.map((msg) => {
      const customerInfo = contactMap.get(msg.phone) || {};
      return {
        phone: msg.phone,
        name: customerInfo.name || msg.senderName || msg.phone,
        message: msg.message || "",
        direction: msg.direction,
        status: customerInfo.status || "New", 
        messageStatus: msg.status || "RECEIVED", 
        read: msg.direction === "INBOUND" ? "FALSE" : "TRUE",
        timestamp: msg.timestamp || new Date().toISOString(),
        twilioSid: msg.twilioSid || "",
        associate: customerInfo.assignedTo || "",
        role: "sales",
        mediaUrl: msg.mediaUrl || "",
        mediaType: msg.mediaType || "",
        lastSeenAt: msg.timestamp || new Date().toISOString(),
        ...customerInfo
      };
    }).filter(chat => chat.phone && !chat.phone.includes("whatsapp:+14155238886"));

    if (redis && redis.status === 'ready') {
      await redis.set("chats:all_data", JSON.stringify(chats), "EX", 30);
    }

    return NextResponse.json(chats);

  } catch (error) {
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { phone, message, name, role, skipSave } = await req.json();
    if (!phone || !message) return NextResponse.json({ error: "Required fields missing" }, { status: 400 });

    let twilioSid = "sys_msg_" + Date.now();
    const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;

    // 1. SEND MESSAGE VIA TWILIO
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const sent = await client.messages.create({
        body: message,
        from: myTwilioNumber,
        to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
      });
      twilioSid = sent.sid;
    } catch (e) {
      console.error("Twilio Error:", e.message);
    }

    // 2. SAVE OUTBOUND MESSAGE TO MONGODB
    if (!skipSave) {
      await connectDB();
      const isoTimestamp = new Date().toISOString();

      // Ensure customer exists in DB
      await Customer.findOneAndUpdate(
        { phone: phone },
        { $setOnInsert: { name: name || phone, status: "New", assignedTo: "unassigned" } },
        { upsert: true }
      );

      // Save message
      await Message.create({
        phone: phone,
        message: message,
        direction: "OUTBOUND",
        status: "SENT",
        twilioSid: twilioSid,
        senderName: name || "Associate"
      });

      // Send to UI live
      if (global.io) {
        global.io.emit("new_message", { 
            phone: phone, 
            message: message, 
            direction: "OUTBOUND", 
            timestamp: isoTimestamp,
            status: "SENT",
            role: role || "sales",
            name: name || phone
        });
      }

      // Clear cache to show new message on refresh
      if (redis && redis.status === 'ready') await redis.del("chats:all_data");
    }

    return NextResponse.json({ success: true, twilioSid });
  } catch (error) {
    console.error("POST Chat DB Error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}