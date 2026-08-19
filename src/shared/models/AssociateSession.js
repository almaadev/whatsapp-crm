import mongoose from "mongoose";

const SegmentSchema = new mongoose.Schema({
  onlineFrom: { type: Date, default: null },
  offlineAt: { type: Date, default: null },
  onlineAt: { type: Date, default: null },
  durationSeconds: { type: Number, default: 0 }
}, { _id: true });

const AssociateSessionSchema = new mongoose.Schema({
  associateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    default: null,
    index: true
  },
  branchName: {
    type: String,
    default: ""
  },
  loginAt: {
    type: Date,
    required: true,
    index: true
  },
  logoutAt: {
    type: Date,
    default: null,
    index: true
  },
  logoutReason: {
    type: String,
    enum: ["manual_logout", "session_timeout", "forced_logout", "unknown"],
    default: null
  },
  status: {
    type: String,
    enum: ["online", "offline", "logged_out"],
    default: "online",
    index: true
  },
  lastHeartbeatAt: {
    type: Date,
    default: null
  },
  totalOnlineSeconds: {
    type: Number,
    default: 0
  },
  totalOfflineSeconds: {
    type: Number,
    default: 0
  },
  segments: [SegmentSchema]
}, {
  timestamps: true
});

// Indexes for high performance lookup and reporting queries
AssociateSessionSchema.index({ associateId: 1, loginAt: -1 });
AssociateSessionSchema.index({ status: 1, lastHeartbeatAt: -1 });
AssociateSessionSchema.index({ branchId: 1, loginAt: -1 });

if (process.env.NODE_ENV === "development" && mongoose.models.AssociateSession) {
  delete mongoose.models.AssociateSession;
}

export default mongoose.models.AssociateSession || mongoose.model("AssociateSession", AssociateSessionSchema);
