import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: "Lead", index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  eventType: { type: String, required: true, index: true },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  metadata: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

// Prevent model caching issues during hot-reload
if (mongoose.models.Activity) {
  delete mongoose.models.Activity;
}

export default mongoose.models.Activity || mongoose.model("Activity", ActivitySchema);
