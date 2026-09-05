import React from "react";
import {
  MessageSquare,
  Lock,
  Unlock,
  User,
  MapPin,
  Tag,
  Clock,
  Check,
  Send,
  CornerDownRight,
  FileText,
  UserCheck,
  RefreshCw,
  PlusCircle,
  Cog,
  Globe,
  HelpCircle,
  Building2
} from "lucide-react";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";

/**
 * Authoritative Display Name Resolver for Activity Performers / Actors.
 * Resolution Priority:
 * 1. Current User Name (actor.name / actor.preferredName)
 * 2. Historical Snapshot Name (performedBy / performedByName)
 * 3. System / Admin fallback by role
 * 4. Fallback -> "Team Member"
 */
export function formatActorDisplayName(actor) {
  if (!actor) return "Team Member";

  if (typeof actor === "string") {
    const trimmed = actor.trim();
    if (!trimmed || trimmed.toLowerCase() === "unknown") return "Team Member";
    return trimmed;
  }

  const name = actor.name || actor.preferredName || actor.performedBy || actor.performedByName || "";
  if (name && name.trim()) {
    return name.trim();
  }

  const role = actor.role || actor.performedByRole || "";
  if (role === "superAdmin" || role === "system") {
    return "System Admin";
  }
  if (role === "admin") {
    return "Admin";
  }

  return "Team Member";
}

/**
 * Returns a standardized human-readable title for an activity event.
 */
export const getActivityTitle = (eventType, performerInput, metadata = {}) => {
  const actorObj = typeof performerInput === "object" ? performerInput : {
    name: performerInput || metadata.performedByName || metadata.performedBy,
    role: metadata.performedByRole,
    department: metadata.performedByDept
  };

  const isWebhookOrAuto = metadata.source === "WEBHOOK" || metadata.source === ActivitySources.WEBHOOK || metadata.isAutomatic === true || (!actorObj?.name && !metadata.performedByName);

  const actorLabel = formatActorDisplayName(actorObj);
  const type = (eventType || "").toUpperCase();

  switch (type) {
    case ActivityEvents.CUSTOMER_CREATED:
      return `Customer Created`;
    case ActivityEvents.LEAD_CREATED:
      return isWebhookOrAuto ? `New Lead` : `New Lead Created`;
    case ActivityEvents.CHAT_STARTED:
      return `Chat Started`;
    case ActivityEvents.CHAT_CLOSED:
      return actorLabel && actorLabel !== "Team Member" ? `Chat Closed by ${actorLabel}` : `Chat Closed`;
    case ActivityEvents.CHAT_REOPENED:
      return actorLabel && actorLabel !== "Team Member" ? `Chat Reopened by ${actorLabel}` : `Chat Reopened`;
    case ActivityEvents.CHAT_LOCKED:
      return actorLabel && actorLabel !== "Team Member" ? `Chat Locked by ${actorLabel}` : `Chat Locked`;
    case ActivityEvents.CHAT_UNLOCKED:
      return actorLabel && actorLabel !== "Team Member" ? `Chat Unlocked by ${actorLabel}` : `Chat Unlocked`;
    case ActivityEvents.LEAD_ASSIGNED: {
      const isTransfer = metadata.isTransfer || metadata.isForwarded || (metadata.oldOwner && metadata.oldOwner.toLowerCase() !== "unassigned" && metadata.newOwner && metadata.oldOwner !== metadata.newOwner);
      const targetUser = metadata.newOwner || metadata.targetUserName || (metadata.targetUser?.name);
      if (isTransfer) {
        return metadata.oldOwner && metadata.oldOwner.toLowerCase() !== "unassigned" && targetUser
          ? `Lead Transferred from ${metadata.oldOwner} to ${targetUser} by ${actorLabel}`
          : targetUser
            ? `Lead Transferred to ${targetUser} by ${actorLabel}`
            : `Lead Transferred by ${actorLabel}`;
      }
      return targetUser ? `Lead Assigned to ${targetUser} by ${actorLabel}` : `Lead Assigned by ${actorLabel}`;
    }
    case ActivityEvents.CUSTOMER_ASSIGNED: {
      const isTransfer = metadata.isTransfer || metadata.isForwarded || (metadata.oldOwner && metadata.oldOwner.toLowerCase() !== "unassigned" && metadata.newOwner && metadata.oldOwner !== metadata.newOwner);
      const targetCust = metadata.newOwner || metadata.targetUserName || (metadata.targetUser?.name);
      if (isTransfer) {
        return metadata.oldOwner && metadata.oldOwner.toLowerCase() !== "unassigned" && targetCust
          ? `Customer Transferred from ${metadata.oldOwner} to ${targetCust} by ${actorLabel}`
          : targetCust
            ? `Customer Transferred to ${targetCust} by ${actorLabel}`
            : `Customer Transferred by ${actorLabel}`;
      }
      return targetCust ? `Customer Assigned to ${targetCust} by ${actorLabel}` : `Customer Assigned by ${actorLabel}`;
    }
    case ActivityEvents.FOLLOWUP_CREATED:
      return actorLabel && actorLabel !== "Team Member" ? `Follow Up Created by ${actorLabel}` : `Follow Up Created`;
    case ActivityEvents.FOLLOWUP_COMPLETED:
      return actorLabel && actorLabel !== "Team Member" ? `Lead Closed by ${actorLabel}` : `Lead Closed`;
    case ActivityEvents.LEAD_STATUS_CHANGED: {
      const newStatus = metadata.newStatus || metadata.status;
      return newStatus ? `Lead Status Changed to ${newStatus} by ${actorLabel}` : `Lead Status Changed by ${actorLabel}`;
    }
    case ActivityEvents.CUSTOMER_UPDATED:
    case ActivityEvents.PROFILE_UPDATED:
      return `Customer Profile Updated by ${actorLabel}`;
    case ActivityEvents.NAME_UPDATED:
      return `Name changed by ${actorLabel}`;
    case ActivityEvents.ADDRESS_UPDATED:
    case ActivityEvents.ADDRESS_CHANGED:
      return `Address changed by ${actorLabel}`;
    case ActivityEvents.CITY_UPDATED:
      return `City changed by ${actorLabel}`;
    case ActivityEvents.SOURCE_UPDATED:
      return `Source changed by ${actorLabel}`;
    case ActivityEvents.ENQUIRED_FOR_UPDATED:
      return `Enquired For changed by ${actorLabel}`;
    case ActivityEvents.LEAD_TYPE_UPDATED:
      return `Lead Type changed by ${actorLabel}`;
    case ActivityEvents.BRANCH_UPDATED:
      return `Branch changed by ${actorLabel}`;
    case ActivityEvents.OVERALL_REMARKS_UPDATED:
      return actorLabel && actorLabel !== "Team Member" ? `Overall Remarks changed by ${actorLabel}` : `Overall Remarks changed`;
    case ActivityEvents.FOLLOWUP_REMARK_UPDATED:
      if (metadata.field === "day1Remarks") return `Day 1 Remarks changed by ${actorLabel}`;
      if (metadata.field === "day2Remarks") return `Day 2 Remarks changed by ${actorLabel}`;
      if (metadata.field === "day3Remarks") return `Day 3 Remarks changed by ${actorLabel}`;
      return `Follow-up Remarks changed by ${actorLabel}`;
    case ActivityEvents.TEMPLATE_SENT:
      return `Template Sent`;
    case ActivityEvents.MESSAGE_RECEIVED:
      return `Message Received`;
    case ActivityEvents.MESSAGE_SENT:
      return actorLabel && actorLabel !== "Team Member" ? `Message Sent by ${actorLabel}` : `Message Sent`;
    default:
      if (metadata.action) return metadata.action;
      const cleanType = eventType ? eventType.toLowerCase().replace(/_/g, " ") : "system action";
      return `${cleanType.replace(/\b\w/g, c => c.toUpperCase())} by ${actorLabel}`;
  }
};

