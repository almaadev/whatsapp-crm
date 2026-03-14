import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Message from "@/models/Message";
import redis from "@/lib/redis";

export async function POST(req) {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    let body = {};
    const contentType = req.headers.get("content-type") || "";
    const rawText = await req.text();

    // Safe Parser logic (same as before)
    if (rawText) {
      if (contentType.includes("application/json")) {
        try { 
          body = JSON.parse(rawText); 
        } catch (e) { 
          const extract = (key) => {
             const regex = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"(?:\\s*,|\\s*})`, "i");
             const match = rawText.match(regex);
             return match ? match[1].trim() : "";
          };
          body = {
            from: extract("from") || extract("From"),
            to: extract("to") || extract("To"),
            body: extract("body") || extract("Body"),
            sid: extract("sid") || extract("MessageSid"),
            status: extract("status") || extract("MessageStatus"),
            numMedia: extract("numMedia") || extract("NumMedia"),
          };
          for(let i=0; i<10; i++) {
             body[`MediaUrl${i}`] = extract(`MediaUrl${i}`);
             body[`MediaContentType${i}`] = extract(`MediaContentType${i}`);
          }
        }
      } else {
        body = Object.fromEntries(new URLSearchParams(rawText).entries());
      }
    }

    if (Object.keys(body).length === 0) {
      const url = new URL(req.url);
      body = Object.fromEntries(url.searchParams.entries());
    }

    // 2. DELIVERY STATUS UPDATE LOGIC (Updated to MongoDB)
    const twilioSID = body.MessageSid || body.SmsSid || body.sid || body.Sid || "";
    const messageStatus = body.MessageStatus || body.SmsStatus || body.status || "";
    const statusTypes = ['sent', 'delivered', 'read', 'failed'];

    if (messageStatus && statusTypes.includes(messageStatus.toLowerCase())) {
      const formattedStatus = messageStatus.toUpperCase();

      if (global.io) {
        global.io.emit("message_status_update", { sid: twilioSID, status: formattedStatus });
      }

      // MongoDB Update Status
      await Message.findOneAndUpdate(
        { twilioSid: twilioSID },
        { status: formattedStatus }
      );

      if (redis && redis.status !== 'disabled') {
        try { await redis.del("chats:all_data"); } catch (e) { }
      }

      return NextResponse.json({ success: true, updated: formattedStatus });
    }

    // 3. INCOMING MESSAGE & MEDIA LOGIC
    let phone = body.From || body.from || "";
    let messageText = body.Body || body.body || ""; 
    let numMedia = parseInt(body.NumMedia || body.numMedia || "0");
    if (isNaN(numMedia)) numMedia = 0;
    const profileName = body.From || body.from || null;

    if (phone && !phone.startsWith("whatsapp:")) phone = `whatsapp:${phone}`;

    if (!phone || (!messageText && numMedia === 0)) {
      return NextResponse.json({ success: true, ignored: true });
    }

    messageText = messageText.replace(/\\n/g, "\n");
    const isoTimestamp = new Date().toISOString();

    // MongoDB: Create Customer if not exists (Upsert)
    await Customer.findOneAndUpdate(
      { phone: phone },
      { 
        $setOnInsert: { name: profileName, status: "New", assignedTo: "unassigned" },
        $inc: { unreadCount: 1 } // Increase unread message count
      },
      { upsert: true, new: true }
    );

    const newMessages = [];

    // MongoDB: Save Media Messages
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = body[`MediaUrl${i}`] || body[`mediaUrl${i}`] || "";
        const mediaType = body[`MediaContentType${i}`] || body[`mediaContentType${i}`] || "";
        
        newMessages.push({
          phone: phone,
          message: messageText,
          direction: "INBOUND",
          status: "RECEIVED",
          read: "FALSE",
          twilioSid: twilioSID,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          senderName: profileName
        });

        if (global.io) {
            global.io.emit("new_message", {
              phone: phone, message: messageText, direction: "INBOUND",
              timestamp: isoTimestamp, name: profileName, status: "RECEIVED",
              read: "FALSE", mediaUrl: mediaUrl, mediaType: mediaType
            });
        }
      }
    } else {
      // MongoDB: Save Text Messages
      newMessages.push({
        phone: phone,
        message: messageText,
        direction: "INBOUND",
        status: "RECEIVED",
        read: "FALSE",
        twilioSid: twilioSID,
        senderName: profileName
      });

      if (global.io) {
        global.io.emit("new_message", {
          phone: phone, message: messageText, direction: "INBOUND",
          timestamp: isoTimestamp, name: profileName, status: "RECEIVED", read: "FALSE"
        });
      }
    }

    // Insert to DB
    if (newMessages.length > 0) {
      await Message.insertMany(newMessages);
    }

    if (redis && redis.status !== 'disabled') {
      try { await redis.del("chats:all_data"); } catch (e) { }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Webhook DB Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}