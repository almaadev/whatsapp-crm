import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: "Unknown" },
  currentAddressId: { type: mongoose.Schema.Types.ObjectId, ref: "CustomerAddress", default: null, index: true },
  activeLeadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", default: null, index: true },
  assignedUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  assignedTo: { type: String, default: "unassigned" }, // Backward compatibility
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
  source: { type: String, default: "Whatsapp" },
  enquiredFor: { type: String, default: "" },
  priority: { type: String, default: "Medium" },
  remarks: { type: String, default: "" },
  status: { type: String, default: "New" },
  isClosed: { type: Boolean, default: true },
  closedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  closedAt: { type: Date, default: null },
  reopenedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reopenedAt: { type: Date, default: null },
  isOptedOut: { type: Boolean, default: false },
  followUpStart: { type: Date },
  activeRouteCategory: { type: String, default: "Direct Lead" },
  lastInteractionAt: { type: Date, default: null },
  unreadCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  assignedTwilioNumber: { type: String, default: null, index: true },
  lastIncomingNumber: { type: String, default: null, index: true },
}, { timestamps: true });

if (mongoose.models.Customer) {
    delete mongoose.models.Customer;
}

export default mongoose.model("Customer", CustomerSchema);