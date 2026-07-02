import { NextResponse } from "next/server";
import connectDB from "@/lib/db/mongodb";
import Message from "@/models/Message";
import ProductMessage from "@/models/ProductMessage";
import MDCampMessage from "@/models/MDCampMessage";
import TherapyMessage from "@/models/TherapyMessage";
import redis from "@/lib/db/redis";

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

      // A. Retry Mechanism (Database delay-ai fix panna 4 seconds varai kaathirukkum)
      if (twilioSID) {
        let retries = 8; 
        while (retries > 0 && !updatedDoc) {
          const [m1, m2, m3, m4] = await Promise.all([
            Message.findOneAndUpdate({ twilioSid: twilioSID }, { $set: { status: formattedStatus } }, { new: true }),
            ProductMessage.findOneAndUpdate({ twilioSid: twilioSID }, { $set: { status: formattedStatus } }, { new: true }),
            MDCampMessage.findOneAndUpdate({ twilioSid: twilioSID }, { $set: { status: formattedStatus } }, { new: true }),
            TherapyMessage.findOneAndUpdate({ twilioSid: twilioSID }, { $set: { status: formattedStatus } }, { new: true }),
          ]);

          updatedDoc = m1 || m2 || m3 || m4;

          if (updatedDoc) {
            targetPhone = updatedDoc.phone;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
          retries--;
        }
      }

      // B. Extreme Fallback: Twilio SID thappa irunthalum kadaisi message-ai update pannidum
      if (!updatedDoc && targetPhone) {
         if (!targetPhone.startsWith("whatsapp:")) targetPhone = `whatsapp:${targetPhone}`;
         
         const fallbackUpdate = async (Model) => {
             const latest = await Model.findOne({ phone: targetPhone, direction: "OUTBOUND" }).sort({ createdAt: -1 });
             if (latest) {
                 latest.status = formattedStatus;
                 if(!latest.twilioSid) latest.twilioSid = twilioSID; 
                 await latest.save();
                 return latest;
             }
             return null;
         };
         
         updatedDoc = await fallbackUpdate(Message) || await fallbackUpdate(ProductMessage) || await fallbackUpdate(MDCampMessage) || await fallbackUpdate(TherapyMessage);
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