import { NextResponse } from "next/server.js";
import connectDB from "../../../../shared/lib/db/mongodb.js";
import Message from "../../../../shared/models/Message.js";
import redis from "../../../../shared/lib/db/redis.js";

// All Twilio Outbound Statuses
const TWILIO_STATUSES = [
  "queued", "sending", "sent", "failed", "delivered", "undelivered", 
  "read", "partially_delivered", "canceled"
];

export async function POST(req) {
  try {
    await connectDB();

    let body = {};
    const contentType = req.headers.get("content-type") || "";
    const rawText = await req.text();

    if (rawText) {
      if (contentType.includes("application/json")) {
        try { body = JSON.parse(rawText); } catch (e) {}
      } else {
        body = Object.fromEntries(new URLSearchParams(rawText).entries());
      }
    }

    if (Object.keys(body).length === 0) {
      const url = new URL(req.url);
      body = Object.fromEntries(url.searchParams.entries());
    }

    const twilioSID = body.MessageSid || body.SmsSid || body.sid || "";
    const messageStatus = body.MessageStatus || body.SmsStatus || body.status || "";

    if (messageStatus && TWILIO_STATUSES.includes(messageStatus.toLowerCase())) {
      const formattedStatus = messageStatus.toUpperCase();
      let targetPhone = body.To || body.to || null; 
      let updatedDoc = null;

      // A. Retry Mechanism
      if (twilioSID) {
        let retries = 8; 
        while (retries > 0 && !updatedDoc) {
          updatedDoc = await Message.findOneAndUpdate({ twilioSid: twilioSID }, { $set: { status: formattedStatus } }, { returnDocument: "after" });

          if (updatedDoc) {
            targetPhone = updatedDoc.phone;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
          retries--;
        }
      }

      // B. Extreme Fallback
      if (!updatedDoc && targetPhone) {
         if (!targetPhone.startsWith("whatsapp:")) targetPhone = `whatsapp:${targetPhone}`;
         const latest = await Message.findOne({ phone: targetPhone, direction: "OUTBOUND" }).sort({ createdAt: -1 });
         if (latest) {
             latest.status = formattedStatus;
             if (!latest.twilioSid) latest.twilioSid = twilioSID; 
             await latest.save();
             updatedDoc = latest;
         }
      }

      // C. Push instant UI update via Socket
      if (global.io) {
        global.io.emit("message_status_update", {
          sid: twilioSID,
          status: formattedStatus,
          phone: targetPhone,
        });
      }

      // D. Force Clear Redis
      if (redis && redis.status !== "disabled") {
        try {
          await redis.del("chats:all_data");
          await redis.del("chats:main_inbox_data");
        } catch (e) {}
      }

      return NextResponse.json({ success: true, statusUpdated: !!updatedDoc, finalStatus: formattedStatus });
    }

    return NextResponse.json({ success: true, ignored: true, reason: "Not a valid status update" });

  } catch (error) {
    console.error("Status Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectDB();
    const { getQueueMetrics } = await import("../../../../server/queues/queueManager.js");
    const queueMetrics = await getQueueMetrics();

    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        mongodb: "connected",
        redis: redis && redis.status !== "disabled" ? "connected" : "standalone/fallback",
      },
      queues: queueMetrics,
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: err.message,
      },
      { status: 500 }
    );
  }
}