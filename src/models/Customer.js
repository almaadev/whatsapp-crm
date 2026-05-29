import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: "Unknown" },
  city: { type: String, default: "" },
  address: { type: String, default: "" },
  source: { type: String, default: "Whatsapp" },
  enquiredFor: { type: String, default: "" },
  priority: { type: String, default: "Medium" },
  remarks: { type: String, default: "" }, 
  visitCount: { type: Number, default: 1 }, 
  status: { type: String, default: "New" },
  assignedTo: { type: String, default: "unassigned" },
  isClosed: { type: Boolean, default: false },
  followUpStart: { type: Date },
  activeRouteCategory: { type: String, default: "Direct Lead" },
  lastInteractionAt: { type: Date, default: null },
  unreadCount: { type: Number, default: 0 },
  
}, { timestamps: true });

export default mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);