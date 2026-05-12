import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
<<<<<<< HEAD
  phone: { type: String, required: true, index: true }, 
=======
  phone: { type: String, required: true, index: true },
>>>>>>> c1be5bc (Initial commit from new system)
  message: { type: String },
  direction: { type: String, enum: ['INBOUND', 'OUTBOUND'], required: true },
  status: { type: String, default: 'RECEIVED' },
  read: { type: String, enum: ['TRUE', 'FALSE'], default: 'FALSE' },
  twilioSid: { type: String, index: true },
  mediaUrl: { type: String },
  mediaType: { type: String },
  senderName: { type: String },
<<<<<<< HEAD
  timestamp: { type: Date, default: Date.now, index: true } 
=======
  isChatClosed: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now, index: true }
>>>>>>> c1be5bc (Initial commit from new system)
}, { timestamps: true });

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);