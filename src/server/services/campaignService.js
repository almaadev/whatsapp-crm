import mongoose from "mongoose";
import BulkMessage from "../../shared/models/BulkMessage.js";
import CampaignRecipient from "../../shared/models/CampaignRecipient.js";

/**
 * Recomputes and atomically syncs CampaignRecipient status counts to the parent BulkMessage record.
 * Returns the computed count breakdown.
 */
export async function syncCampaignCounts(campaignId) {
  if (!campaignId) return null;
  const objId = typeof campaignId === "string" ? new mongoose.Types.ObjectId(campaignId) : campaignId;

  const grouped = await CampaignRecipient.aggregate([
    { $match: { campaignId: objId } },
    { $group: { _id: "$status", count: { $sum: 1 }, phones: { $push: "$normalizedPhone" } } },
  ]);

  const map = {
    QUEUED: 0,
    ACCEPTED: 0,
    SENDING: 0,
    SENT: 0,
    DELIVERED: 0,
    READ: 0,
    FAILED: 0,
    UNDELIVERED: 0,
    SKIPPED: 0,
  };

  const successfulRecipients = [];
  const failedRecipients = [];
  const skippedRecipients = [];

  let total = 0;
  for (const item of grouped) {
    if (map[item._id] !== undefined) {
      map[item._id] = item.count;
    }
    total += item.count;

    if (["SENT", "DELIVERED", "READ"].includes(item._id)) {
      successfulRecipients.push(...(item.phones || []));
    } else if (["FAILED", "UNDELIVERED"].includes(item._id)) {
      failedRecipients.push(...(item.phones || []));
    } else if (item._id === "SKIPPED") {
      skippedRecipients.push(...(item.phones || []));
    }
  }

  const successfulSends = map.SENT + map.DELIVERED + map.READ;
  const failedSends = map.FAILED + map.UNDELIVERED;
  const processingCount = map.QUEUED + map.ACCEPTED + map.SENDING;
  const isCompleted = processingCount === 0;

  await BulkMessage.findByIdAndUpdate(objId, {
    $set: {
      totalRecipients: total,
      successfulSends,
      failedSends,
      deliveredCount: map.DELIVERED,
      readCount: map.READ,
      undeliveredCount: map.UNDELIVERED,
      skippedCount: map.SKIPPED,
      successfulRecipients,
      failedRecipients,
      skippedRecipients,
      ...(isCompleted ? { status: "COMPLETED" } : { status: "processing" }),
    },
  });

  return {
    campaignId: objId.toString(),
    total,
    counts: {
      total,
      queued: map.QUEUED,
      accepted: map.ACCEPTED,
      sending: map.SENDING,
      sent: map.SENT,
      delivered: map.DELIVERED,
      read: map.READ,
      failed: map.FAILED,
      undelivered: map.UNDELIVERED,
      skipped: map.SKIPPED,
      processing: processingCount,
      successful: successfulSends,
    },
    successfulSends,
    failedSends,
    deliveredCount: map.DELIVERED,
    readCount: map.READ,
    undeliveredCount: map.UNDELIVERED,
    skippedCount: map.SKIPPED,
    processingCount,
    isCompleted,
    progress: total > 0 ? Math.round(((successfulSends + failedSends + map.SKIPPED) / total) * 100) : 0,
  };
}

export default {
  syncCampaignCounts,
};
