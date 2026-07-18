import mongoose from "mongoose";
const MDCampMessageSchema = new mongoose.Schema({
    phone: { type: String, required: true, index: true },
    message: { type: String },
    direction: { type: String, enum: ['INBOUND', 'OUTBOUND'], required: true },
    status: { type: String, default: 'RECEIVED' },
    read: { type: String, enum: ['TRUE', 'FALSE'], default: 'FALSE' },
    twilioSid: { type: String, index: true },
    chatType: { type: String, default: "Direct Lead" },
    isTemplate: { type: Boolean, default: false },
    templateSid: { type: String },
    associateName: { type: String },
    role: { type: String, default: "associate" },
    mediaUrl: { type: String },
    mediaType: { type: String },
    senderName: { type: String },
    sendBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    isChatClosed: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now, index: true }
}, { timestamps: true });

if (mongoose.models.MDCampMessage) {
    delete mongoose.models.MDCampMessage;
}
export default mongoose.models.MDCampMessage || mongoose.model("MDCampMessage", MDCampMessageSchema);