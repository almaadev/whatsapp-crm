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
  Cog
} from "lucide-react";
import { ActivityEvents } from "@/shared/constants/activityConstants";

/**
 * Returns a human-readable title for an activity event.
 */
export const getActivityTitle = (eventType, performerName, metadata = {}) => {
  const user = performerName || metadata.performedByName || "System Admin";
  const type = (eventType || "").toUpperCase();
  // Use this for if  you show user name; 
  // by ${user}
  switch (type) {
    case ActivityEvents.CUSTOMER_CREATED:
      return `Customer Created `;
    case ActivityEvents.LEAD_CREATED:
      return `New Lead Created by ${user}`;
    case ActivityEvents.CHAT_STARTED:
      return `Chat Started `;
    case ActivityEvents.CHAT_CLOSED:
      return `Chat Closed `;
    case ActivityEvents.CHAT_REOPENED:
      return `Chat Reopened `;
    case ActivityEvents.LEAD_ASSIGNED:
      const targetUser = metadata.newOwner || metadata.targetUserName || (metadata.targetUser?.name);
      return targetUser ? `Lead Assigned to ${targetUser} by ${user}` : `Lead Assigned by ${user}`;
    case ActivityEvents.CUSTOMER_ASSIGNED:
      const targetCust = metadata.newOwner || metadata.targetUserName || (metadata.targetUser?.name);
      return targetCust ? `Customer Assigned to ${targetCust} by ${user}` : `Customer Assigned by ${user}`;
    case ActivityEvents.FOLLOWUP_CREATED:
      return `Follow Up Created by ${user}`;
    case ActivityEvents.FOLLOWUP_COMPLETED:
      return `Follow Up Completed by ${user}`;
    case ActivityEvents.LEAD_STATUS_CHANGED:
      const newStatus = metadata.newStatus || metadata.status;
      return newStatus ? `Lead Status Changed to ${newStatus} by ${user}` : `Lead Status Changed by ${user}`;
    case ActivityEvents.CUSTOMER_UPDATED:
      return `Customer Profile Updated by ${user}`;
    case ActivityEvents.PROFILE_UPDATED:
      return `Customer Profile Updated by ${user}`;
    case ActivityEvents.ADDRESS_UPDATED:
      return `Customer Address Updated by ${user}`;
    case ActivityEvents.ADDRESS_CHANGED:
      return `Customer Address Updated by ${user}`;
    case ActivityEvents.TEMPLATE_SENT:
      return `Template Sent by ${user}`;
    case ActivityEvents.MESSAGE_RECEIVED:
      return `Message Received`;
    case ActivityEvents.MESSAGE_SENT:
      return `Message Sent by ${user}`;
    default:
      if (metadata.action) return metadata.action;
      const cleanType = eventType ? eventType.replace(/_/g, " ") : "System Action";
      return cleanType.replace(/\b\w/g, c => c.toUpperCase());
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
      return <PlusCircle size={size} className="text-blue-500 shrink-0" />;
    case ActivityEvents.LEAD_CREATED:
      return <Tag size={size} className="text-blue-500 shrink-0" />;
    case ActivityEvents.CHAT_STARTED:
      return <MessageSquare size={size} className="text-blue-500 shrink-0" />;
    case ActivityEvents.CHAT_CLOSED:
      return <Lock size={size} className="text-rose-500 shrink-0" />;
    case ActivityEvents.CHAT_REOPENED:
      return <Unlock size={size} className="text-emerald-500 shrink-0" />;
    case ActivityEvents.LEAD_ASSIGNED:
      return <UserCheck size={size} className="text-indigo-500 shrink-0" />;
    case ActivityEvents.CUSTOMER_ASSIGNED:
      return <UserCheck size={size} className="text-indigo-500 shrink-0" />;
    case ActivityEvents.FOLLOWUP_CREATED:
      return <Clock size={size} className="text-amber-500 shrink-0" />;
    case ActivityEvents.FOLLOWUP_COMPLETED:
      return <Check size={size} className="text-emerald-500 shrink-0" />;
    case ActivityEvents.LEAD_STATUS_CHANGED:
      return <RefreshCw size={size} className="text-violet-500 shrink-0" />;
    case ActivityEvents.CUSTOMER_UPDATED:
      return <User size={size} className="text-indigo-500 shrink-0" />;
    case ActivityEvents.PROFILE_UPDATED:
      return <User size={size} className="text-indigo-500 shrink-0" />;
    case ActivityEvents.ADDRESS_UPDATED:
      return <MapPin size={size} className="text-slate-500 shrink-0" />;
    case ActivityEvents.ADDRESS_CHANGED:
      return <MapPin size={size} className="text-slate-500 shrink-0" />;
    case ActivityEvents.TEMPLATE_SENT:
      return <FileText size={size} className="text-violet-500 shrink-0" />;
    case ActivityEvents.MESSAGE_RECEIVED:
      return <CornerDownRight size={size} className="text-slate-400 shrink-0" />;
    case ActivityEvents.MESSAGE_SENT:
      return <Send size={size} className="text-slate-500 shrink-0" />;
    default:
      return <Cog size={size} className="text-slate-500 shrink-0" />;
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
      return "amber";
    case ActivityEvents.CHAT_STARTED:
    case ActivityEvents.LEAD_CREATED:
    case ActivityEvents.CUSTOMER_CREATED:
      return "blue";
    case ActivityEvents.LEAD_STATUS_CHANGED:
      return "violet";
    case ActivityEvents.LEAD_ASSIGNED:
    case ActivityEvents.CUSTOMER_ASSIGNED:
    case ActivityEvents.CUSTOMER_UPDATED:
    case ActivityEvents.PROFILE_UPDATED:
    case ActivityEvents.ADDRESS_UPDATED:
    case ActivityEvents.ADDRESS_CHANGED:
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
    case ActivityEvents.LEAD_STATUS_CHANGED:
      return metadata.oldStatus && metadata.newStatus ? `${metadata.oldStatus} → ${metadata.newStatus}` : "Lead status updated";
    case ActivityEvents.ADDRESS_UPDATED:
      return metadata.after?.address ? `Address set to ${metadata.after.address}` : "Customer address updated";
    default:
      return "-";
  }
};
