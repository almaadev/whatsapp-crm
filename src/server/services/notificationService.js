import connectDB from "@/shared/lib/db/mongodb";
import Notification from "@/shared/models/Notification";
import User from "@/shared/models/User";
import ChatWorkspace from "@/shared/models/ChatWorkspace";
import Branch from "@/shared/models/Branch";
import mongoose from "mongoose";
import { NotificationTypes } from "@/shared/constants/notificationConstants";
import { isAdminAuthorized, isSuperAdmin } from "@/shared/utils/auth";
import { normalizePhone } from "@/shared/utils/phoneUtils";
import {
  emitNotificationCreated,
  emitNotificationUpdated,
  emitNotificationRead,
  emitNotificationUnread,
  emitNotificationDismissed,
  emitNotificationClearedAll
} from "@/shared/utils/socketPublisher";

/**
 * Helper to match user's assigned branch against a target branch ID.
 */
function isUserInBranch(userBranch, targetBranchId) {
  if (!targetBranchId) return true; // Unassigned target branch is accessible across branches
  if (!userBranch) return false;

  const targetStr = targetBranchId.toString();

  if (Array.isArray(userBranch)) {
    return userBranch.some((b) => {
      const bStr = typeof b === "object" ? (b._id || b.id || b).toString() : b.toString();
      return bStr === targetStr;
    });
  }

  const bStr = typeof userBranch === "object" ? (userBranch._id || userBranch.id || userBranch).toString() : userBranch.toString();
  return bStr === targetStr;
}

