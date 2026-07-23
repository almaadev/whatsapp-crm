import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String },
    manager: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    assignedTwilioNumbers: [{ type: mongoose.Schema.Types.ObjectId, ref: "TwilioNumber" }],
}, { timestamps: true });

// Prevent model caching issues during development hot-reloads
if (process.env.NODE_ENV === "development" && mongoose.models.Branch) {
  delete mongoose.models.Branch;
}

export default mongoose.models.Branch || mongoose.model("Branch", BranchSchema);