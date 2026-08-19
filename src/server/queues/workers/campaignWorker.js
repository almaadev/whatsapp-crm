import { Worker } from "bullmq";
import { QUEUE_NAMES, getRedisConnectionOptions } from "../queueManager.js";
import connectDB from "../../../shared/lib/db/mongodb.js";
import BulkMessage from "../../../shared/models/BulkMessage.js";
import Message from "../../../shared/models/Message.js";
import Customer from "../../../shared/models/Customer.js";
import twilio from "twilio";
import { emitBulkMessageStatus, emitNewMessage } from "../../../shared/utils/socketPublisher.js";
import { normalizePhone } from "../../../shared/utils/phoneUtils.js";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Core business function to process a campaign batch safely and idempotently.
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

  let successCount = 0;
  let failedCount = 0;

  for (const formattedTo of recipients) {
    try {
      // 1. Check opt-out status
      const customerDoc = await Customer.findOne({ phone: formattedTo }).lean();
      if (customerDoc?.isOptedOut) {
        console.log(`[CampaignWorker] Recipient ${formattedTo} is opted out. Skipping.`);
        continue;
      }

      // 2. Outbound Idempotency Check: Prevent duplicate sends for the same campaign
      const existingSent = await Message.findOne({
        phone: formattedTo,
        "templateMetadata.campaignId": String(campaignId),
      }).lean();

      if (existingSent) {
        console.log(`[CampaignWorker] Already sent to ${formattedTo} for campaign ${campaignId}. Skipping.`);
        successCount++;
        continue;
      }

      // 3. Construct Twilio payload
      const messagePayload = {
        contentSid: templateId,
        from: formattedFrom,
        to: formattedTo,
      };

      if (validation.isDynamic && validation.contentVariables) {
        messagePayload.contentVariables = JSON.stringify(validation.contentVariables);
      }

      // 4. Send via Twilio
      const sent = await client.messages.create(messagePayload);

      // 5. Persist outbound Message record in MongoDB
      const isoTimestamp = new Date().toISOString();
      const savedMsg = await Message.create({
        phone: formattedTo,
        message: `Campaign: ${bulkRecord.campaignName}`,
        direction: "OUTBOUND",
        status: "SENT",
        twilioSid: sent.sid,
        senderNumber: resolvedSender,
        senderName: sentBy,
        role: "admin",
        isTemplate: true,
        templateMetadata: {
          type: "whatsapp",
          campaignId: String(campaignId),
          templateId,
        },
        timestamp: new Date(isoTimestamp),
      });

      // 6. Update Customer last interaction
      if (customerDoc?._id) {
        await Customer.updateOne(
          { _id: customerDoc._id },
          { $set: { lastInteractionAt: new Date() } }
        );
      }

      // 7. Emit realtime message update to CRM UI
      try {
        const branchId = customerDoc?.branchId
          ? (customerDoc.branchId._id ? customerDoc.branchId._id.toString() : customerDoc.branchId.toString())
          : null;

        emitNewMessage(
          {
            _id: savedMsg._id.toString(),
            customerId: customerDoc?._id ? customerDoc._id.toString() : undefined,
            phone: formattedTo,
            canonicalPhone: normalizePhone(formattedTo),
            name: customerDoc?.name || formattedTo,
            message: `Campaign: ${bulkRecord.campaignName}`,
            direction: "OUTBOUND",
            timestamp: isoTimestamp,
            status: "SENT",
            role: "admin",
            sendBy: userId ? { _id: userId, name: sentBy } : null,
            twilioSid: sent.sid,
            branchId,
            isTemplate: true,
          },
          branchId
        );
      } catch (socketErr) {
        console.error("[CampaignWorker] Socket emit error:", socketErr.message);
      }

      successCount++;
    } catch (sendErr) {
      console.error(`[CampaignWorker] Error sending to ${formattedTo}:`, sendErr.message);
      failedCount++;
    }
  }

  // Update BulkMessage state in MongoDB
  bulkRecord.successfulSends = (bulkRecord.successfulSends || 0) + successCount;
  bulkRecord.failedSends = (bulkRecord.failedSends || 0) + failedCount;
  bulkRecord.status = "COMPLETED";
  await bulkRecord.save();

  // Broadcast overall bulk message status
  try {
    emitBulkMessageStatus({
      campaignId: bulkRecord._id.toString(),
      campaignName: bulkRecord.campaignName,
      status: "COMPLETED",
      successfulSends: bulkRecord.successfulSends,
      failedSends: bulkRecord.failedSends,
      total: recipients.length,
    });
  } catch (e) {}

  console.log(`[CampaignWorker] Campaign "${bulkRecord.campaignName}" completed: ${successCount} successful, ${failedCount} failed.`);
  return { success: true, campaignId, successCount, failedCount };
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