export const notificationService = {
  /**
   * Centralized Authoritative Recipient Resolution for all CRM Notification Types.
   * 
   * Strict Architectural Separation:
   * 1. CUSTOMER ACTIVITIES (NEW_MESSAGE, NEW_CHAT, etc.):
   *    - SuperAdmin (global visibility)
   *    - Branch Admins and Associates matching customer's branch (or all eligible if unassigned)
   * 
   * 2. STAFF ACTIVITIES (ASSOCIATE_LOGIN, ASSOCIATE_LOGOUT, ADMIN_LOGIN, STAFF_ACTIVITY, etc.):
   *    - Strictly UPWARD hierarchical routing:
   *      * Associate Activity -> Branch Admin(s) of actor's branch + SuperAdmin(s)
   *      * Admin Activity -> SuperAdmin(s) ONLY (never lateral Admins or subordinate Associates)
   *      * SuperAdmin Activity -> SuperAdmin(s) ONLY (never downward to Admins or Associates)
   *      * Actor NEVER receives notification for their own session/activity event
   */
  async resolveNotificationRecipients({
    type,
    actorUserId = null,
    actorRole = null,
    actorBranchId = null,
    customerId = null,
    branchId = null
  }) {
    await connectDB();
    const allUsers = await User.find({ active: { $ne: false } }).lean();

    const isCustomerEvent = [
      NotificationTypes.NEW_MESSAGE,
      NotificationTypes.NEW_CHAT,
      NotificationTypes.LEAD_ASSIGNED,
      NotificationTypes.FOLLOWUP_DUE,
      NotificationTypes.CHAT_REOPENED,
      NotificationTypes.CUSTOMER_ASSIGNED,
      NotificationTypes.MISSED_CHAT,
    ].includes(type);

    if (isCustomerEvent) {
      // ----------------------------------------------------
      // CUSTOMER ACTIVITY: Preserved customer/branch routing
      // ----------------------------------------------------
      return allUsers.filter((u) => {
        const superAdminUser = isSuperAdmin(u.role);
        if (superAdminUser) return true; // SuperAdmin receives across all branches

        if (branchId) {
          return isUserInBranch(u.branch, branchId);
        }

        // Unassigned customer branch -> eligible for all authorized CRM users
        return true;
      });
    }

    // ----------------------------------------------------
    // STAFF ACTIVITY / SESSION: Upward Hierarchy Routing
    // ----------------------------------------------------
    let resolvedActorRole = actorRole;
    let resolvedActorBranch = actorBranchId;

    if (actorUserId && (!resolvedActorRole || !resolvedActorBranch)) {
      const actorDoc = allUsers.find((u) => u._id.toString() === actorUserId.toString());
      if (actorDoc) {
        if (!resolvedActorRole) resolvedActorRole = actorDoc.role;
        if (!resolvedActorBranch) resolvedActorBranch = actorDoc.branch;
      }
    }

    const actorIsSuperAdmin = isSuperAdmin(resolvedActorRole);
    const actorIsAdmin = !actorIsSuperAdmin && (resolvedActorRole === "admin" || resolvedActorRole === "doctor_admin" || resolvedActorRole === "sales_admin");
    const actorIsAssociate = !actorIsSuperAdmin && !actorIsAdmin;

    return allUsers.filter((u) => {
      const recipientId = u._id.toString();

      // 1. NEVER notify the actor themselves for staff session/activity events
      if (actorUserId && recipientId === actorUserId.toString()) {
        return false;
      }

      const recipientIsSuperAdmin = isSuperAdmin(u.role);
      const recipientIsAdmin = !recipientIsSuperAdmin && (u.role === "admin" || u.department === "admin" || u.role === "doctor_admin" || u.role === "sales_admin");
      const recipientIsAssociate = !recipientIsSuperAdmin && !recipientIsAdmin;

      // 2. Associates NEVER receive staff session/activity notifications
      if (recipientIsAssociate) {
        return false;
      }

      // 3. SuperAdmin Activity: Upward ceiling (SuperAdmin ONLY)
      if (actorIsSuperAdmin) {
        return recipientIsSuperAdmin;
      }

      // 4. Admin Activity: SuperAdmin ONLY (NO lateral Admins, NO Associates)
      if (actorIsAdmin) {
        return recipientIsSuperAdmin;
      }

      // 5. Associate Activity:
      //    -> SuperAdmin (Global)
      //    -> Admin(s) of the ACTOR's branch ONLY
      if (actorIsAssociate) {
        if (recipientIsSuperAdmin) return true;

        if (recipientIsAdmin) {
          const effectiveBranch = resolvedActorBranch || branchId;
          if (effectiveBranch) {
            return isUserInBranch(u.branch, effectiveBranch);
          }
          // If associate has no branch, only SuperAdmin receives
          return false;
        }
      }

      return false;
    });
  },

  /**
   * Backward-compatible wrapper for legacy callers.
   */
  async resolveRecipients(eventType, branchId = null, actorContext = {}) {
    return this.resolveNotificationRecipients({
      type: eventType,
      branchId,
      ...actorContext
    });
  },

  /**
  /**
   * Authoritative Server-Side Global Active Chat Check.
   * Checks if customer is currently selected/handled by ANY CRM user in ChatWorkspace.
   * 
   * Returns: { isActive: boolean, activeUsers: Array<{ userId, userName, role }> }
   */
  async isCustomerCurrentlyHandled(customerId = null, canonicalPhone = null) {
    await connectDB();
    const { getPhoneVariations, normalizePhone } = await import("@/shared/utils/phoneUtils");

    const phoneVariations = canonicalPhone ? getPhoneVariations(canonicalPhone) : [];
    const normalizedTargetPhone = canonicalPhone ? normalizePhone(canonicalPhone) : "";

    // Stale workspace threshold: 15 minutes TTL
    const activeThreshold = new Date(Date.now() - 15 * 60 * 1000);

    const queryOr = [];

    if (customerId) {
      queryOr.push({ activeCustomerId: customerId });
      if (mongoose.Types.ObjectId.isValid(customerId.toString())) {
        queryOr.push({ activeCustomerId: new mongoose.Types.ObjectId(customerId.toString()) });
      }
    }

    if (phoneVariations.length > 0) {
      queryOr.push({ activePhone: { $in: phoneVariations } });
    }

    if (normalizedTargetPhone) {
      queryOr.push({ activePhone: normalizedTargetPhone });
    }

    if (queryOr.length === 0) {
      return { isActive: false, activeUsers: [] };
    }

    const activeWorkspaces = await ChatWorkspace.find({
      lastActiveAt: { $gte: activeThreshold },
      $or: queryOr
    })
      .populate("userId", "name email role department")
      .lean();

    if (!activeWorkspaces || activeWorkspaces.length === 0) {
      return { isActive: false, activeUsers: [] };
    }

    // Filter to ensure exact match on customerId or normalized canonical phone
    const matchedWorkspaces = activeWorkspaces.filter((ws) => {
      if (customerId && ws.activeCustomerId && ws.activeCustomerId.toString() === customerId.toString()) {
        return true;
      }
      if (ws.activePhone && normalizedTargetPhone) {
        return normalizePhone(ws.activePhone) === normalizedTargetPhone;
      }
      return false;
    });

    if (matchedWorkspaces.length === 0) {
      return { isActive: false, activeUsers: [] };
    }

    const activeUsers = matchedWorkspaces.map((ws) => ({
      userId: ws.userId?._id?.toString() || ws.userId?.toString() || "",
      userName: ws.userId?.name || "Unknown",
      role: ws.userId?.role || ""
    }));

    return {
      isActive: true,
      activeUsers
    };
  },

  /**
   * Process inbound WhatsApp interaction with global chat suppression, idempotency & unread grouping.
   */
  async processInboundNotification({
    phone,
    customerId = null,
    customerName = "",
    messageText = "",
    branchId = null,
    twilioSid = null,
    isNewChat = false
  }) {
    await connectDB();

    console.log(`[NOTIFICATION] Incoming customer message`);
    console.log(`[NOTIFICATION] Customer ID: ${customerId || 'null'}`);
    console.log(`[NOTIFICATION] Canonical Phone: ${phone}`);

    // 1. Idempotency Check: Prevent duplicate webhook notifications
    if (twilioSid) {
      const alreadyProcessed = await Notification.exists({ sourceMessageId: twilioSid });
      if (alreadyProcessed) {
        console.log(`ℹ️ [NotificationService] Webhook duplicate skipped for twilioSid: ${twilioSid}`);
        return [];
      }
    }

    // 2. Global Active Customer Check across ALL CRM users
    console.log(`[NOTIFICATION] Checking active customer workspaces...`);
    const { isActive, activeUsers } = await this.isCustomerCurrentlyHandled(customerId, phone);

    if (isActive) {
      const primaryHandler = activeUsers[0];
      console.log(`[NOTIFICATION] Active customer found:`);
      console.log(`userId=${primaryHandler?.userId}`);
      console.log(`userName=${primaryHandler?.userName}`);
      console.log(`customerId=${customerId}`);
      console.log(`[NOTIFICATION] SUPPRESSED — customer currently handled`);
      return [];
    }

    console.log(`[NOTIFICATION] No active handler found`);

    // Resolve branch name if branchId provided
    let branchName = "";
    if (branchId && mongoose.Types.ObjectId.isValid(branchId.toString())) {
      const bDoc = await Branch.findById(branchId).select("name").lean();
      if (bDoc) branchName = bDoc.name;
    }

    const type = isNewChat ? NotificationTypes.NEW_CHAT : NotificationTypes.NEW_MESSAGE;
    const recipients = await this.resolveNotificationRecipients({ type, branchId, customerId });
    console.log(`[NOTIFICATION] Resolving recipients:`);
    console.log(`[NOTIFICATION] Eligible count: ${recipients.length} | recipientIds: [${recipients.map(r => r._id.toString()).join(", ")}]`);

    const createdOrUpdatedList = [];

    for (const recipient of recipients) {
      const recipientUserId = recipient._id;

      // Find existing ACTIVE notification for this recipient + customer (regardless of isRead state!)
      const { getPhoneVariations } = await import("@/shared/utils/phoneUtils");
      const phoneVars = phone ? getPhoneVariations(phone) : [];

      const queryOr = [];
      if (customerId) {
        queryOr.push({ customerId });
        if (mongoose.Types.ObjectId.isValid(customerId.toString())) {
          queryOr.push({ customerId: new mongoose.Types.ObjectId(customerId.toString()) });
        }
      }
      if (phoneVars.length > 0) {
        queryOr.push({ phone: { $in: phoneVars } });
      }

      const existingActiveNotification = await Notification.findOne({
        recipientUserId,
        type: { $in: [NotificationTypes.NEW_MESSAGE, NotificationTypes.NEW_CHAT] },
        isDismissed: false,
        ...(queryOr.length > 0 ? { $or: queryOr } : {})
      }).sort({ updatedAt: -1, createdAt: -1 });

      if (existingActiveNotification) {
        const newCount = (existingActiveNotification.messageCount || 1) + 1;
        const msg = messageText || (isNewChat ? `${customerName || phone} started a new conversation` : "");
        console.log(`[NOTIFICATION] Existing active notification found | notificationId=${existingActiveNotification._id}`);
        console.log(`[NOTIFICATION] Updating notification | notificationId=${existingActiveNotification._id} | messageCount=${newCount} | latestMessage="${msg}"`);

        existingActiveNotification.messageCount = newCount;
        existingActiveNotification.latestMessage = msg;
        existingActiveNotification.latestMessageAt = new Date();
        existingActiveNotification.message = msg;
        existingActiveNotification.title = customerName || phone || "WhatsApp Message";
        existingActiveNotification.senderName = customerName || existingActiveNotification.senderName;
        existingActiveNotification.isRead = false; // Reset to UNREAD state for new inbound message
        existingActiveNotification.readAt = null;
        existingActiveNotification.sourceMessageId = twilioSid;
        existingActiveNotification.updatedAt = new Date();

        await existingActiveNotification.save();
        const obj = existingActiveNotification.toObject();
        console.log(`[NOTIFICATION] SAVED (UPDATED) | notificationId: ${obj._id}`);
        console.log(`[NOTIFICATION] EMITTING notification_updated | recipientUserId: ${recipientUserId} | room: user:${recipientUserId}`);
        emitNotificationUpdated(obj, recipientUserId);
        createdOrUpdatedList.push(obj);

        // Safe cleanup: dismiss any older duplicate records that might exist for this customer + recipient
        if (queryOr.length > 0) {
          await Notification.updateMany(
            {
              _id: { $ne: existingActiveNotification._id },
              recipientUserId,
              isDismissed: false,
              $or: queryOr
            },
            { $set: { isDismissed: true, dismissedAt: new Date() } }
          );
        }
      } else {
        const notifType = isNewChat ? NotificationTypes.NEW_CHAT : NotificationTypes.NEW_MESSAGE;
        const title = isNewChat ? "New Chat" : (customerName || phone || "WhatsApp Message");
        const msg = messageText || (isNewChat ? `${customerName || phone} started a new conversation` : "");

        console.log(`[NOTIFICATION] CREATING | recipientUserId: ${recipientUserId} | type: ${notifType} | customerId: ${customerId}`);
        const newNotif = new Notification({
          recipientUserId,
          type: notifType,
          title,
          message: msg,
          customerId,
          phone,
          branchId,
          branchName,
          senderName: customerName,
          messageCount: 1,
          latestMessage: msg,
          latestMessageAt: new Date(),
          sourceMessageId: twilioSid,
          entityType: isNewChat ? "Customer" : "Message",
          entityId: customerId,
          isRead: false,
          isDismissed: false
        });

        await newNotif.save();
        const obj = newNotif.toObject();
        console.log(`[NOTIFICATION] SAVED | notificationId: ${obj._id}`);
        console.log(`[NOTIFICATION] EMITTING notification_created | recipientUserId: ${recipientUserId} | room: user:${recipientUserId}`);
        emitNotificationCreated(obj, recipientUserId);
        createdOrUpdatedList.push(obj);
      }
    }

    return createdOrUpdatedList;
  },

  /**
   * Dispatch staff login notification honoring the strict upward hierarchy.
   */
  async createAssociateLoginNotification({
    associateId,
    actorUserId = null,
    associateName,
    actorName = null,
    actorRole = null,
    branchId = null,
    actorBranchId = null,
    actorBranchName = "",
    sessionId = null
  }) {
    await connectDB();
    const effectiveActorId = actorUserId || associateId;
    const effectiveActorName = actorName || associateName || "Staff Member";
    const effectiveBranchId = actorBranchId || branchId;

    const sourceEventId = sessionId ? `login_${sessionId}` : null;
    if (sourceEventId) {
      const alreadyExists = await Notification.exists({ sourceEventId, type: NotificationTypes.ASSOCIATE_LOGIN });
      if (alreadyExists) return [];
    }

    let branchName = actorBranchName;
    if (!branchName && effectiveBranchId && mongoose.Types.ObjectId.isValid(effectiveBranchId.toString())) {
      const bDoc = await Branch.findById(effectiveBranchId).select("name").lean();
      if (bDoc) branchName = bDoc.name;
    }

    // Resolve user's actual role if not explicitly provided
    let effectiveRole = actorRole;
    if (!effectiveRole && effectiveActorId && mongoose.Types.ObjectId.isValid(effectiveActorId.toString())) {
      const uDoc = await User.findById(effectiveActorId).select("role department").lean();
      if (uDoc) effectiveRole = uDoc.role;
    }

    const recipients = await this.resolveNotificationRecipients({
      type: NotificationTypes.ASSOCIATE_LOGIN,
      actorUserId: effectiveActorId,
      actorRole: effectiveRole,
      actorBranchId: effectiveBranchId,
      branchId: effectiveBranchId
    });

    const isSuper = isSuperAdmin(effectiveRole);
    const isAdmin = !isSuper && (effectiveRole === "admin" || effectiveRole === "doctor_admin" || effectiveRole === "sales_admin");

    let title = "Associate Logged In";
    let message = `${effectiveActorName} logged in`;

    if (isSuper) {
      title = "SuperAdmin Logged In";
      message = `${effectiveActorName} (SuperAdmin) logged in`;
    } else if (isAdmin) {
      title = "Admin Logged In";
      message = `${effectiveActorName} (Admin) logged in`;
    }

    const createdList = [];

    for (const recipient of recipients) {
      const notif = new Notification({
        recipientUserId: recipient._id,
        type: NotificationTypes.ASSOCIATE_LOGIN,
        title,
        message,
        branchId: effectiveBranchId,
        branchName,
        sourceEventId,
        entityType: "AssociateSession",
        entityId: sessionId && mongoose.Types.ObjectId.isValid(sessionId.toString()) ? sessionId : null,
        metadata: {
          actorUserId: effectiveActorId ? effectiveActorId.toString() : null,
          actorName: effectiveActorName,
          actorRole: effectiveRole || "associate",
          actorBranchId: effectiveBranchId ? effectiveBranchId.toString() : null,
          actorBranchName: branchName,
          sessionId: sessionId ? sessionId.toString() : null
        }
      });

      await notif.save();
      const obj = notif.toObject();
      emitNotificationCreated(obj, recipient._id);
      createdList.push(obj);
    }

    return createdList;
  },

  /**
   * Dispatch staff logout notification honoring the strict upward hierarchy.
   */
  async createAssociateLogoutNotification({
    associateId,
    actorUserId = null,
    associateName,
    actorName = null,
    actorRole = null,
    branchId = null,
    actorBranchId = null,
    actorBranchName = "",
    sessionId = null,
    reason = "manual_logout"
  }) {
    await connectDB();
    const effectiveActorId = actorUserId || associateId;
    const effectiveActorName = actorName || associateName || "Staff Member";
    const effectiveBranchId = actorBranchId || branchId;

    const sourceEventId = sessionId ? `logout_${sessionId}_${reason}` : null;
    if (sourceEventId) {
      const alreadyExists = await Notification.exists({ sourceEventId, type: NotificationTypes.ASSOCIATE_LOGOUT });
      if (alreadyExists) return [];
    }

    let branchName = actorBranchName;
    if (!branchName && effectiveBranchId && mongoose.Types.ObjectId.isValid(effectiveBranchId.toString())) {
      const bDoc = await Branch.findById(effectiveBranchId).select("name").lean();
      if (bDoc) branchName = bDoc.name;
    }

    let effectiveRole = actorRole;
    if (!effectiveRole && effectiveActorId && mongoose.Types.ObjectId.isValid(effectiveActorId.toString())) {
      const uDoc = await User.findById(effectiveActorId).select("role department").lean();
      if (uDoc) effectiveRole = uDoc.role;
    }

    const recipients = await this.resolveNotificationRecipients({
      type: NotificationTypes.ASSOCIATE_LOGOUT,
      actorUserId: effectiveActorId,
      actorRole: effectiveRole,
      actorBranchId: effectiveBranchId,
      branchId: effectiveBranchId
    });

    const isTimeout = reason === "session_timeout";
    const isSuper = isSuperAdmin(effectiveRole);
    const isAdmin = !isSuper && (effectiveRole === "admin" || effectiveRole === "doctor_admin" || effectiveRole === "sales_admin");

    let title = isTimeout ? "Session Timed Out" : "Associate Logged Out";
    let message = isTimeout ? `${effectiveActorName}'s session timed out` : `${effectiveActorName} logged out`;

    if (isSuper) {
      title = "SuperAdmin Logged Out";
      message = `${effectiveActorName} logged out`;
    } else if (isAdmin) {
      title = isTimeout ? "Admin Session Timed Out" : "Admin Logged Out";
      message = isTimeout ? `${effectiveActorName}'s session timed out` : `${effectiveActorName} (Admin) logged out`;
    }

    const createdList = [];

    for (const recipient of recipients) {
      const notif = new Notification({
        recipientUserId: recipient._id,
        type: NotificationTypes.ASSOCIATE_LOGOUT,
        title,
        message,
        branchId: effectiveBranchId,
        branchName,
        sourceEventId,
        entityType: "AssociateSession",
        entityId: sessionId && mongoose.Types.ObjectId.isValid(sessionId.toString()) ? sessionId : null,
        metadata: {
          actorUserId: effectiveActorId ? effectiveActorId.toString() : null,
          actorName: effectiveActorName,
          actorRole: effectiveRole || "associate",
          actorBranchId: effectiveBranchId ? effectiveBranchId.toString() : null,
          actorBranchName: branchName,
          sessionId: sessionId ? sessionId.toString() : null,
          reason
        }
      });

      await notif.save();
      const obj = notif.toObject();
      emitNotificationCreated(obj, recipient._id);
      createdList.push(obj);
    }

    return createdList;
  },

  /**
   * Dispatch generic staff operational activity notification.
   */
  async createStaffActivityNotification({
    actorUserId,
    actorName,
    actorRole = null,
    actorBranchId = null,
    actorBranchName = "",
    title,
    message,
    entityType = "StaffActivity",
    entityId = null,
    metadata = {}
  }) {
    await connectDB();
    if (!actorUserId) return [];

    let effectiveRole = actorRole;
    let branchName = actorBranchName;

    if (!effectiveRole || (!branchName && actorBranchId)) {
      const uDoc = await User.findById(actorUserId).select("name role branch").populate("branch", "name").lean();
      if (uDoc) {
        if (!effectiveRole) effectiveRole = uDoc.role;
        if (!branchName && uDoc.branch?.name) branchName = uDoc.branch.name;
      }
    }

    const recipients = await this.resolveNotificationRecipients({
      type: NotificationTypes.STAFF_ACTIVITY,
      actorUserId,
      actorRole: effectiveRole,
      actorBranchId,
      branchId: actorBranchId
    });

    const createdList = [];

    for (const recipient of recipients) {
      const notif = new Notification({
        recipientUserId: recipient._id,
        type: NotificationTypes.STAFF_ACTIVITY,
        title: title || "Staff Activity",
        message: message || `${actorName || "Staff"} performed an action`,
        branchId: actorBranchId,
        branchName,
        entityType,
        entityId: entityId && mongoose.Types.ObjectId.isValid(entityId.toString()) ? entityId : null,
        metadata: {
          actorUserId: actorUserId.toString(),
          actorName,
          actorRole: effectiveRole,
          actorBranchId: actorBranchId ? actorBranchId.toString() : null,
          actorBranchName: branchName,
          ...metadata
        }
      });

      await notif.save();
      const obj = notif.toObject();
      emitNotificationCreated(obj, recipient._id);
      createdList.push(obj);
    }

    return createdList;
  },

  /**
   * Mark notification as READ.
   */
  async markAsRead(notificationId, userId) {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(notificationId)) return null;

    const notif = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientUserId: userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (notif) {
      emitNotificationRead({ notificationId: notif._id, isRead: true }, userId);
    }

    return notif;
  },

  /**
   * Mark notification as UNREAD.
   */
  async markAsUnread(notificationId, userId) {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(notificationId)) return null;

    const notif = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientUserId: userId },
      { $set: { isRead: false, readAt: null } },
      { new: true }
    );

    if (notif) {
      emitNotificationUnread({ notificationId: notif._id, isRead: false }, userId);
    }

    return notif;
  },

  /**
   * Dismiss single notification (mark isDismissed = true).
   */
  async dismissNotification(notificationId, userId) {
    await connectDB();
    if (!mongoose.Types.ObjectId.isValid(notificationId)) return null;

    const notif = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientUserId: userId },
      { $set: { isDismissed: true, dismissedAt: new Date() } },
      { new: true }
    );

    if (notif) {
      emitNotificationDismissed({ notificationId: notif._id }, userId);
    }

    return notif;
  },

  /**
   * Dismiss ALL active notifications for user.
   */
  async clearAllNotifications(userId) {
    await connectDB();
    const result = await Notification.updateMany(
      { recipientUserId: userId, isDismissed: false },
      { $set: { isDismissed: true, dismissedAt: new Date() } }
    );

    emitNotificationClearedAll({}, userId);
    return result;
  },

  /**
   * Safe MongoDB deduplication to guarantee ONE ACTIVE NOTIFICATION per customer for each user.
   */
  async deduplicateUserNotifications(userId) {
    if (!userId) return;
    try {
      await connectDB();
      const { normalizePhone } = await import("@/shared/utils/phoneUtils");
      const activeNotifs = await Notification.find({
        recipientUserId: userId,
        isDismissed: false,
        type: { $in: [NotificationTypes.NEW_MESSAGE, NotificationTypes.NEW_CHAT] }
      }).sort({ updatedAt: -1, createdAt: -1 });

      const seenCustomerKeys = new Set();
      const duplicateIdsToDismiss = [];

      for (const notif of activeNotifs) {
        const key = notif.customerId
          ? `cust_${notif.customerId.toString()}`
          : (notif.phone ? `phone_${normalizePhone(notif.phone)}` : `id_${notif._id.toString()}`);

        if (seenCustomerKeys.has(key)) {
          duplicateIdsToDismiss.push(notif._id);
        } else {
          seenCustomerKeys.add(key);
        }
      }

      if (duplicateIdsToDismiss.length > 0) {
        console.log(`🧹 [NotificationService] Auto-cleaning ${duplicateIdsToDismiss.length} duplicate active notification(s) for user ${userId}`);
        await Notification.updateMany(
          { _id: { $in: duplicateIdsToDismiss } },
          { $set: { isDismissed: true, dismissedAt: new Date() } }
        );
      }
    } catch (err) {
      console.error("[NotificationService] Deduplication cleanup error:", err);
    }
  },

  /**
   * Get paginated notifications for current user (guaranteed one row per customer).
   */
  async getNotifications(userId, { filter = "all", page = 1, limit = 20 } = {}) {
    await connectDB();
    await this.deduplicateUserNotifications(userId);

    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));

    const query = { recipientUserId: userId, isDismissed: false };

    if (filter === "unread") {
      query.isRead = false;
    } else if (filter === "read") {
      query.isRead = true;
    }

    const totalCount = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ recipientUserId: userId, isDismissed: false, isRead: false });

    const notifications = await Notification.find(query)
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean();

    return {
      notifications,
      totalCount,
      unreadCount,
      page: p,
      totalPages: Math.ceil(totalCount / l) || 1
    };
  },

  /**
   * Get unread count for current user.
   */
  async getUnreadCount(userId) {
    await connectDB();
    await this.deduplicateUserNotifications(userId);
    return await Notification.countDocuments({
      recipientUserId: userId,
      isDismissed: false,
      isRead: false
    });
  }
};
