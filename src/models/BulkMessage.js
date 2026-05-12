import mongoose from "mongoose";

const BulkMessageSchema = new mongoose.Schema({
    status: { type: String, default: "pending" },
    body: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    accountSid: { type: String, required: true },
    errorMessage: { type: String, default: null },
    errorCode: { type: String, default: null },
}, { timestamps: true });

export default mongoose.models.BulkMessage || mongoose.model("BulkMessage", BulkMessageSchema);