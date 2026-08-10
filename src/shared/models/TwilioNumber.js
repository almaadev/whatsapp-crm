import mongoose from "mongoose";

const TwilioNumberSchema = new mongoose.Schema(
  {
    friendlyName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, unique: true, trim: true },
    twilioSenderSid: { type: String, default: "" },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null },
    assignedAdmins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    assignedAssociates: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

TwilioNumberSchema.index({ assignedAdmins: 1 });
TwilioNumberSchema.index({ status: 1 });

if (process.env.NODE_ENV === "development" && mongoose.models.TwilioNumber) {
  delete mongoose.models.TwilioNumber;
}

export default mongoose.models.TwilioNumber || mongoose.model("TwilioNumber", TwilioNumberSchema);
