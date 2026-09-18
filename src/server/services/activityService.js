import Activity from "../../shared/models/Activity.js";
import User from "../../shared/models/User.js";
import mongoose from "mongoose";
import { ActivityEvents, ActivitySources } from "../../shared/constants/activityConstants.js";
import { getActivityTitle, formatActorDisplayName } from "../../shared/utils/activityFormatter.js";

export const activityService = {
  /**
   * Validates if eventType is a recognized ActivityEvent.
   * Throws an error if eventType is invalid (no silent failures).
   */
  validate(eventType) {
    if (!eventType) {
      throw new Error("Activity Logging Error: eventType is required.");
    }
    const validEvents = Object.values(ActivityEvents);
    if (!validEvents.includes(eventType)) {
      throw new Error(`Activity Logging Error: Invalid eventType '${eventType}'. Allowed events: ${validEvents.join(", ")}`);
    }
  },

  /**
   * Automatically resolves actor user information if actorId is provided.
   * Business Rules:
   * - Webhook / Automatic events -> performedBy: null
   * - SuperAdmin -> "System Admin"
   * - Admin -> "John (Admin)"
   * - Associate / Doctor / Sales -> "Mani" or "Dr. Kumar"
   */
  async resolveActor(actorId, source = null, isAutomatic = false, snapshotFallback = null) {
    if (source === ActivitySources.WEBHOOK || source === "WEBHOOK" || isAutomatic) {
      return {
        performedBy: null,
        performedById: null,
        role: null,
        department: null,
        branch: null
      };
    }

    if (actorId) {
      try {
        if (typeof actorId === "object" && actorId.name) {
          return {
            performedBy: actorId.name || actorId.preferredName,
            performedById: actorId._id ? actorId._id.toString() : null,
            role: actorId.role || "associate",
            department: actorId.department || "",
            branch: actorId.branch ? actorId.branch.toString() : null
          };
        }

        const uId = (typeof actorId === "object" && actorId._id) ? actorId._id : actorId;
        if (mongoose.Types.ObjectId.isValid(uId.toString())) {
          const user = await User.findById(uId).select("name preferredName role department branch").lean();
          if (user) {
            return {
              performedBy: user.name || user.preferredName,
              performedById: user._id.toString(),
              role: user.role || "associate",
              department: user.department || "",
              branch: user.branch ? user.branch.toString() : null
            };
          }
        }
      } catch (e) {
        console.error("[activityService] resolveActor error:", e);
      }
    }

    // Fallback 1: Historical snapshot name
    if (snapshotFallback && typeof snapshotFallback === "string" && snapshotFallback.trim()) {
      return {
        performedBy: snapshotFallback.trim(),
        performedById: null,
        role: "associate",
        department: "",
        branch: null
      };
    }

    // Fallback 2: String actorId (if passed as name string)
    if (typeof actorId === "string" && actorId.trim() && !mongoose.Types.ObjectId.isValid(actorId)) {
      return {
        performedBy: actorId.trim(),
        performedById: null,
        role: "associate",
        department: "",
        branch: null
      };
    }

    // Fallback 3: "Unknown User"
    return {
      performedBy: "Unknown User",
      performedById: null,
      role: "associate",
      department: "",
      branch: null
    };
  },

  /**
   * Standardizes entity metadata.
   */
  resolveEntity(entityType, entityId) {
    return {
      entityType: entityType || "General",
      entityId: entityId ? entityId.toString() : null
    };
  },

  /**
   * Normalizes metadata properties so property names remain consistent.
   */
  formatMetadata(metadata = {}) {
    return {
      oldStatus: metadata.oldStatus || metadata.previousStatus || null,
      newStatus: metadata.newStatus || metadata.status || null,
      oldOwner: metadata.oldOwner || metadata.oldAssignedTo || null,
      newOwner: metadata.newOwner || metadata.assignedTo || null,
      followupDate: metadata.followupDate || metadata.date || null,
      remarks: metadata.remarks || metadata.notes || null,
      templateName: metadata.templateName || metadata.templateSid || null,
      campaignName: metadata.campaignName || null,
      reason: metadata.reason || null,
      phone: metadata.phone || null,
      targetUser: metadata.targetUser || null,
      ...metadata
    };
  },

  /**
   * Assembles standardized activity document payload.
   */
  async buildPayload({ eventType, entityType, entityId, customerId, leadId, conversationId, actorId, targetUserId, metadata = {}, source = ActivitySources.SYSTEM, ipAddress = null, requestId = null }) {
    this.validate(eventType);
    const isWebhookOrAuto = source === ActivitySources.WEBHOOK || source === "WEBHOOK" || metadata.isAutomatic === true;
    const actorInfo = await this.resolveActor(actorId, source, isWebhookOrAuto);
    const entityInfo = this.resolveEntity(entityType, entityId);
    const normalizedMetadata = this.formatMetadata(metadata);

    const title = normalizedMetadata.action || (isWebhookOrAuto && eventType === ActivityEvents.LEAD_CREATED
      ? "New Lead"
      : getActivityTitle(eventType, actorInfo.performedBy ? {
          name: actorInfo.performedBy,
          role: actorInfo.role,
          department: actorInfo.department
        } : null, { ...normalizedMetadata, source }));

    normalizedMetadata.action = title;
    if (actorInfo.performedBy) {
      normalizedMetadata.performedByName = actorInfo.performedBy;
      normalizedMetadata.performedByRole = actorInfo.role;
      normalizedMetadata.performedByDept = actorInfo.department;
    } else {
      normalizedMetadata.performedByName = null;
      normalizedMetadata.performedByRole = null;
      normalizedMetadata.performedByDept = null;
    }

    return {
      customerId: customerId || null,
      leadId: leadId || conversationId || null,
      actorId: actorInfo.performedById || (typeof actorId === "string" ? null : actorId),
      eventType,
      entityType: entityInfo.entityType,
      entityId: entityInfo.entityId,
      metadata: normalizedMetadata,
      source: source || ActivitySources.SYSTEM,
      ipAddress: ipAddress || null,
      requestId: requestId || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  },

  /**
   * The SOLE ENTRY POINT for creating Activity records in the MongoDB database.
   */
  async log(params) {
    try {
      const {
        eventType,
        entityType = "General",
        entityId = null,
        customerId = null,
        leadId = null,
        actorId = null,
        source = ActivitySources.WEB,
        before = null,
        after = null,
        metadata = {}
      } = params;

      this.validate(eventType);

      const isAutomatic = metadata.isAutomatic === true;
      const snapshotName = metadata.performedByName || metadata.performedBy || null;
      const actorInfo = await this.resolveActor(actorId, source, isAutomatic, snapshotName);
      const entityInfo = this.resolveEntity(entityType, entityId);
      const formattedMeta = this.formatMetadata(metadata);

      if (actorInfo.performedBy) {
        formattedMeta.performedBy = actorInfo.performedBy;
        formattedMeta.performedByName = actorInfo.performedBy;
        formattedMeta.performedByRole = actorInfo.role;
        formattedMeta.performedByDept = actorInfo.department;
      }

      const actionTitle = (source === ActivitySources.WEBHOOK && eventType === ActivityEvents.LEAD_CREATED)
        ? "New Lead"
        : getActivityTitle(eventType, actorInfo.performedBy ? {
            name: actorInfo.performedBy,
            role: actorInfo.role,
            department: actorInfo.department
          } : null, formattedMeta);

      formattedMeta.action = actionTitle;

      let validCustomerId = customerId;
      if (typeof validCustomerId === "string" && !mongoose.Types.ObjectId.isValid(validCustomerId)) {
        validCustomerId = null;
      }

      let validActorId = actorInfo.performedById;
      if (!validActorId && actorId && mongoose.Types.ObjectId.isValid(actorId.toString())) {
        validActorId = actorId;
      }

      const activityDoc = await Activity.create({
        customerId: validCustomerId,
        leadId: leadId && mongoose.Types.ObjectId.isValid(leadId.toString()) ? leadId : null,
        actorId: validActorId,
        eventType: eventType,
        before: before,
        after: after,
        metadata: {
          ...formattedMeta,
          entityType: entityInfo.entityType,
          entityId: entityInfo.entityId,
          source: source || ActivitySources.WEB
        }
      });

      return activityDoc;
    } catch (err) {
      console.error("[activityService] Failed to log activity:", err);
      return null;
    }
  },

  /**
   * Dynamically resolves performer names for an activity document.
   */
  async enrichActivity(activity) {
    if (!activity) return activity;
    const obj = typeof activity.toObject === "function" ? activity.toObject() : { ...activity };

    const isWebhookOrAuto = obj.source === ActivitySources.WEBHOOK || obj.source === "WEBHOOK" || obj.metadata?.isAutomatic === true || obj.metadata?.source === "WEBHOOK";

    const snapshotFallback =
      obj.metadata?.performedByName ||
      obj.metadata?.performedBy ||
      obj.performedByName ||
      (typeof obj.performedBy === "string" ? obj.performedBy : null) ||
      null;

    let actorUser = null;
    if (obj.actorId) {
      if (typeof obj.actorId === "object" && obj.actorId.name) {
        actorUser = obj.actorId;
      } else {
        try {
          const uId = obj.actorId._id || obj.actorId;
          if (mongoose.Types.ObjectId.isValid(uId.toString())) {
            actorUser = await User.findById(uId).select("name preferredName role department").lean();
          }
        } catch (e) {}
      }
    }

    const actorInfo = await this.resolveActor(actorUser || obj.actorId, obj.source, isWebhookOrAuto, snapshotFallback);

    const metadata = obj.metadata || {};
    if (actorInfo.performedBy) {
      metadata.performedByName = actorInfo.performedBy;
      metadata.performedByRole = actorInfo.role;
      metadata.performedByDept = actorInfo.department;
    } else {
      metadata.performedByName = null;
      metadata.performedByRole = null;
      metadata.performedByDept = null;
    }

    const formattedLabel = actorInfo.performedBy ? formatActorDisplayName({
      name: actorInfo.performedBy,
      role: actorInfo.role,
      department: actorInfo.department
    }) : null;

    const actionTitle = (isWebhookOrAuto && obj.eventType === ActivityEvents.LEAD_CREATED)
      ? "New Lead"
      : (getActivityTitle(obj.eventType, actorInfo.performedBy ? {
          name: actorInfo.performedBy,
          role: actorInfo.role,
          department: actorInfo.department
        } : null, metadata) || metadata.action || obj.eventType);

    metadata.action = actionTitle;

    return {
      ...obj,
      performedById: actorInfo.performedById,
      performedByName: actorInfo.performedBy,
      performedByRole: actorInfo.role,
      performedByDept: actorInfo.department,
      performedByLabel: formattedLabel,
      performedBy: actorInfo.performedBy ? {
        name: actorInfo.performedBy,
        role: actorInfo.role,
        department: actorInfo.department
      } : null,
      metadata
    };
  },

  async enrichActivities(activities) {
    if (!Array.isArray(activities)) return [];
    return await Promise.all(activities.map(a => this.enrichActivity(a)));
  }
};
