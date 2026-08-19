import mongoose from "mongoose";

const ChatWorkspaceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },
  activePhone: {
    type: String,
    default: null,
    index: true
  },
  activeCustomerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Customer",
    default: null,
    index: true
  },
  ownerTabId: {
    type: String,
    default: null
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

if (mongoose.models.ChatWorkspace) {
  delete mongoose.models.ChatWorkspace;
}

export default mongoose.model("ChatWorkspace", ChatWorkspaceSchema);
