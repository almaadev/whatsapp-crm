import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  recipientUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },

  type: {
    type: String,
    required: true,
    index: true
  },

  title: {
    type: String,
    required: true
  },

  message: {
    type: String,
    default: ""
  },

  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    default: null,
    index: true
  },

  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lead",
    default: null
  },

  phone: {
    type: String,
    default: null,
    index: true
  },

  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    default: null,
    index: true
  },

  branchName: {
    type: String,
    default: ""
  },

  isRead: {
    type: Boolean,
    default: false,
    index: true
  },

  isDismissed: {
    type: Boolean,
    default: false,
    index: true
  },

  readAt: {
    type: Date,
    default: null
  },

  dismissedAt: {
    type: Date,
    default: null
  },

  senderName: {
    type: String,
    default: ""
  },

  messageCount: {
    type: Number,
    default: 1
  },

  latestMessage: {
    type: String,
    default: ""
  },

  latestMessageAt: {
    type: Date,
    default: null
  },

  sourceMessageId: {
    type: String,
    default: null,
    index: true
  },

  sourceEventId: {
    type: String,
    default: null,
    index: true
  },

  entityType: {
    type: String,
    default: ""
  },

  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },

  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

// Compound Indexes for fast queries
NotificationSchema.index({ recipientUserId: 1, customerId: 1, isDismissed: 1 });
NotificationSchema.index({ recipientUserId: 1, phone: 1, isDismissed: 1 });
NotificationSchema.index({ recipientUserId: 1, isDismissed: 1, createdAt: -1 });
NotificationSchema.index({ recipientUserId: 1, isRead: 1 });
NotificationSchema.index({ recipientUserId: 1, type: 1 });
NotificationSchema.index({ recipientUserId: 1, sourceMessageId: 1 });

if (mongoose.models.Notification) {
  delete mongoose.models.Notification;
}

export default mongoose.model("Notification", NotificationSchema);
