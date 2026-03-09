import mongoose from "mongoose";

const LeadSchema = new mongoose.Schema({
  phone: { type: String, required: true, index: true },
  
  name: { type: String, default: "Unknown" }, 
  city: { type: String, default: "" },
  address: { type: String, default: "" },
  
  source: { type: String, default: "Whatsapp" },
  enquiredFor: { type: String, default: "" },
  priority: { type: String, default: "Medium" },
  remarks: { type: String, default: "" },
  
  status: { type: String, default: "New" },
  assignedTo: { type: String, default: "unassigned" },
  
  followUpStart: { type: Date },
  day1Remarks: { type: String, default: "" },
  day2Remarks: { type: String, default: "" },
  day3Remarks: { type: String, default: "" },
  
  saleAmount: { type: String, default: "0" },
  isClosed: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.models.Lead || mongoose.model("Lead", LeadSchema);