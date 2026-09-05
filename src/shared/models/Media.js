import mongoose from "mongoose";

const MediaSchema = new mongoose.Schema(
  {
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lead",
      index: true,
    },
    phone: {
      type: String,
      index: true,
    },
    senderPhone: {
      type: String,
    },
    recipientPhone: {
      type: String,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    direction: {
      type: String,
      enum: ["INBOUND", "OUTBOUND"],
      default: "OUTBOUND",
      index: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video", "audio", "document", "pdf"],
      required: true,
      index: true,
    },
    fileType: {
      type: String,
      default: "image",
    },
    mimeType: {
      type: String,
      required: true,
    },
    extension: {
      type: String,
    },
    originalFilename: {
      type: String,
      required: true,
    },
    originalFileName: {
      type: String,
    },
    filename: {
      type: String,
    },
    cloudinaryUrl: {
      type: String,
      required: true,
    },
    secureUrl: {
      type: String,
      default: function () {
        return this.cloudinaryUrl || "";
      },
    },
    cloudinaryPublicId: {
      type: String,
      required: true,
      index: true,
    },
    publicId: {
      type: String,
      default: function () {
        return this.cloudinaryPublicId || "";
      },
    },
    cloudinaryResourceType: {
      type: String,
      enum: ["image", "video", "raw"],
      default: "image",
    },
    resourceType: {
      type: String,
      enum: ["image", "video", "raw"],
      default: "image",
    },
    folder: {
      type: String,
      default: function () {
        if (this.mediaType === "document" || this.mimeType === "application/pdf") return "whatsapp-crm/documents";
        if (this.mediaType === "video") return "whatsapp-crm/videos";
        if (this.mediaType === "audio") return "whatsapp-crm/audio";
        return "whatsapp-crm/images";
      },
    },
    format: {
      type: String,
    },
    size: {
      type: Number,
      default: 0,
      index: true,
    },
    fileSize: {
      type: Number,
      default: 0,
      index: true,
    },
    duration: {
      type: Number,
      default: 0,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "DELETED"],
      default: "ACTIVE",
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    expiresAt: {
      type: Date,
      default: function () {
        return new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      },
      index: true,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Pre-save synchronization hook for field aliases and standard folder/resourceType mapping
MediaSchema.pre("save", function () {
  const resolvedName = this.originalFilename || this.originalFileName || this.filename || "file";
  this.originalFilename = resolvedName;
  this.originalFileName = resolvedName;
  this.filename = resolvedName;

  if (!this.extension && resolvedName.includes(".")) {
    this.extension = `.${resolvedName.split(".").pop()}`;
  }

  // Ensure size & fileSize are synchronized
  const resolvedSize = this.size || this.fileSize || 0;
  this.size = resolvedSize;
  this.fileSize = resolvedSize;

  // Ensure publicId & cloudinaryPublicId are synchronized
  const resolvedPublicId = this.cloudinaryPublicId || this.publicId || "";
  this.cloudinaryPublicId = resolvedPublicId;
  this.publicId = resolvedPublicId;

  // Ensure secureUrl & cloudinaryUrl are synchronized
  const resolvedUrl = this.secureUrl || this.cloudinaryUrl || "";
  this.secureUrl = resolvedUrl;
  this.cloudinaryUrl = resolvedUrl;

  // Ensure createdBy & uploadedBy are synchronized
  if (this.uploadedBy && !this.createdBy) {
    this.createdBy = this.uploadedBy;
  }
  if (this.createdBy && !this.uploadedBy) {
    this.uploadedBy = this.createdBy;
  }

  // Ensure PDFs/documents are consistently classified
  if (
    this.extension?.toLowerCase() === ".pdf" ||
    this.mimeType === "application/pdf" ||
    this.mediaType === "document" ||
    this.mediaType === "pdf"
  ) {
    this.resourceType = "raw";
    this.cloudinaryResourceType = "raw";
    this.mediaType = "document";
    this.fileType = "document";
    this.mimeType = "application/pdf";
    this.extension = ".pdf";
    this.folder = "whatsapp-crm/documents";
    if (!this.format) this.format = "pdf";
  } else if (this.mediaType === "video" || this.mimeType?.startsWith("video/")) {
    this.resourceType = "video";
    this.cloudinaryResourceType = "video";
    this.mediaType = "video";
    this.fileType = "video";
    this.folder = "whatsapp-crm/videos";
  } else if (this.mediaType === "audio" || this.mimeType?.startsWith("audio/")) {
    this.resourceType = "video";
    this.cloudinaryResourceType = "video";
    this.mediaType = "audio";
    this.fileType = "audio";
    this.folder = "whatsapp-crm/audio";
  } else {
    this.resourceType = "image";
    this.cloudinaryResourceType = "image";
    this.mediaType = "image";
    this.fileType = "image";
    this.folder = "whatsapp-crm/images";
  }

  const resolvedResType = this.cloudinaryResourceType || this.resourceType || "image";
  this.cloudinaryResourceType = resolvedResType;
  this.resourceType = resolvedResType;

  if (!this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  }
});

/**
 * Migration helper to repair legacy PDF records stored with incorrect resourceType.
 */
MediaSchema.statics.repairLegacyPdfRecords = async function () {
  return this.updateMany(
    {
      $or: [
        { mimeType: "application/pdf" },
        { extension: ".pdf" },
        { originalFileName: /\.pdf$/i },
        { originalFilename: /\.pdf$/i },
      ],
      $or: [
        { resourceType: { $ne: "raw" } },
        { cloudinaryResourceType: { $ne: "raw" } },
        { folder: { $ne: "whatsapp-crm/documents" } },
      ],
    },
    {
      $set: {
        resourceType: "raw",
        cloudinaryResourceType: "raw",
        mediaType: "document",
        fileType: "document",
        mimeType: "application/pdf",
        extension: ".pdf",
        folder: "whatsapp-crm/documents",
        format: "pdf",
      },
    }
  );
};

// Compound indexes for admin filtering and cleanup queries
MediaSchema.index({ status: 1, expiresAt: 1 });
MediaSchema.index({ phone: 1, createdAt: -1 });
MediaSchema.index({ mediaType: 1, createdAt: -1 });
MediaSchema.index({ folder: 1 });

if (mongoose.models.Media) {
  delete mongoose.models.Media;
}

export default mongoose.models.Media || mongoose.model("Media", MediaSchema);
