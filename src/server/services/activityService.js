import Activity from "@/shared/models/Activity";
import User from "@/shared/models/User";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { getActivityTitle } from "@/shared/utils/activityFormatter";

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
   */
  async resolveActor(actorId) {
    if (!actorId) {
      return {
        performedBy: "System Admin",
        performedById: null,
        role: "system",
        branch: null
      };
    }

    try {
      if (typeof actorId === "object" && actorId._id) {
        return {
          performedBy: actorId.name || "System Admin",
          performedById: actorId._id.toString(),
          role: actorId.role || "associate",
          branch: actorId.branch ? actorId.branch.toString() : null
        };
      }

      const user = await User.findById(actorId).lean();
      if (user) {
        return {
          performedBy: user.name || "System Admin",
          performedById: user._id.toString(),
          role: user.role || "associate",
          branch: user.branch ? user.branch.toString() : null
        };
      }
    } catch (e) {
      // Gracefully catch cases where actorId is a string name instead of ObjectId
    }

    return {
      performedBy: typeof actorId === "string" ? actorId : "System Admin",
      performedById: null,
      role: "associate",
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

    const title = getActivityTitle(eventType, actorInfo.performedBy, normalizedMetadata);
    normalizedMetadata.action = title;
    normalizedMetadata.performedByName = actorInfo.performedBy;
    normalizedMetadata.performedByRole = actorInfo.role;

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
  }
};
