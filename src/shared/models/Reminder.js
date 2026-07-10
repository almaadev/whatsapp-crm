import mongoose from "mongoose";

const ReminderSchema = new mongoose.Schema({
  associate: { type: String, required: true },
  phone: { type: String, required: true },
  message: { type: String, required: true },
  scheduledTime: { type: Date, required: true },
  status: { type: String, default: "PENDING" } // PENDING, DONE, CANCELLED
}, { timestamps: true });

export default mongoose.models.Reminder || mongoose.model("Reminder", ReminderSchema);