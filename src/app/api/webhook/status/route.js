import { NextResponse } from "next/server.js";
import twilio from "twilio";
import connectDB from "../../../../shared/lib/db/mongodb.js";
import Message from "../../../../shared/models/Message.js";
import CampaignRecipient from "../../../../shared/models/CampaignRecipient.js";
import redis from "../../../../shared/lib/db/redis.js";
import { syncCampaignCounts } from "../../../../server/services/campaignService.js";
import { emitMessageStatusUpdate } from "../../../../shared/utils/socketPublisher.js";
import { normalizePhone, formatForTwilio } from "../../../../shared/utils/phoneUtils.js";

// All Twilio Outbound Statuses
const TWILIO_STATUSES = [
  "queued", "sending", "sent", "failed", "delivered", "undelivered", 
  "read", "partially_delivered", "canceled"
];

// Status precedence rank to prevent out-of-order callback regressions
const STATUS_RANK = {
  QUEUED: 1,
  SENDING: 2,
  SENT: 3,
  DELIVERED: 4,
  READ: 5,
  UNDELIVERED: 4,
  FAILED: 4,
  CANCELED: 4,
};

function shouldUpdateStatus(currentStatus, newStatus) {
  if (!currentStatus) return true;
  const curr = (currentStatus || "").toUpperCase();
  const next = (newStatus || "").toUpperCase();

  if (curr === next) return true;

  // Terminal failure states cannot be downgraded to lower progress states
  if (["FAILED", "UNDELIVERED", "CANCELED"].includes(curr) && ["QUEUED", "SENDING", "SENT"].includes(next)) {
    return false;
  }

  // Read state is ultimate progression; cannot be overwritten by sent or delivered
  if (curr === "READ" && (next === "DELIVERED" || next === "SENT" || next === "QUEUED")) {
    return false;
  }

  // Delivered cannot be downgraded to sent or queued
  if (curr === "DELIVERED" && (next === "SENT" || next === "QUEUED")) {
    return false;
  }

  const currentRank = STATUS_RANK[curr] || 0;
  const nextRank = STATUS_RANK[next] || 0;
  return nextRank >= currentRank;
}

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
    const errorMessage = body.ErrorMessage || body.errorMessage || body.ChannelStatusMessage || null;
    const channelStatusMessage = body.ChannelStatusMessage || null;
    const signature = req.headers.get("x-twilio-signature") || "";

    console.log(`[WEBHOOK-STATUS] received | sid=${twilioSID} | status=${messageStatus} | to=${body.To || body.to}`);

    // Signature Validation
    const isProduction = process.env.NODE_ENV === "production";
    const validateSignatureEnv = process.env.TWILIO_VALIDATE_SIGNATURE !== "false";

    if (isProduction && validateSignatureEnv && process.env.TWILIO_AUTH_TOKEN && signature) {
      const requestUrl = req.url || (process.env.NEXT_PUBLIC_BASE_URL ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status` : "");
      const isValid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, requestUrl, body);
      if (!isValid) {
        console.warn(`[WEBHOOK-STATUS] signature: INVALID for SID ${twilioSID}`);
        return NextResponse.json({ success: false, error: "Invalid Twilio Signature" }, { status: 403 });
      }
      console.log(`[WEBHOOK-STATUS] signature: VALID`);
    } else {
      console.log(`[WEBHOOK-STATUS] signature: SKIPPED (${isProduction ? "disabled by config" : "development mode"})`);
    }

    if (messageStatus && TWILIO_STATUSES.includes(messageStatus.toLowerCase())) {
      const formattedStatus = messageStatus.toUpperCase();
      let rawTargetPhone = body.To || body.to || null;
      let targetPhone = rawTargetPhone ? formatForTwilio(rawTargetPhone) : null;
      let updatedDoc = null;

      // A. Update individual Message ledger in MongoDB
      if (twilioSID) {
        let retries = 3;
        while (retries > 0 && !updatedDoc) {
          const existingMsg = await Message.findOne({ twilioSid: twilioSID });
          if (existingMsg) {
            if (shouldUpdateStatus(existingMsg.status, formattedStatus)) {
              existingMsg.status = formattedStatus;
              if (formattedStatus === "READ") {
                existingMsg.read = "TRUE";
              }
              if (errorCode) {
                existingMsg.errorCode = String(errorCode);
              }
              if (errorMessage) {
                existingMsg.errorMessage = String(errorMessage);
              }
              if (channelStatusMessage) {
                existingMsg.channelStatusMessage = String(channelStatusMessage);
              }
              await existingMsg.save();
              console.log(`[WEBHOOK-STATUS] message updated | sid=${twilioSID} | status=${formattedStatus}`);
            } else {
              console.log(`[WEBHOOK-STATUS] status preserved | sid=${twilioSID} | current=${existingMsg.status} | ignored=${formattedStatus}`);
            }
            updatedDoc = existingMsg;
            targetPhone = formatForTwilio(existingMsg.phone);
            break;
          }

          const hasCampaignRec = await CampaignRecipient.exists({ twilioMessageSid: twilioSID });
          if (hasCampaignRec) break;

          await new Promise((resolve) => setTimeout(resolve, 150));
          retries--;
        }
      }

      // B. Fallback Message lookup if SID was missing
      if (!updatedDoc && targetPhone) {
        const latest = await Message.findOne({ phone: targetPhone, direction: "OUTBOUND" }).sort({ createdAt: -1 });
        if (latest && shouldUpdateStatus(latest.status, formattedStatus)) {
          latest.status = formattedStatus;
          if (!latest.twilioSid && twilioSID) latest.twilioSid = twilioSID;
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
          if (shouldUpdateStatus(recipientDoc.status, formattedStatus)) {
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
      }

      // D. Push instant chat UI update via Socket
      emitMessageStatusUpdate({
        sid: twilioSID,
        status: formattedStatus,
        phone: targetPhone,
        messageId: updatedDoc?._id?.toString() || null,
        branchId: updatedDoc?.branchId?.toString() || null,
      });
      console.log(`[WEBHOOK-STATUS] socket emitted | sid=${twilioSID} | status=${formattedStatus}`);

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
        finalStatus: updatedDoc?.status || formattedStatus,
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