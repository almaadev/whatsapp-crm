import mongoose from "mongoose";

const BulkMessageSchema = new mongoose.Schema(
  {
    campaignName: { type: String, required: true },
    templateId: { type: String },
    recipients: [{ type: String }],
    successfulRecipients: [{ type: String }],
    failedRecipients: [{ type: String }],
    skippedRecipients: [{ type: String }],
    totalRecipients: { type: Number, default: 0 },
    successfulSends: { type: Number, default: 0 }, // SENT + DELIVERED + READ
    failedSends: { type: Number, default: 0 },     // FAILED + UNDELIVERED
    deliveredCount: { type: Number, default: 0 },
    readCount: { type: Number, default: 0 },
    undeliveredCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    status: { type: String, default: "processing" },
    sourceCampaignId: { type: mongoose.Schema.Types.ObjectId, ref: "BulkMessage", default: null },
    sourceCampaignName: { type: String, default: null },
    recallType: { type: String, enum: ["SUCCESSFUL_ONLY", "CUSTOM", null], default: null },
    sentAt: { type: Date, default: Date.now },
    sentBy: { type: String, default: "System" },
    senderNumber: { type: String },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    errorMessage: { type: String, default: null },
  },
  { timestamps: true }
);

if (process.env.NODE_ENV === "development" && mongoose.models.BulkMessage) {
  delete mongoose.models.BulkMessage;
}

export default mongoose.models.BulkMessage || mongoose.model("BulkMessage", BulkMessageSchema);