/**
 * Returns the appropriate Lucide React icon element.
 */
export const getActivityIcon = (eventType) => {
  const type = (eventType || "").toUpperCase();
  const size = 14;

  switch (type) {
    case ActivityEvents.CUSTOMER_CREATED:
      return React.createElement(PlusCircle, { size, className: "text-blue-500 shrink-0" });
    case ActivityEvents.LEAD_CREATED:
      return React.createElement(Tag, { size, className: "text-blue-500 shrink-0" });
    case ActivityEvents.CHAT_STARTED:
      return React.createElement(MessageSquare, { size, className: "text-blue-500 shrink-0" });
    case ActivityEvents.CHAT_CLOSED:
      return React.createElement(Lock, { size, className: "text-rose-500 shrink-0" });
    case ActivityEvents.CHAT_REOPENED:
      return React.createElement(Unlock, { size, className: "text-emerald-500 shrink-0" });
    case ActivityEvents.LEAD_ASSIGNED:
    case ActivityEvents.CUSTOMER_ASSIGNED:
      return React.createElement(UserCheck, { size, className: "text-indigo-500 shrink-0" });
    case ActivityEvents.FOLLOWUP_CREATED:
      return React.createElement(Clock, { size, className: "text-amber-500 shrink-0" });
    case ActivityEvents.FOLLOWUP_COMPLETED:
      return React.createElement(Check, { size, className: "text-emerald-500 shrink-0" });
    case ActivityEvents.LEAD_STATUS_CHANGED:
      return React.createElement(RefreshCw, { size, className: "text-violet-500 shrink-0" });
    case ActivityEvents.CUSTOMER_UPDATED:
    case ActivityEvents.PROFILE_UPDATED:
    case ActivityEvents.NAME_UPDATED:
      return React.createElement(User, { size, className: "text-indigo-500 shrink-0" });
    case ActivityEvents.ADDRESS_UPDATED:
    case ActivityEvents.ADDRESS_CHANGED:
    case ActivityEvents.CITY_UPDATED:
      return React.createElement(MapPin, { size, className: "text-slate-500 shrink-0" });
    case ActivityEvents.SOURCE_UPDATED:
      return React.createElement(Globe, { size, className: "text-blue-500 shrink-0" });
    case ActivityEvents.ENQUIRED_FOR_UPDATED:
      return React.createElement(HelpCircle, { size, className: "text-amber-500 shrink-0" });
    case ActivityEvents.LEAD_TYPE_UPDATED:
      return React.createElement(Tag, { size, className: "text-violet-500 shrink-0" });
    case ActivityEvents.BRANCH_UPDATED:
      return React.createElement(Building2, { size, className: "text-teal-500 shrink-0" });
    case ActivityEvents.OVERALL_REMARKS_UPDATED:
      return React.createElement(FileText, { size, className: "text-indigo-500 shrink-0" });
    case ActivityEvents.FOLLOWUP_REMARK_UPDATED:
      return React.createElement(Clock, { size, className: "text-amber-500 shrink-0" });
    case ActivityEvents.TEMPLATE_SENT:
      return React.createElement(FileText, { size, className: "text-violet-500 shrink-0" });
    case ActivityEvents.MESSAGE_RECEIVED:
      return React.createElement(CornerDownRight, { size, className: "text-slate-400 shrink-0" });
    case ActivityEvents.MESSAGE_SENT:
      return React.createElement(Send, { size, className: "text-slate-500 shrink-0" });
    default:
      return React.createElement(Cog, { size, className: "text-slate-500 shrink-0" });
  }
};

