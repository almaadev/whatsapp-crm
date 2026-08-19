import connectDB from "@/shared/lib/db/mongodb";
import AssociateSession from "@/shared/models/AssociateSession";
import User from "@/shared/models/User";
import Branch from "@/shared/models/Branch";
import mongoose from "mongoose";
import { emitAssociateSessionUpdated } from "@/shared/utils/socketPublisher";
import { resolveAssociateLogScope } from "@/shared/utils/serverAuth";
import { getOperationalDateBounds } from "@/shared/utils/dateRangeResolver";
import { notificationService } from "@/server/services/notificationService";

/**
 * Calculates realtime online and offline durations across all session segments.
 */
export function calculateOnlineDuration(session, now = new Date()) {
  if (!session) return { totalOnlineSeconds: 0, totalOfflineSeconds: 0 };

  let onlineSeconds = 0;
  let offlineSeconds = 0;

  const segments = session.segments || [];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const onlineFrom = seg.onlineFrom ? new Date(seg.onlineFrom).getTime() : null;
    const offlineAt = seg.offlineAt ? new Date(seg.offlineAt).getTime() : null;
    const onlineAt = seg.onlineAt ? new Date(seg.onlineAt).getTime() : null;

    if (onlineFrom) {
      if (offlineAt) {
        // Segment completed
        onlineSeconds += Math.max(0, Math.floor((offlineAt - onlineFrom) / 1000));
        // Check offline break before next segment / online recovery
        if (onlineAt && onlineAt > offlineAt) {
          offlineSeconds += Math.max(0, Math.floor((onlineAt - offlineAt) / 1000));
        }
      } else {
        // Active open segment
        if (session.status === "online") {
          const end = session.logoutAt ? new Date(session.logoutAt).getTime() : now.getTime();
          onlineSeconds += Math.max(0, Math.floor((end - onlineFrom) / 1000));
        } else if (session.status === "offline") {
          // If offline right now, segment stopped at last confirmed offline point or lastHeartbeatAt
          const offlinePoint = session.lastHeartbeatAt ? new Date(session.lastHeartbeatAt).getTime() : onlineFrom;
          onlineSeconds += Math.max(0, Math.floor((offlinePoint - onlineFrom) / 1000));
          offlineSeconds += Math.max(0, Math.floor((now.getTime() - offlinePoint) / 1000));
        }
      }
    }
  }

  return {
    totalOnlineSeconds: onlineSeconds,
    totalOfflineSeconds: offlineSeconds
  };
}

/**
 * Helper to resolve branchId and branchName for a user.
 */
async function resolveUserBranchInfo(user) {
  let branchId = null;
  let branchName = "";

  try {
    let rawBranch = user.branch;
    if ((rawBranch === undefined || rawBranch === null) && (user._id || user.id)) {
      const uDoc = await User.findById(user._id || user.id).select("branch").lean();
      if (uDoc) rawBranch = uDoc.branch;
    }

    if (rawBranch) {
      let bStr = "";
      if (typeof rawBranch === "object") {
        bStr = (rawBranch._id || rawBranch.id || rawBranch).toString();
      } else {
        bStr = rawBranch.toString();
      }

      if (bStr && mongoose.Types.ObjectId.isValid(bStr)) {
        branchId = new mongoose.Types.ObjectId(bStr);
        const bDoc = await Branch.findById(branchId).select("name").lean();
        if (bDoc) branchName = bDoc.name;
      }
    }
  } catch (err) {
    console.error("[associateSessionService] resolveUserBranchInfo error:", err);
  }

  return { branchId, branchName };
}

