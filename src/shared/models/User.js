import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  preferredName: { type: String }, 
  email: { type: String, required: true, unique: true },
  number: { type: String }, 
  password: { type: String, required: true },
  role: { type: String, enum: ["sales","doctor","superAdmin"], default: "sales" },
  department: { type: String, enum: ["telecalling", "support","admin"], default: "telecalling" }, 
  branch: { type: mongoose.Schema.Types.Mixed, required: true },
  isAdmin: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  accessModules: [{ type: String }],
  leads: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
  achieved: { type: Number, default: 0 },
  assignedSenderNumbers: [{ type: mongoose.Schema.Types.ObjectId, ref: "TwilioNumber" }],
  assignedTwilioNumbers: [{ type: mongoose.Schema.Types.ObjectId, ref: "TwilioNumber" }],
  assignedSenderNumber: { type: mongoose.Schema.Types.ObjectId, ref: "TwilioNumber", default: null }
}, { timestamps: true });

if (mongoose.models.User) {
    delete mongoose.models.User;
}

export default mongoose.model("User", UserSchema);