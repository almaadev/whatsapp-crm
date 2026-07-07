import mongoose from "mongoose";

const TemplateSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    sid: { 
      type: String, 
      required: true, 
      unique: true, 
      index: true,
      trim: true
    },
    templateType: {
      type: String,
      default: 'TEXT'
    },
    language: {
      type: String,
      default: 'en'
    },
    body: {
      type: String,
      required: true
    },
    mediaUrl: {
      type: String,
      default: ""
    },
    buttons: {
      type: Array, // Array of { type, title, value }
      default: []
    },
    category: { 
      type: String, 
      default: "UTILITY" 
    },
    approvalStatus: {
      type: String,
      default: "pending"
    },
    createdBy: { 
      type: String, 
      default: "system" 
    }
  },
  { timestamps: true }
);

delete mongoose.models.Template;
export default mongoose.models.Template || mongoose.model("Template", TemplateSchema);