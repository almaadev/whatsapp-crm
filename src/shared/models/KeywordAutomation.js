import mongoose from "mongoose";

const KeywordAutomationSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      trim: true,
      lowercase: true,
    },
    keywords: {
      type: [String],
      default: [],
    },
    templateType: {
      type: String,
      enum: ["whatsapp", "crm"],
      default: "whatsapp",
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CRMTemplate",
      default: null,
    },
    templateSid: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

KeywordAutomationSchema.index({ keywords: 1 });

delete mongoose.models.KeywordAutomation;
const Model = mongoose.models.KeywordAutomation ||
  mongoose.model("KeywordAutomation", KeywordAutomationSchema);

// Safely drop legacy unique index key_1
Model.collection.dropIndex("key_1").catch(() => {});

export default Model;