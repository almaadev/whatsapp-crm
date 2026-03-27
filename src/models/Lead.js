import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  customerPhone: { type: String },
  name: { type: String, default: "Unknown" },
  city: { type: String, default: "" },
  address: { type: String, default: "" },
  source: { type: String, default: "Whatsapp" },
  enquiredFor: { type: String, default: "" },
  priority: { type: String, default: "" },
  remarks: { type: String, default: "" },
  status: { type: String, default: "New" },
  assignedTo: { type: String, default: "unassigned" },
  associate: { type: String, default: "unassigned" }, // Backward compatibility
  associateId: { type: String, default: "" },
  followUpStart: { type: Date },
  day1Remarks: { type: String, default: "" },
  day2Remarks: { type: String, default: "" },
  day3Remarks: { type: String, default: "" },
  saleAmount: { type: String, default: "0" },
  isClosed: { type: Boolean, default: false },
  leadType: {
    type: String,
    enum: ["Direct Lead", "MD Camp", "Product Lead", "Therapy"],
    default: "Direct Lead"
  },
  lastKeyword: { type: String },
  unreadCount: { type: Number, default: 0 }
}, { timestamps: true });

if (mongoose.models.Lead) {
  delete mongoose.models.Lead;
}
export default mongoose.models.Lead || mongoose.model("Lead", LeadSchema);