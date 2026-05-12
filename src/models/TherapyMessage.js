import mongoose from "mongoose";
const TherapyMessageSchema = new mongoose.Schema({
<<<<<<< HEAD
    phone: { type: String, required: true }, 
    message: { type: String }, 
    direction: { type: String, enum: ["INBOUND", "OUTBOUND"] }, 
    status: { type: String }, 
    read: { type: String, default: "FALSE" }, 
    twilioSid: { type: String }, 
    mediaUrl: { type: String }, 
    mediaType: { type: String }, 
    senderName: { type: String }
=======
  phone: { type: String, required: true, index: true },
  message: { type: String },
  direction: { type: String, enum: ['INBOUND', 'OUTBOUND'], required: true },
  status: { type: String, default: 'RECEIVED' },
  read: { type: String, enum: ['TRUE', 'FALSE'], default: 'FALSE' },
  twilioSid: { type: String, index: true },
  mediaUrl: { type: String },
  mediaType: { type: String },
  senderName: { type: String },
  isChatClosed: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now, index: true }
>>>>>>> c1be5bc (Initial commit from new system)
}, { timestamps: true });
if (mongoose.models.TherapyMessage) {
    delete mongoose.models.TherapyMessage;
}
export default mongoose.models.TherapyMessage || mongoose.model("TherapyMessage", TherapyMessageSchema);