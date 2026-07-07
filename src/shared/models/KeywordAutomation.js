import mongoose from "mongoose";

const KeywordAutomationSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Keyword is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    templateSid: {
      type: String,
      required: [true, "Template SID is required"],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

delete mongoose.models.KeywordAutomation;
export default mongoose.models.KeywordAutomation ||
  mongoose.model("KeywordAutomation", KeywordAutomationSchema);