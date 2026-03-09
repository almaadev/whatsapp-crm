import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true }, 
  message: { type: String },
  direction: { type: String, enum: ['INBOUND', 'OUTBOUND'], required: true },
  status: { type: String, default: 'RECEIVED' },
  twilioSid: { type: String, index: true },
  mediaUrl: { type: String },
  mediaType: { type: String },
  senderName: { type: String },
  timestamp: { type: Date, default: Date.now, index: true } 
}, { timestamps: true });

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);