import { Worker } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queueManager.js";
import connectDB from "../../../shared/lib/db/mongodb.js";
import BulkMessage from "../../../shared/models/BulkMessage.js";
import CampaignRecipient from "../../../shared/models/CampaignRecipient.js";
import Message from "../../../shared/models/Message.js";
import Customer from "../../../shared/models/Customer.js";
import { emitBulkMessageStatus, emitNewMessage } from "../../../shared/utils/socketPublisher.js";
import { normalizePhone } from "../../../shared/utils/phoneUtils.js";
import { getTwilioClient, getStatusCallbackUrl } from "../../../features/admin/services/twilioService.js";
import { syncCampaignCounts } from "../../services/campaignService.js";

/**
 * Core business function to process a campaign batch safely and idempotently.
 * Processes each recipient individually and guarantees recipient-level visibility.
 */
export async function processCampaignBatch(jobData) {
  await connectDB();

  const {
    campaignId,
    templateId,
    recipients = [],
    validation = {},
    formattedFrom,
    resolvedSender,
    sentBy = "System",
    userId = null,
  } = jobData;

  const bulkRecord = await BulkMessage.findById(campaignId);
  if (!bulkRecord) {
    console.warn(`[CampaignWorker] BulkMessage record ${campaignId} not found`);
    return { skipped: true, reason: "Campaign record not found" };
  }

  console.log(`[CampaignWorker] Processing campaign "${bulkRecord.campaignName}" (${campaignId}) with ${recipients.length} recipients...`);

  const client = getTwilioClient();
  const statusCallback = getStatusCallbackUrl();

  for (const rawTo of recipients) {
    const canonicalPhone = normalizePhone(rawTo);
    if (!canonicalPhone) continue;

    // 1. Find or create CampaignRecipient document
    let recipientDoc = await CampaignRecipient.findOne({
      campaignId: bulkRecord._id,
      normalizedPhone: canonicalPhone,
    });

    if (!recipientDoc) {
      recipientDoc = await CampaignRecipient.create({
        campaignId: bulkRecord._id,
        phone: rawTo,
        normalizedPhone: canonicalPhone,
        status: "QUEUED",
      });
    }

    // 2. Outbound Idempotency Check: Do not send if already processed or SID exists
    if (
      ["SENT", "DELIVERED", "READ", "SKIPPED"].includes(recipientDoc.status) ||
      recipientDoc.twilioMessageSid
    ) {
      console.log(`[CampaignWorker] Already processed ${canonicalPhone} for campaign ${campaignId} (status: ${recipientDoc.status}). Skipping.`);
      continue;
    }

    // 3. Check opt-out status
    const customerDoc = await Customer.findOne({ phone: canonicalPhone }).lean();
    if (customerDoc?.isOptedOut) {
      console.log(`[CampaignWorker] Recipient ${canonicalPhone} is opted out. Marking SKIPPED.`);
      recipientDoc.status = "SKIPPED";
      recipientDoc.errorMessage = "Customer opted out";
      await recipientDoc.save();
      continue;
    }

    // 4. Construct Twilio payload with status callback
    const messagePayload = {
      contentSid: templateId,
      from: formattedFrom,
      to: canonicalPhone,
      statusCallback,
    };

    if (validation.isDynamic && validation.contentVariables) {
      messagePayload.contentVariables = JSON.stringify(validation.contentVariables);
    }

    // 5. Send via Twilio API
    let sentTwilioMessage = null;
    try {
      sentTwilioMessage = await client.messages.create(messagePayload);
    } catch (sendErr) {
      console.error(`[CampaignWorker] Twilio send error for ${canonicalPhone}:`, sendErr.message);
      recipientDoc.status = "FAILED";
      recipientDoc.errorCode = String(sendErr.code || sendErr.status || "TWILIO_SEND_ERROR");
      recipientDoc.errorMessage = sendErr.message || "Twilio send failed";
      recipientDoc.failedAt = new Date();
      await recipientDoc.save().catch(() => {});
      continue;
    }

    // 6. Twilio Send SUCCESS -> Update CampaignRecipient record immediately
    const now = new Date();
    recipientDoc.twilioMessageSid = sentTwilioMessage.sid;
    recipientDoc.twilioStatus = sentTwilioMessage.status || "queued";
    recipientDoc.status = "SENT"; // Twilio accepted the outbound request
    recipientDoc.initialApiAcceptedAt = now;
    recipientDoc.sentAt = now;
    recipientDoc.errorCode = null;
    recipientDoc.errorMessage = null;

    try {
      await recipientDoc.save();
    } catch (dbSaveErr) {
      console.error(`[CampaignWorker] DB error updating recipientDoc for ${canonicalPhone}:`, dbSaveErr.message);
    }

    // 7. Persist outbound Message record in MongoDB (non-blocking ledger)
    let savedMsg = null;
    try {
      savedMsg = await Message.create({
        phone: canonicalPhone,
        message: `Campaign: ${bulkRecord.campaignName}`,
        direction: "OUTBOUND",
        status: "SENT",
        twilioSid: sentTwilioMessage.sid,
        templateSid: templateId,
        senderNumber: resolvedSender,
        senderName: sentBy,
        role: "admin",
        isTemplate: true,
        templateMetadata: {
          type: "whatsapp",
          campaignId: String(campaignId),
          recipientId: recipientDoc._id,
          templateId: templateId,
          templateName: bulkRecord.campaignName,
          source: "campaign",
          variables: validation?.contentVariables || null,
        },
        timestamp: now,
      });
    } catch (msgCreateErr) {
      console.error(`[CampaignWorker] Message persistence error for ${canonicalPhone} (Twilio SID: ${sentTwilioMessage.sid}):`, msgCreateErr.message);
    }

    // 8. Update Customer last interaction
    if (customerDoc?._id) {
      try {
        await Customer.updateOne(
          { _id: customerDoc._id },
          { $set: { lastInteractionAt: now } }
        );
      } catch (custErr) {
        console.warn(`[CampaignWorker] Customer lastInteractionAt update notice for ${canonicalPhone}:`, custErr.message);
      }
    }

    // 9. Emit realtime new message event to CRM chat
    try {
      const branchId = customerDoc?.branchId
        ? (customerDoc.branchId._id ? customerDoc.branchId._id.toString() : customerDoc.branchId.toString())
        : null;

      emitNewMessage(
        {
          _id: savedMsg?._id ? savedMsg._id.toString() : `camp_${sentTwilioMessage.sid}`,
          customerId: customerDoc?._id ? customerDoc._id.toString() : undefined,
          phone: canonicalPhone,
          canonicalPhone,
          name: customerDoc?.name || canonicalPhone,
          message: `Campaign: ${bulkRecord.campaignName}`,
          direction: "OUTBOUND",
          timestamp: now.toISOString(),
          status: "SENT",
          role: "admin",
          sendBy: userId ? { _id: userId, name: sentBy } : null,
          twilioSid: sentTwilioMessage.sid,
          branchId,
          isTemplate: true,
          templateMetadata: {
            type: "whatsapp",
            campaignId: String(campaignId),
            recipientId: recipientDoc._id.toString(),
            templateId,
            templateName: bulkRecord.campaignName,
            source: "campaign",
          },
        },
        branchId
      );
    } catch (socketErr) {
      console.warn("[CampaignWorker] Realtime socket emit notice:", socketErr.message);
    }
  }

  // 10. Recompute and sync atomic counts to BulkMessage
  const syncSummary = await syncCampaignCounts(campaignId);

  // 11. Broadcast comprehensive campaign status update
  try {
    emitBulkMessageStatus({
      campaignId: bulkRecord._id.toString(),
      campaignName: bulkRecord.campaignName,
      status: syncSummary?.isCompleted ? "COMPLETED" : "processing",
      counts: syncSummary?.counts || {},
      successfulSends: syncSummary?.successfulSends || 0,
      failedSends: syncSummary?.failedSends || 0,
      deliveredCount: syncSummary?.deliveredCount || 0,
      readCount: syncSummary?.readCount || 0,
      undeliveredCount: syncSummary?.undeliveredCount || 0,
      skippedCount: syncSummary?.skippedCount || 0,
      total: syncSummary?.total || recipients.length,
      progress: syncSummary?.progress || 0,
    });
  } catch (e) {
    console.warn("[CampaignWorker] Socket status broadcast notice:", e.message);
  }

  console.log(`[CampaignWorker] Campaign "${bulkRecord.campaignName}" (${campaignId}) batch synced:`, syncSummary?.counts);
  return { success: true, campaignId, syncSummary };
}

export function createCampaignWorker() {
  const connection = getRedisConnectionOptions();
  const concurrency = parseInt(process.env.CAMPAIGN_WORKER_CONCURRENCY || "3", 10);

  const worker = new Worker(
    QUEUE_NAMES.CAMPAIGN,
    async (job) => {
      console.log(`[CampaignWorker] job received | jobId=${job.id} | campaignId=${job.data?.campaignId}`);
      return await processCampaignBatch(job.data);
    },
    {
      connection,
      concurrency,
    }
  );

  worker.on("error", () => {
    // Suppress unhandled EventEmitter errors when Redis is offline in dev
  });

  worker.on("failed", (job, err) => {
    console.error(
      `❌ [CampaignWorker] Job failed | jobId=${job?.id} | campaignId=${job?.data?.campaignId}:`,
      err?.message
    );
  });

  return worker;
}

export default createCampaignWorker;
