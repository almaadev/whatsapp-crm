import mongoose from "mongoose";

const FollowUpSchema = new mongoose.Schema(
  {
    date:          { type: Date, required: true },
    year:          { type: Number },
    month:         { type: Number },
    day:           { type: Number },
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

const LeadSchema = new mongoose.Schema(
  {
    customerId:  { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, unique: true, index: true },
    assignedTo:  { type: String, default: null },
    associateId: { type: String, default: "" },
    handledByHistory: [HandoffSchema], 
    isClosed:    { type: Boolean, default: false },
    closedBy:    { type: String, default: null }, 
    closedById:  { type: String, default: null }, 
    closedAt:    { type: Date, default: null },
    leads:       { type: [FollowUpSchema], alias: "followups" }
  },
  { 
    timestamps: true, 
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

LeadSchema.index({ createdAt: 1 });
LeadSchema.index({ "leads.date": 1 });
LeadSchema.index({ associateId: 1, isClosed: 1 });
LeadSchema.index({ closedById: 1, closedAt: 1 });

LeadSchema.virtual("latestFollowUp").get(function () {
  return this.leads && this.leads.length > 0 ? this.leads[this.leads.length - 1] : null;
});

LeadSchema.virtual("status").get(function () {
  return this.latestFollowUp?.status ?? "New";
});

LeadSchema.virtual("pipelineStatus").get(function () {
  return this.status;
});

LeadSchema.virtual("saleAmount").get(function () {
  return this.latestFollowUp?.saleAmount ?? "0";
});

delete mongoose.models.Lead;
export default mongoose.models.Lead || mongoose.model("Lead", LeadSchema);