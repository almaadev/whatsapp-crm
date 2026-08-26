import { NextResponse } from "next/server.js";
import connectDB from "../../../../shared/lib/db/mongodb.js";
import Message from "../../../../shared/models/Message.js";
import CampaignRecipient from "../../../../shared/models/CampaignRecipient.js";
import redis from "../../../../shared/lib/db/redis.js";
import { syncCampaignCounts } from "../../../../server/services/campaignService.js";

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
    const errorCode = body.ErrorCode || body.errorCode || null;
    const errorMessage = body.ErrorMessage || body.errorMessage || null;

    if (messageStatus && TWILIO_STATUSES.includes(messageStatus.toLowerCase())) {
      const formattedStatus = messageStatus.toUpperCase();
      let targetPhone = body.To || body.to || null; 
      let updatedDoc = null;

      // A. Update individual Message ledger in MongoDB
      if (twilioSID) {
        let retries = 5; 
        while (retries > 0 && !updatedDoc) {
          const updateFields = { status: formattedStatus };
          if (formattedStatus === "READ") {
            updateFields.read = "TRUE";
          }

          updatedDoc = await Message.findOneAndUpdate(
            { twilioSid: twilioSID },
            { $set: updateFields },
            { returnDocument: "after" }
          );

          if (updatedDoc) {
            targetPhone = updatedDoc.phone;
            break;
          }

          const hasCampaignRec = await CampaignRecipient.exists({ twilioMessageSid: twilioSID });
          if (hasCampaignRec) break;

          await new Promise((resolve) => setTimeout(resolve, 200));
          retries--;
        }
      }

      // B. Fallback Message lookup
      if (!updatedDoc && targetPhone) {
        if (!targetPhone.startsWith("whatsapp:")) targetPhone = `whatsapp:${targetPhone}`;
        const latest = await Message.findOne({ phone: targetPhone, direction: "OUTBOUND" }).sort({ createdAt: -1 });
        if (latest) {
          latest.status = formattedStatus;
          if (!latest.twilioSid) latest.twilioSid = twilioSID;
          if (formattedStatus === "READ") latest.read = "TRUE";
          await latest.save();
          updatedDoc = latest;
        }
      }

      // C. Update CampaignRecipient & Sync Campaign Aggregate Counters
      let syncSummary = null;
      if (twilioSID) {
        const recipientDoc = await CampaignRecipient.findOne({ twilioMessageSid: twilioSID });
        if (recipientDoc) {
          recipientDoc.status = formattedStatus;
          recipientDoc.twilioStatus = messageStatus;
          const now = new Date();

          if (formattedStatus === "SENT") {
            recipientDoc.sentAt = recipientDoc.sentAt || now;
          } else if (formattedStatus === "DELIVERED") {
            recipientDoc.deliveredAt = now;
            recipientDoc.sentAt = recipientDoc.sentAt || now;
          } else if (formattedStatus === "READ") {
            recipientDoc.readAt = now;
            recipientDoc.deliveredAt = recipientDoc.deliveredAt || now;
            recipientDoc.sentAt = recipientDoc.sentAt || now;
          } else if (formattedStatus === "FAILED" || formattedStatus === "UNDELIVERED") {
            recipientDoc.failedAt = now;
            if (errorCode) recipientDoc.errorCode = String(errorCode);
            if (errorMessage) recipientDoc.errorMessage = errorMessage;
          }

          await recipientDoc.save();
          syncSummary = await syncCampaignCounts(recipientDoc.campaignId);

          // Emit real-time campaign status event
          if (global.io) {
            global.io.emit("bulk_message_status", {
              campaignId: recipientDoc.campaignId.toString(),
              recipientId: recipientDoc._id.toString(),
              phone: recipientDoc.phone,
              status: formattedStatus,
              twilioMessageSid: twilioSID,
              counts: syncSummary?.counts || {},
              successfulSends: syncSummary?.successfulSends || 0,
              failedSends: syncSummary?.failedSends || 0,
              deliveredCount: syncSummary?.deliveredCount || 0,
              readCount: syncSummary?.readCount || 0,
              undeliveredCount: syncSummary?.undeliveredCount || 0,
              skippedCount: syncSummary?.skippedCount || 0,
              total: syncSummary?.total || 0,
              progress: syncSummary?.progress || 0,
            });
          }
        }
      }

      // D. Push instant chat UI update via Socket
      if (global.io) {
        global.io.emit("message_status_update", {
          sid: twilioSID,
          status: formattedStatus,
          phone: targetPhone,
        });
      }

      // E. Clear Redis Cache
      if (redis && redis.status !== "disabled") {
        try {
          await redis.del("chats:all_data");
          await redis.del("chats:main_inbox_data");
        } catch (e) {}
      }

      return NextResponse.json({
        success: true,
        statusUpdated: !!updatedDoc,
        finalStatus: formattedStatus,
        campaignSynced: !!syncSummary,
      });
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