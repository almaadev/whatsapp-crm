import { NextResponse } from "next/server.js";
import connectDB from "../../../../shared/lib/db/mongodb.js";
import Message from "../../../../shared/models/Message.js";
import CampaignRecipient from "../../../../shared/models/CampaignRecipient.js";
import redis from "../../../../shared/lib/db/redis.js";
import { syncCampaignCounts } from "../../../../server/services/campaignService.js";
import { emitMessageStatusUpdate } from "../../../../shared/utils/socketPublisher.js";
import { formatForTwilio } from "../../../../shared/utils/phoneUtils.js";
import { validateTwilioWebhookSignature } from "../../../../shared/utils/twilioValidator.js";

// All Twilio Outbound Statuses
const TWILIO_STATUSES = [
  "queued", "sending", "sent", "failed", "delivered", "undelivered", 
  "read", "partially_delivered", "canceled"
];

// Explicit State Machine: Strict allowed transitions
export const ALLOWED_TRANSITIONS = {
  QUEUED: new Set(["QUEUED", "SENDING", "SENT", "DELIVERED", "READ", "UNDELIVERED", "FAILED", "CANCELED"]),
  SENDING: new Set(["SENDING", "SENT", "DELIVERED", "READ", "UNDELIVERED", "FAILED", "CANCELED"]),
  SENT: new Set(["SENT", "DELIVERED", "READ", "UNDELIVERED", "FAILED", "CANCELED"]),
  DELIVERED: new Set(["DELIVERED", "READ", "UNDELIVERED", "FAILED"]),
  READ: new Set(["READ"]),
  UNDELIVERED: new Set(["UNDELIVERED", "FAILED"]),
  FAILED: new Set(["FAILED", "UNDELIVERED"]),
  CANCELED: new Set(["CANCELED"]),
};

export function shouldUpdateStatus(currentStatus, newStatus) {
  if (!currentStatus) return true;
  if (!newStatus) return false;

  const curr = currentStatus.toUpperCase().trim();
  const next = newStatus.toUpperCase().trim();

  if (curr === next) return true;

  // Strict transition enforcement from explicit state machine:
  // - READ cannot regress to DELIVERED/SENT/QUEUED/SENDING
  // - DELIVERED cannot regress to SENT/QUEUED/SENDING
  // - FAILED/UNDELIVERED cannot regress to SENT/QUEUED/SENDING
  const allowed = ALLOWED_TRANSITIONS[curr];
  return allowed ? allowed.has(next) : true;
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

    const twilioSID = (body.MessageSid || body.SmsSid || body.sid || "").trim();
    const eventType = (body.EventType || body.eventType || "").trim().toUpperCase();
    let rawStatus = (body.MessageStatus || body.SmsStatus || body.status || "").trim();

    // WhatsApp read receipts send EventType=READ (or EventType=read)
    if (eventType === "READ" || rawStatus.toLowerCase() === "read") {
      rawStatus = "read";
    }

    const messageStatus = rawStatus;
    const errorCode = body.ErrorCode || body.errorCode || null;
    const errorMessage = body.ErrorMessage || body.errorMessage || body.ChannelStatusMessage || null;
    const channelStatusMessage = body.ChannelStatusMessage || null;

    console.log(`[WEBHOOK-STATUS] received | sid=${twilioSID} | status=${messageStatus} | eventType=${eventType || "none"} | to=${body.To || body.to}`);

    // Signature Validation via Twilio SDK using canonical URL
    // In production, signature validation is mandatory and never bypassed
    const isProduction = process.env.NODE_ENV === "production";
    const shouldValidate = isProduction || process.env.TWILIO_VALIDATE_SIGNATURE !== "false";

    if (shouldValidate) {
      const isValid = validateTwilioWebhookSignature(req, body);
      if (!isValid) {
        console.warn(`[WEBHOOK-STATUS] signature: INVALID for SID ${twilioSID}`);
        return NextResponse.json({ success: false, error: "Invalid Twilio Signature" }, { status: 403 });
      }
      console.log(`[WEBHOOK-STATUS] signature: VALID`);
    } else {
      console.log(`[WEBHOOK-STATUS] signature: SKIPPED (development mode with explicit bypass)`);
    }

    if (messageStatus && TWILIO_STATUSES.includes(messageStatus.toLowerCase())) {
      const formattedStatus = messageStatus.toUpperCase();
      let rawTargetPhone = body.To || body.to || null;
      let targetPhone = rawTargetPhone ? formatForTwilio(rawTargetPhone) : null;
      let updatedDoc = null;

      // A. Update individual Message ledger in MongoDB
      if (twilioSID) {
        let retries = 2;
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
              console.log(`[WEBHOOK-STATUS] status preserved by state machine | sid=${twilioSID} | current=${existingMsg.status} | ignored=${formattedStatus}`);
            }
            updatedDoc = existingMsg;
            targetPhone = formatForTwilio(existingMsg.phone);
            break;
          }

          const hasCampaignRec = await CampaignRecipient.exists({ twilioMessageSid: twilioSID });
          if (hasCampaignRec) break;

          await new Promise((resolve) => setTimeout(resolve, 100));
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

      // E. Non-blocking Redis Cache Invalidation
      if (redis && redis.status !== "disabled") {
        redis.del("chats:all_data").catch(() => {});
        redis.del("chats:main_inbox_data").catch(() => {});
      }

      // Prompt 200 OK response to Twilio
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