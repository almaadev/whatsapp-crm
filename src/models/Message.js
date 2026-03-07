import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true }, // Index added for fast lookup
  message: { type: String },
  direction: { type: String, enum: ['INBOUND', 'OUTBOUND'], required: true },
  status: { type: String, default: 'RECEIVED' },
  twilioSid: { type: String, index: true }, // 🚀 CRITICAL: Faster Delivery Status Updates
  mediaUrl: { type: String },
  mediaType: { type: String },
  senderName: { type: String },
  timestamp: { type: Date, default: Date.now, index: true } // Index for fast sorting
}, { timestamps: true });

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);