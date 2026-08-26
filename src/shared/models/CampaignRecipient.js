import mongoose from "mongoose";

const CampaignRecipientSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BulkMessage",
      required: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
    },
    normalizedPhone: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "QUEUED",
        "ACCEPTED",
        "SENDING",
        "SENT",
        "DELIVERED",
        "READ",
        "FAILED",
        "UNDELIVERED",
        "SKIPPED",
      ],
      default: "QUEUED",
      index: true,
    },
    twilioMessageSid: {
      type: String,
      default: null,
      index: true,
    },
    twilioStatus: {
      type: String,
      default: null,
    },
    errorCode: {
      type: String,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
    initialApiAcceptedAt: {
      type: Date,
      default: null,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound unique index: Ensure no duplicate recipient per campaign
CampaignRecipientSchema.index({ campaignId: 1, normalizedPhone: 1 }, { unique: true });

if (process.env.NODE_ENV === "development" && mongoose.models.CampaignRecipient) {
  delete mongoose.models.CampaignRecipient;
}

export default mongoose.models.CampaignRecipient ||
  mongoose.model("CampaignRecipient", CampaignRecipientSchema);
