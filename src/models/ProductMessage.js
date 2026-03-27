import mongoose from "mongoose";
const ProductMessageSchema = new mongoose.Schema({
    phone: { type: String, required: true }, 
    message: { type: String }, 
    direction: { type: String, enum: ["INBOUND", "OUTBOUND"] }, 
    status: { type: String }, 
    read: { type: String, default: "FALSE" }, 
    twilioSid: { type: String }, 
    mediaUrl: { type: String }, 
    mediaType: { type: String }, 
    senderName: { type: String }
}, { timestamps: true });

if (mongoose.models.ProductMessage) {
    delete mongoose.models.ProductMessage;
}

export default mongoose.models.ProductMessage || mongoose.model("ProductMessage", ProductMessageSchema);