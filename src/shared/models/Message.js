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
    senderType: {
      type: String,
      default: "",
    },
    sendBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    receivedOnNumber: {
      type: String,
      index: true,
    },
    senderNumber: {
      type: String,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      index: true,
    },
    twilioNumberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TwilioNumber",
      index: true,
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

if (process.env.NODE_ENV === "development" && mongoose.models.Message) {
  delete mongoose.models.Message;
}

export default mongoose.models.Message || mongoose.model("Message", MessageSchema);