/**
 * Returns color classes for timeline indicators.
 */
export const getActivityColor = (eventType) => {
  const type = (eventType || "").toUpperCase();

  switch (type) {
    case ActivityEvents.CHAT_CLOSED:
      return "rose";
    case ActivityEvents.CHAT_REOPENED:
    case ActivityEvents.FOLLOWUP_COMPLETED:
      return "emerald";
    case ActivityEvents.FOLLOWUP_CREATED:
    case ActivityEvents.FOLLOWUP_REMARK_UPDATED:
    case ActivityEvents.ENQUIRED_FOR_UPDATED:
      return "amber";
    case ActivityEvents.CHAT_STARTED:
    case ActivityEvents.LEAD_CREATED:
    case ActivityEvents.CUSTOMER_CREATED:
    case ActivityEvents.SOURCE_UPDATED:
      return "blue";
    case ActivityEvents.LEAD_STATUS_CHANGED:
    case ActivityEvents.LEAD_TYPE_UPDATED:
      return "violet";
    case ActivityEvents.LEAD_ASSIGNED:
    case ActivityEvents.CUSTOMER_ASSIGNED:
    case ActivityEvents.CUSTOMER_UPDATED:
    case ActivityEvents.PROFILE_UPDATED:
    case ActivityEvents.NAME_UPDATED:
    case ActivityEvents.ADDRESS_UPDATED:
    case ActivityEvents.ADDRESS_CHANGED:
    case ActivityEvents.CITY_UPDATED:
    case ActivityEvents.BRANCH_UPDATED:
    case ActivityEvents.OVERALL_REMARKS_UPDATED:
      return "indigo";
    default:
      return "slate";
  }
};

/**
 * Returns badge label for an activity event.
 */
export const getActivityBadge = (eventType) => {
  const type = (eventType || "").toUpperCase();
  return type.replace(/_/g, " ");
};

/**
 * Returns human-readable description/notes for an activity event.
 */
export const getActivityDescription = (eventType, metadata = {}) => {
  if (metadata.remarks || metadata.notes) {
    return metadata.remarks || metadata.notes;
  }
  const type = (eventType || "").toUpperCase();
  switch (type) {
    case ActivityEvents.CUSTOMER_CREATED:
      return metadata.notes || metadata.remarks || "Customer profile created";
    case ActivityEvents.LEAD_CREATED:
      return metadata.notes || metadata.remarks || "New lead created";
    case ActivityEvents.LEAD_STATUS_CHANGED:
      return metadata.oldStatus && metadata.newStatus ? `${metadata.oldStatus} → ${metadata.newStatus}` : "Lead status updated";
    case ActivityEvents.ADDRESS_UPDATED:
      return metadata.after?.address ? `Address set to ${metadata.after.address}` : "Customer address updated";
    default:
      return "-";
  }
};
