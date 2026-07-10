import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import Message from "@/shared/models/Message";
import Customer from "@/shared/models/Customer";
import redis from "@/shared/lib/db/redis";
import { verifyStudioLogSecret } from "@/shared/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    if (!verifyStudioLogSecret(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    // 2. Read JSON Body
    const body = await req.json();

    let phone = body.phone || body.To || body.From || "";
    const message = body.message || body.Body || "Automated Message";
    const twilioSID = body.twilioSid || body.MessageSid || "auto_" + Date.now();

    // WhatsApp prefix check
    if (phone && !phone.startsWith("whatsapp:")) {
        phone = `whatsapp:${phone}`;
    }

    if (!phone) {
      
      return NextResponse.json({ error: "Missing phone" }, { status: 400 });
    }

    const isoTimestamp = new Date().toISOString();

    // 3. Ensure Customer exists in DB (Upsert)
    await Customer.findOneAndUpdate(
      { phone: phone },
      { $setOnInsert: { name: "Unknown", status: "New", assignedTo: "unassigned" } },
      { upsert: true, new: true }
    );

    // 4. Save the automated message directly to MongoDB
    await Message.create({
      phone: phone,
      message: message,
      direction: "OUTBOUND",
      status: "DELIVERED",
      twilioSid: twilioSID,
      senderName: "Twilio bot"
    });

    // 5. Send Live Update to UI via Socket
    if (global.io) {
      global.io.emit("new_message", { 
          phone: phone, 
          message: message, 
          direction: "OUTBOUND", 
          timestamp: isoTimestamp, 
          status: "DELIVERED", 
          role: "", 
          name: "Twilio bot"
      });
    }

    if (redis && redis.status !== "disabled") {
      try {
        await redis.del("chats:all_data");
        await redis.del("chats:main_inbox_data");
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({ success: true, method: "POST (MongoDB)" });

  } catch (error) {
    console.error("Studio Log DB Error:", error.message);
    return NextResponse.json({ error: "Server Error: " + error.message }, { status: 500 });
  }
}