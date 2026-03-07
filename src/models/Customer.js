import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: "Unknown" },
  city: { type: String, default: "" },
  status: { type: String, default: "New" },
  assignedTo: { type: String, default: "unassigned" },
  source: { type: String, default: "Whatsapp" },
  enquiredFor: { type: String, default: "" },
  saleAmount: { type: String, default: "0" },
  remarks: { type: String, default: "" },
  lastClosedBy: { type: String, default: "" },
  followUpStart: { type: Date },
  day1Remarks: { type: String, default: "" },
  day2Remarks: { type: String, default: "" },
  day3Remarks: { type: String, default: "" },
  priority: { type: String, default: "Low" },
  isClosed: { type: Boolean, default: false },
  unreadCount: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);