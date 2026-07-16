import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
    },
    direction: {
      type: String,
      enum: ["INBOUND", "OUTBOUND"],
      required: true,
    },
    status: {
      type: String,
      default: "RECEIVED",
    },
    read: {
      type: String,
      enum: ["TRUE", "FALSE"],
      default: "FALSE",
    },
    twilioSid: {
      type: String,
      index: true,
    },
    chatType: {
      type: String,
      default: "Direct Lead",
    },
    isTemplate: {
      type: Boolean,
      default: false,
    },
    templateSid: {
      type: String,
    },
    isAutomated: {
      type: Boolean,
      default: false,
    },
    templateSid: {
      type: String,
      default: "",
    },
    source: {
      type: String,
      default: "",
    },
    associateName: {
      type: String,
    },
    role: {
      type: String,
      default: "associate",
    },
    mediaUrl: {
      type: String,
    },
    mediaType: {
      type: String,
    },
    senderName: {
      type: String,
    },
    isChatClosed: {
      type: Boolean,
      default: false,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

<<<<<<< HEAD
export default mongoose.models.Message || mongoose.model("Message", MessageSchema);
=======
export default mongoose.models.Message ||
  mongoose.model("Message", MessageSchema);
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
