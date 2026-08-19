import mongoose from "mongoose";

const WebhookEventSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      default: "twilio",
      required: true,
    },
    eventId: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      default: "inbound_whatsapp",
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      default: "queued",
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

WebhookEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

if (process.env.NODE_ENV === "development" && mongoose.models.WebhookEvent) {
  delete mongoose.models.WebhookEvent;
}

export default mongoose.models.WebhookEvent || mongoose.model("WebhookEvent", WebhookEventSchema);
