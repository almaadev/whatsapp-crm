import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  preferredName: { type: String, unique: true, sparse: true }, 
  email: { type: String, required: true, unique: true },
<<<<<<< HEAD
  number: { type: String, unique: true, sparse: true }, 
  password: { type: String, required: true },
  role: { type: String, enum: ["sales","doctor","superAdmin"], default: "sales" },
  department: { type: String, enum: ["telecalling", "support","admin"], default: "telecalling" }, 
  branch:{ type: String, required: true }, // Puthu field
=======
  number: { type: String }, 
  password: { type: String, required: true },
  role: { type: String, enum: ["sales","doctor","superAdmin"], default: "sales" },
  department: { type: String, enum: ["telecalling", "support","admin"], default: "telecalling" }, 
  branch:{ type: String, required: true },
>>>>>>> c1be5bc (Initial commit from new system)
  isAdmin: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  accessModules: [{ type: String }],
  leads: { type: Number, default: 0 },
  target: { type: Number, default: 0 },
  achieved: { type: Number, default: 0 }
}, { timestamps: true });

if (mongoose.models.User) {
    delete mongoose.models.User;
}

export default mongoose.model("User", UserSchema);