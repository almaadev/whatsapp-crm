import mongoose from "mongoose";

const BulkMessageSchema = new mongoose.Schema({
    campaignName: { type: String, required: true }, // 🚀 NEW
    templateId: { type: String }, // 🚀 NEW: Link to Twilio SID
    recipients: [{ type: String }], // 🚀 NEW: Array of sent numbers
    successfulSends: { type: Number, default: 0 },
    failedSends: { type: Number, default: 0 },
    status: { type: String, default: "pending" },
    sentAt: { type: Date, default: Date.now },
    sentBy: { type: String }, // Track who sent it
    senderNumber: { type: String },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    errorMessage: { type: String, default: null },
}, { timestamps: true });

export default mongoose.models.BulkMessage || mongoose.model("BulkMessage", BulkMessageSchema);