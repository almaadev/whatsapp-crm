import mongoose from "mongoose";

/**
 * Schema for tracking individual follow-up interactions on a Lead.
 */
const FollowUpSchema = new mongoose.Schema(
  {
    date:          { type: Date, required: true },
    year:          { type: Number },
    month:         { type: Number }, // 1-12
    day:           { type: Number }, // 1-31
    
    enquiredFor:   { type: String, default: "" },
    associateId:   { type: String, default: "" },
    associateName: { type: String, default: "" }, 
    priority:      { type: String, default: "Medium" },
    status:        { type: String, default: "New" },
    overAllRemarks:{ type: String, default: "" },
    day1Remarks:   { type: String, default: "" },
    day2Remarks:   { type: String, default: "" },
    day3Remarks:   { type: String, default: "" },
    saleAmount:    { type: String, default: "0" },
    leadType: {
      type: String,
      enum: ["Direct Lead"],
      default: "Direct Lead",
    },
    note:          { type: String, trim: true, default: "" },
    nextFollowUp:  { type: Date },
  },
  { _id: true } 
);

const HandoffSchema = new mongoose.Schema(
  {
    associateId:   { type: String, required: true },
    associateName: { type: String, required: true },
    assignedAt:    { type: Date, default: Date.now }
  },
  { _id: false }
);

/**
 * Schema representing a Customer Lead and its entire lifecycle.
 * Tracks ownership, handoffs, and an array of follow-up interactions.
 */
const LeadSchema = new mongoose.Schema(
  {
    phone:       { type: String, required: true, unique: true, index: true },
    name:        { type: String, default: "Unknown" },
    city:        { type: String, default: "" },
    address:     { type: String, default: "" },
    source:      { type: String, default: "Whatsapp" },
    
    // Current Ownership
    assignedTo:  { type: String, default: null },
    associateId: { type: String, default: "" },
    
    // Lifecycle Auditing
    handledByHistory: [HandoffSchema], 
    
    // Closure Tracking
    isClosed:    { type: Boolean, default: false },
    closedBy:    { type: String, default: null }, 
    closedById:  { type: String, default: null }, 
    closedAt:    { type: Date, default: null },
    
    leads:       [FollowUpSchema],                      
  },
  { 
    timestamps: true, 
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// --- Advanced Indexing for Analytics & Performance ---
LeadSchema.index({ createdAt: 1 });
LeadSchema.index({ "leads.date": 1 });
LeadSchema.index({ associateId: 1, isClosed: 1 });
LeadSchema.index({ closedById: 1, closedAt: 1 });
LeadSchema.index({ "leads.year": 1, "leads.month": 1, "leads.associateId": 1 });

// --- Virtuals ---
LeadSchema.virtual("latestFollowUp").get(function () {
  return this.leads && this.leads.length > 0 ? this.leads[this.leads.length - 1] : null;
});

LeadSchema.virtual("status").get(function () {
  return this.latestFollowUp?.status ?? "New";
});

// Safe model registration
delete mongoose.models.Lead;
export default mongoose.models.Lead || mongoose.model("Lead", LeadSchema);