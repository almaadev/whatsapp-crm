import Activity from "@/shared/models/Activity";
import User from "@/shared/models/User";
import mongoose from "mongoose";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { getActivityTitle, formatActorDisplayName } from "@/shared/utils/activityFormatter";

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
   * - SuperAdmin -> "System Admin"
   * - Admin -> "John (Admin)"
   * - Associate / Doctor / Sales -> "Mani" or "Dr. Kumar"
   */
  async resolveActor(actorId) {
    if (!actorId) {
      return {
        performedBy: "System Admin",
        performedById: null,
        role: "superAdmin",
        department: "admin",
        branch: null
      };
    }

    try {
      if (typeof actorId === "object" && actorId._id) {
        const role = actorId.role || "associate";
        const dept = actorId.department || "";
        const name = actorId.name || actorId.preferredName || "System Admin";
        return {
          performedBy: name,
          performedById: actorId._id.toString(),
          role: role,
          department: dept,
          branch: actorId.branch ? actorId.branch.toString() : null
        };
      }

      if (mongoose.Types.ObjectId.isValid(actorId.toString())) {
        const user = await User.findById(actorId).select("name preferredName role department branch").lean();
        if (user) {
          const role = user.role || "associate";
          const dept = user.department || "";
          const name = user.name || user.preferredName || "System Admin";
          return {
            performedBy: name,
            performedById: user._id.toString(),
            role: role,
            department: dept,
            branch: user.branch ? user.branch.toString() : null
          };
        }
      }
    } catch (e) {
      console.error("[activityService] resolveActor error:", e);
    }

    return {
      performedBy: typeof actorId === "string" ? actorId : "Team Member",
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
    const actorInfo = await this.resolveActor(actorId);
    const entityInfo = this.resolveEntity(entityType, entityId);
    const normalizedMetadata = this.formatMetadata(metadata);

    const title = getActivityTitle(eventType, {
      name: actorInfo.performedBy,
      role: actorInfo.role,
      department: actorInfo.department
    }, normalizedMetadata);

    normalizedMetadata.action = title;
    normalizedMetadata.performedByName = actorInfo.performedBy;
    normalizedMetadata.performedByRole = actorInfo.role;
    normalizedMetadata.performedByDept = actorInfo.department;

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
    const payload = await this.buildPayload(params);
    return await Activity.create(payload);
  },

  /**
   * Server-side activity enrichment helper for API endpoints.
   * Ensures every activity document returns with resolved actor details and display labels.
   */
  async enrichActivity(activity) {
    if (!activity) return activity;
    const obj = typeof activity.toObject === "function" ? activity.toObject() : { ...activity };

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

    const actorInfo = await this.resolveActor(actorUser || obj.actorId);

    const metadata = obj.metadata || {};
    metadata.performedByName = actorInfo.performedBy;
    metadata.performedByRole = actorInfo.role;
    metadata.performedByDept = actorInfo.department;

    const formattedLabel = formatActorDisplayName({
      name: actorInfo.performedBy,
      role: actorInfo.role,
      department: actorInfo.department
    });

    metadata.action = getActivityTitle(obj.eventType, {
      name: actorInfo.performedBy,
      role: actorInfo.role,
      department: actorInfo.department
    }, metadata);

    return {
      ...obj,
      performedById: actorInfo.performedById,
      performedByName: actorInfo.performedBy,
      performedByRole: actorInfo.role,
      performedByDept: actorInfo.department,
      performedByLabel: formattedLabel,
      performedBy: {
        name: actorInfo.performedBy,
        role: actorInfo.role,
        department: actorInfo.department
      },
      metadata
    };
  },

  async enrichActivities(activities) {
    if (!Array.isArray(activities)) return [];
    return await Promise.all(activities.map(a => this.enrichActivity(a)));
  }
};