export const associateSessionService = {
  /**
   * Reconciles stale sessions where heartbeat was missed.
   */
  async reconcileStaleSessions() {
    try {
      await connectDB();
      const now = new Date();
      const offlineThreshold = new Date(now.getTime() - 30 * 1000); // 30 seconds grace period
      const timeoutThreshold = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours max session inactivity

      // 1. Mark online sessions missing heartbeat > 30s as offline
      const staleOnline = await AssociateSession.find({
        status: "online",
        lastHeartbeatAt: { $lt: offlineThreshold }
      });

      for (const session of staleOnline) {
        session.status = "offline";
        const offlineAt = session.lastHeartbeatAt || now;
        
        // Finalize current segment
        if (session.segments && session.segments.length > 0) {
          const lastSeg = session.segments[session.segments.length - 1];
          if (!lastSeg.offlineAt) {
            lastSeg.offlineAt = offlineAt;
            lastSeg.durationSeconds = Math.max(0, Math.floor((offlineAt.getTime() - new Date(lastSeg.onlineFrom).getTime()) / 1000));
          }
        }
        
        const durations = calculateOnlineDuration(session, now);
        session.totalOnlineSeconds = durations.totalOnlineSeconds;
        session.totalOfflineSeconds = durations.totalOfflineSeconds;
        await session.save();

        emitAssociateSessionUpdated({
          sessionId: session._id,
          associateId: session.associateId,
          status: "offline",
          lastHeartbeatAt: session.lastHeartbeatAt,
          totalOnlineSeconds: session.totalOnlineSeconds,
          totalOfflineSeconds: session.totalOfflineSeconds
        }, session.branchId);
      }

      // 2. Mark sessions with extreme inactivity (>12h) as logged_out (session_timeout)
      const staleTimeout = await AssociateSession.find({
        status: { $in: ["online", "offline"] },
        lastHeartbeatAt: { $lt: timeoutThreshold }
      });

      for (const session of staleTimeout) {
        session.status = "logged_out";
        session.logoutReason = "session_timeout";
        session.logoutAt = session.lastHeartbeatAt || now;

        const durations = calculateOnlineDuration(session, session.logoutAt);
        session.totalOnlineSeconds = durations.totalOnlineSeconds;
        session.totalOfflineSeconds = durations.totalOfflineSeconds;
        await session.save();

        emitAssociateSessionUpdated({
          sessionId: session._id,
          associateId: session.associateId,
          status: "logged_out",
          logoutReason: "session_timeout",
          logoutAt: session.logoutAt,
          totalOnlineSeconds: session.totalOnlineSeconds,
          totalOfflineSeconds: session.totalOfflineSeconds
        }, session.branchId);

        // Dispatch session_timeout notification
        try {
          const userDoc = await User.findById(session.associateId).select("name role branch department").lean();
          await notificationService.createAssociateLogoutNotification({
            associateId: session.associateId,
            actorUserId: session.associateId,
            associateName: userDoc?.name || "Associate",
            actorName: userDoc?.name || "Associate",
            actorRole: userDoc?.role || "associate",
            branchId: session.branchId,
            actorBranchId: session.branchId,
            actorBranchName: session.branchName || "",
            sessionId: session._id,
            reason: "session_timeout"
          });
        } catch (nErr) {
          console.error("Timeout notification error:", nErr);
        }
      }
    } catch (err) {
      console.error("[associateSessionService] reconcileStaleSessions error:", err);
    }
  },

  /**
   * Retrieves active session for a given associate.
   */
  async getActiveSession(userId) {
    await connectDB();
    if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) return null;

    await this.reconcileStaleSessions();

    const session = await AssociateSession.findOne({
      associateId: userId,
      status: { $ne: "logged_out" }
    }).sort({ loginAt: -1 });

    if (!session) return null;

    const durations = calculateOnlineDuration(session, new Date());
    session.totalOnlineSeconds = durations.totalOnlineSeconds;
    session.totalOfflineSeconds = durations.totalOfflineSeconds;

    return session;
  },

  /**
   * Creates a new login session or reuses an existing active session.
   * Protects against duplicate session creation on browser refresh or route navigation.
   */
  async createLoginSession(user) {
    await connectDB();
    const uId = user._id || user.id;
    if (!uId) throw new Error("User ID is required to create a login session");

    await this.reconcileStaleSessions();

    const existingActive = await AssociateSession.findOne({
      associateId: uId,
      status: { $ne: "logged_out" }
    }).sort({ loginAt: -1 });

    const now = new Date();

    if (existingActive) {
      if (existingActive.status === "offline") {
        existingActive.status = "online";
        if (existingActive.segments && existingActive.segments.length > 0) {
          const lastSeg = existingActive.segments[existingActive.segments.length - 1];
          if (lastSeg.offlineAt && !lastSeg.onlineAt) {
            lastSeg.onlineAt = now;
          }
        }
        existingActive.segments.push({
          onlineFrom: now,
          offlineAt: null,
          onlineAt: null,
          durationSeconds: 0
        });
      }
      existingActive.lastHeartbeatAt = now;

      const durations = calculateOnlineDuration(existingActive, now);
      existingActive.totalOnlineSeconds = durations.totalOnlineSeconds;
      existingActive.totalOfflineSeconds = durations.totalOfflineSeconds;

      await existingActive.save();

      emitAssociateSessionUpdated({
        sessionId: existingActive._id,
        associateId: existingActive.associateId,
        status: existingActive.status,
        loginAt: existingActive.loginAt,
        lastHeartbeatAt: existingActive.lastHeartbeatAt,
        totalOnlineSeconds: existingActive.totalOnlineSeconds,
        totalOfflineSeconds: existingActive.totalOfflineSeconds
      }, existingActive.branchId);

      return existingActive;
    }

    const { branchId, branchName } = await resolveUserBranchInfo(user);

    const newSession = new AssociateSession({
      associateId: uId,
      branchId,
      branchName,
      loginAt: now,
      status: "online",
      lastHeartbeatAt: now,
      segments: [
        {
          onlineFrom: now,
          offlineAt: null,
          onlineAt: null,
          durationSeconds: 0
        }
      ]
    });

    await newSession.save();

    emitAssociateSessionUpdated({
      sessionId: newSession._id,
      associateId: newSession.associateId,
      status: "online",
      loginAt: newSession.loginAt,
      lastHeartbeatAt: newSession.lastHeartbeatAt,
      totalOnlineSeconds: 0,
      totalOfflineSeconds: 0
    }, newSession.branchId);

    // Dispatch ASSOCIATE_LOGIN notification
    try {
      await notificationService.createAssociateLoginNotification({
        associateId: uId,
        actorUserId: uId,
        associateName: user.name || "Associate",
        actorName: user.name || "Associate",
        actorRole: user.role || "associate",
        branchId: newSession.branchId,
        actorBranchId: newSession.branchId,
        actorBranchName: branchName,
        sessionId: newSession._id
      });
    } catch (nErr) {
      console.error("Login notification error:", nErr);
    }

    return newSession;
  },

  /**
   * Process frontend heartbeat signal every 10s.
   */
  async heartbeatSession(userId, sessionId) {
    await connectDB();
    const uId = userId?._id || userId?.id || userId;
    if (!uId) return null;

    let session = null;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId.toString())) {
      session = await AssociateSession.findOne({ _id: sessionId, associateId: uId });
    }

    if (!session) {
      session = await AssociateSession.findOne({
        associateId: uId,
        status: { $ne: "logged_out" }
      }).sort({ loginAt: -1 });
    }

    if (!session) {
      const userDoc = await User.findById(uId).lean();
      if (userDoc) {
        session = await this.createLoginSession(userDoc);
        return session;
      }
      return null;
    }

    const now = new Date();

    if (session.status === "offline") {
      session.status = "online";
      if (session.segments && session.segments.length > 0) {
        const lastSeg = session.segments[session.segments.length - 1];
        if (lastSeg.offlineAt && !lastSeg.onlineAt) {
          lastSeg.onlineAt = now;
        }
      }
      session.segments.push({
        onlineFrom: now,
        offlineAt: null,
        onlineAt: null,
        durationSeconds: 0
      });
    }

    session.lastHeartbeatAt = now;

    const durations = calculateOnlineDuration(session, now);
    session.totalOnlineSeconds = durations.totalOnlineSeconds;
    session.totalOfflineSeconds = durations.totalOfflineSeconds;

    await session.save();

    emitAssociateSessionUpdated({
      sessionId: session._id,
      associateId: session.associateId,
      status: session.status,
      loginAt: session.loginAt,
      lastHeartbeatAt: session.lastHeartbeatAt,
      totalOnlineSeconds: session.totalOnlineSeconds,
      totalOfflineSeconds: session.totalOfflineSeconds
    }, session.branchId);

    return session;
  },

  /**
   * Explicitly mark session offline.
   */
  async markOffline(userId, sessionId) {
    await connectDB();
    const uId = userId?._id || userId?.id || userId;
    if (!uId) return null;

    let session = null;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId.toString())) {
      session = await AssociateSession.findOne({ _id: sessionId, associateId: uId });
    } else {
      session = await AssociateSession.findOne({ associateId: uId, status: "online" }).sort({ loginAt: -1 });
    }

    if (!session || session.status === "logged_out") return null;

    const now = new Date();
    session.status = "offline";
    const offlineAt = session.lastHeartbeatAt || now;

    if (session.segments && session.segments.length > 0) {
      const lastSeg = session.segments[session.segments.length - 1];
      if (!lastSeg.offlineAt) {
        lastSeg.offlineAt = offlineAt;
        lastSeg.durationSeconds = Math.max(0, Math.floor((offlineAt.getTime() - new Date(lastSeg.onlineFrom).getTime()) / 1000));
      }
    }

    const durations = calculateOnlineDuration(session, now);
    session.totalOnlineSeconds = durations.totalOnlineSeconds;
    session.totalOfflineSeconds = durations.totalOfflineSeconds;

    await session.save();

    emitAssociateSessionUpdated({
      sessionId: session._id,
      associateId: session.associateId,
      status: "offline",
      lastHeartbeatAt: session.lastHeartbeatAt,
      totalOnlineSeconds: session.totalOnlineSeconds,
      totalOfflineSeconds: session.totalOfflineSeconds
    }, session.branchId);

    return session;
  },

  /**
   * Explicitly mark session online.
   */
  async markOnline(userId, sessionId) {
    return await this.heartbeatSession(userId, sessionId);
  },

  /**
   * Log out session with specified reason (manual_logout, session_timeout, forced_logout).
   */
  async logoutSession(userId, sessionId, reason = "manual_logout") {
    await connectDB();
    const uId = userId?._id || userId?.id || userId;
    if (!uId) return null;

    let session = null;
    if (sessionId && mongoose.Types.ObjectId.isValid(sessionId.toString())) {
      session = await AssociateSession.findOne({ _id: sessionId, associateId: uId });
    }

    if (!session) {
      session = await AssociateSession.findOne({
        associateId: uId,
        status: { $ne: "logged_out" }
      }).sort({ loginAt: -1 });
    }

    if (!session) return null;

    const now = new Date();

    if (session.segments && session.segments.length > 0) {
      const lastSeg = session.segments[session.segments.length - 1];
      if (!lastSeg.offlineAt) {
        lastSeg.offlineAt = now;
        lastSeg.durationSeconds = Math.max(0, Math.floor((now.getTime() - new Date(lastSeg.onlineFrom).getTime()) / 1000));
      }
    }

    session.status = "logged_out";
    session.logoutAt = now;
    session.logoutReason = reason;

    const durations = calculateOnlineDuration(session, now);
    session.totalOnlineSeconds = durations.totalOnlineSeconds;
    session.totalOfflineSeconds = durations.totalOfflineSeconds;

    await session.save();

    emitAssociateSessionUpdated({
      sessionId: session._id,
      associateId: session.associateId,
      status: "logged_out",
      logoutAt: session.logoutAt,
      logoutReason: session.logoutReason,
      totalOnlineSeconds: session.totalOnlineSeconds,
      totalOfflineSeconds: session.totalOfflineSeconds
    }, session.branchId);

    // Dispatch ASSOCIATE_LOGOUT notification
    try {
      const userDoc = await User.findById(uId).select("name role branch department").lean();
      await notificationService.createAssociateLogoutNotification({
        associateId: uId,
        actorUserId: uId,
        associateName: userDoc?.name || user?.name || "Associate",
        actorName: userDoc?.name || user?.name || "Associate",
        actorRole: userDoc?.role || user?.role || "associate",
        branchId: session.branchId,
        actorBranchId: session.branchId,
        actorBranchName: session.branchName || "",
        sessionId: session._id,
        reason
      });
    } catch (nErr) {
      console.error("Logout notification error:", nErr);
    }

    return session;
  },

  /**
   * Query associate session logs enforcing authoritative hierarchical scope (SuperAdmin, Admin, Associate).
   * Note: For Admin monitoring, current Admin user's own session is EXCLUDED.
   */
  async getAssociateSessionLogs(filters = {}, userSession) {
    await connectDB();
    await this.reconcileStaleSessions();

    const scopeInfo = await resolveAssociateLogScope(userSession);
    if (scopeInfo.scope === "none") return [];

    const query = {};

    if (scopeInfo.scope === "self") {
      // ASSOCIATE: Force associateId = self ONLY.
      query.associateId = new mongoose.Types.ObjectId(scopeInfo.userId);
    } else if (scopeInfo.scope === "branch") {
      // ADMIN MONITORING: Query associates belonging to Admin's branch, EXCLUDING current Admin user!
      const adminObjId = mongoose.Types.ObjectId.isValid(scopeInfo.userId) ? new mongoose.Types.ObjectId(scopeInfo.userId) : scopeInfo.userId;

      query.associateId = { $ne: adminObjId };

      if (scopeInfo.userBranchIds.length > 0) {
        query.$or = [
          { branchId: { $in: [...scopeInfo.userBranchObjectIds, ...scopeInfo.userBranchIds] } },
          { branchId: null },
          { branchId: { $exists: false } }
        ];
      } else {
        return []; // Admin has no branch assigned
      }

      // If client passed associateId filter:
      if (filters.associateId && filters.associateId !== "All" && filters.associateId !== "all") {
        if (filters.associateId.toString() === scopeInfo.userId) {
          return []; // Requested current Admin's own ID -> exclude from monitoring table
        }
        if (mongoose.Types.ObjectId.isValid(filters.associateId)) {
          const targetAssoc = await User.findById(filters.associateId).select("branch role").lean();
          if (!targetAssoc || targetAssoc.role === "superAdmin") {
            return [];
          }
          let targetBranchStr = "";
          if (typeof targetAssoc.branch === "object" && targetAssoc.branch) {
            targetBranchStr = (targetAssoc.branch._id || targetAssoc.branch.id || targetAssoc.branch).toString();
          } else if (targetAssoc.branch) {
            targetBranchStr = targetAssoc.branch.toString();
          }
          if (!targetBranchStr || !scopeInfo.userBranchIds.includes(targetBranchStr)) {
            return [];
          }
          query.associateId = new mongoose.Types.ObjectId(filters.associateId);
        }
      }
    } else if (scopeInfo.scope === "global") {
      // SUPERADMIN: Can query any branch or associate
      if (filters.branchId && filters.branchId !== "All" && filters.branchId !== "all") {
        const bIdStr = filters.branchId.toString();
        const bObj = mongoose.Types.ObjectId.isValid(bIdStr) ? new mongoose.Types.ObjectId(bIdStr) : null;
        query.$or = [{ branchId: { $in: [bObj, bIdStr].filter(Boolean) } }];
      }

      if (filters.associateId && filters.associateId !== "All" && filters.associateId !== "all") {
        if (mongoose.Types.ObjectId.isValid(filters.associateId)) {
          query.associateId = new mongoose.Types.ObjectId(filters.associateId);
        }
      }
    }

    // Status filter
    if (filters.status && filters.status !== "All" && filters.status !== "all") {
      query.status = filters.status;
    }

    // Logout reason filter
    if (filters.logoutReason && filters.logoutReason !== "All" && filters.logoutReason !== "all") {
      query.logoutReason = filters.logoutReason;
    }

    // Date bounds filter using IST date resolver
    const { startDate, endDate } = getOperationalDateBounds(
      filters.dateRange || "today",
      filters.customStart,
      filters.customEnd
    );

    if (startDate || endDate) {
      query.loginAt = {};
      if (startDate) query.loginAt.$gte = startDate;
      if (endDate) query.loginAt.$lte = endDate;
    }

    const rawSessions = await AssociateSession.find(query)
      .populate("associateId", "name email branch role department preferredName")
      .populate("branchId", "name")
      .sort({ loginAt: -1 })
      .lean();

    // Post-filter to strictly enforce RBAC
    const filteredSessions = rawSessions.filter((session) => {
      const assocRole = session.associateId?.role;
      const assocIdStr = session.associateId?._id?.toString() || session.associateId?.toString();

      // Rule: Nobody except SuperAdmin can view SuperAdmin session logs
      if (assocRole === "superAdmin" && !scopeInfo.isSuperAdmin) {
        return false;
      }

      if (scopeInfo.scope === "self") {
        return assocIdStr === scopeInfo.userId;
      }

      if (scopeInfo.scope === "branch") {
        // ADMIN MONITORING RULE: EXCLUDE current Admin's own session!
        if (assocIdStr === scopeInfo.userId) {
          return false;
        }

        const sessBranchIdStr = session.branchId?._id?.toString() || session.branchId?.toString();
        if (sessBranchIdStr && scopeInfo.userBranchIds.includes(sessBranchIdStr)) {
          return true;
        }

        const assocBranch = session.associateId?.branch;
        let assocBranchStr = "";
        if (typeof assocBranch === "object" && assocBranch) {
          assocBranchStr = (assocBranch._id || assocBranch.id || assocBranch).toString();
        } else if (assocBranch) {
          assocBranchStr = assocBranch.toString();
        }
        return assocBranchStr && scopeInfo.userBranchIds.includes(assocBranchStr);
      }

      return true; // SuperAdmin
    });

    const now = new Date();

    return filteredSessions.map((session) => {
      const durations = calculateOnlineDuration(session, now);
      return {
        ...session,
        totalOnlineSeconds: durations.totalOnlineSeconds,
        totalOfflineSeconds: durations.totalOfflineSeconds
      };
    });
  },

  /**
   * Daily aggregate summary enforcing scope and excluding current Admin from monitoring summary counts.
   */
  async getAssociateDailySummary(filters = {}, userSession) {
    await connectDB();
    await this.reconcileStaleSessions();

    const sessionLogs = await this.getAssociateSessionLogs(filters, userSession);

    const summaryMap = new Map();

    for (const log of sessionLogs) {
      const assoc = log.associateId;
      const assocIdStr = assoc?._id?.toString() || log.associateId?.toString();
      if (!assocIdStr) continue;

      if (!summaryMap.has(assocIdStr)) {
        summaryMap.set(assocIdStr, {
          associateId: assocIdStr,
          associateName: assoc?.name || assoc?.preferredName || "Unknown Associate",
          email: assoc?.email || "",
          branchName: log.branchId?.name || log.branchName || "Unassigned",
          branchId: log.branchId?._id || log.branchId || null,
          totalSessions: 0,
          firstLoginAt: log.loginAt,
          lastLogoutAt: log.logoutAt,
          totalOnlineSeconds: 0,
          totalOfflineSeconds: 0,
          currentStatus: log.status,
          sessions: []
        });
      }

      const summary = summaryMap.get(assocIdStr);
      summary.totalSessions += 1;
      summary.totalOnlineSeconds += (log.totalOnlineSeconds || 0);
      summary.totalOfflineSeconds += (log.totalOfflineSeconds || 0);
      summary.sessions.push(log);

      if (new Date(log.loginAt) < new Date(summary.firstLoginAt)) {
        summary.firstLoginAt = log.loginAt;
      }
      if (log.logoutAt && (!summary.lastLogoutAt || new Date(log.logoutAt) > new Date(summary.lastLogoutAt))) {
        summary.lastLogoutAt = log.logoutAt;
      }
      if (log.status === "online" || log.status === "offline") {
        summary.currentStatus = log.status;
      }
    }

    return Array.from(summaryMap.values());
  }
};
