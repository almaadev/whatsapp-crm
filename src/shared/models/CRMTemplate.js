import mongoose from "mongoose";

const VariableSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, trim: true },
    source: { type: String, trim: true },
    required: { type: Boolean, default: false },
    fallback: { type: String, default: "" },
  },
  { _id: false }
);

const CRMTemplateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Template name is required"],
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
    },
    body: {
      type: String,
      required: [true, "Template message body is required"],
    },
    category: {
      type: String,
      default: "General",
      trim: true,
      index: true,
    },
    variables: {
      type: [VariableSchema],
      default: [],
    },
    version: {
      type: Number,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Auto-generate slug from name before saving
CRMTemplateSchema.pre("save", function () {
  if (this.isModified("name") && !this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }
});

if (process.env.NODE_ENV === "development" && mongoose.models.CRMTemplate) {
  delete mongoose.models.CRMTemplate;
}

export default mongoose.models.CRMTemplate || mongoose.model("CRMTemplate", CRMTemplateSchema);
