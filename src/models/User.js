import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  preferredName: { type: String, unique: true, sparse: true }, 
  email: { type: String, required: true, unique: true },
  number: { type: String, unique: true, sparse: true }, 
  password: { type: String, required: true },
  role: { type: String, enum: ["sales","doctor","superAdmin"], default: "sales" },
  department: { type: String, enum: ["telecalling", "support","admin"], default: "telecalling" }, 
  isAdmin: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  accessModules: [{ type: String }],
  leads: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
  achieved: { type: Number, default: 0 }
}, { timestamps: true });


export default mongoose.models.User || mongoose.model("User", UserSchema);