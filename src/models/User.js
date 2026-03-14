import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "sales" }, 
  leads: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
  achieved: { type: Number, default: 0 }
}, { timestamps: true });

export default mongoose.models.User || mongoose.model("User", UserSchema);