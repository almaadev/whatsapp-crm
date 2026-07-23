import mongoose from "mongoose";

const ChatHistorySchema = new mongoose.Schema({
  action: { type: String },
  eventType: { type: String },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  performedByName: { type: String },
  performedByRole: { type: String },
  performedById: { type: String },
  performedAt: { type: Date, default: Date.now },
  timestamp: { type: Date, default: Date.now },
  notes: { type: String },
  isInternal: { type: Boolean, default: false },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { _id: true });

const CustomerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: "Unknown" },
  city: { type: String, default: "" },
  address: { type: String, default: "" },
  source: { type: String, default: "Whatsapp" },
  enquiredFor: { type: String, default: "" },
  priority: { type: String, default: "Medium" },
  remarks: { type: String, default: "" },
  status: { type: String, default: "New" },
  assignedTo: { type: String, default: "unassigned" },
  isClosed: { type: Boolean, default: false },
  isOptedOut: { type: Boolean, default: false },
  followUpStart: { type: Date },
  activeRouteCategory: { type: String, default: "Direct Lead" },
  lastInteractionAt: { type: Date, default: null },
  unreadCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
  assignedTwilioNumber: { type: String, default: null, index: true },
  lastIncomingNumber: { type: String, default: null, index: true },
  chatHistory: [ChatHistorySchema],
}, { timestamps: true });

if (mongoose.models.Customer) {
    delete mongoose.models.Customer;
}

export default mongoose.model("Customer", CustomerSchema);