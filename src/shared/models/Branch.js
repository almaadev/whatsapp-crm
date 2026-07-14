import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    manager: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.models.Branch || mongoose.model("Branch", BranchSchema);