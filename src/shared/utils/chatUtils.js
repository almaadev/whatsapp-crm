import React from "react";
import { Check, CheckCheck, Clock, AlertCircle, Lock, Unlock, MapPin, UserCheck, RefreshCw, Cog, Tag, UserPlus, MessageSquare, User, FileText, Globe, HelpCircle, Building2 } from "lucide-react";
import { formatActorDisplayName } from "@/shared/utils/activityFormatter";

/**
 * Parses a date string into a Date object.
 * Handles various formats, including ISO strings and custom date/time formats.
 *
 * @param {string} dateString - The date string to parse.
 * @returns {Date} A valid Date object.
 */
export const parseMessageDate = (dateString) => {
    if (!dateString) return new Date();
    if (dateString instanceof Date) return dateString;
    if (typeof dateString !== "string") {
        const d = new Date(dateString);
        if (!isNaN(d.getTime())) return d;
        dateString = String(dateString);
    }
    if (dateString.includes("T") || (dateString.includes("-") && dateString.includes(":"))) return new Date(dateString);
    const parts = dateString.split(" ");
    if (parts.length >= 2) {
        const dateParts = parts[0].split("/");
        const timeParts = parts[1].split(":");
        if (dateParts.length === 3) {
            return new Date(
                parseInt(dateParts[2]), parseInt(dateParts[0]) - 1, parseInt(dateParts[1]),
                parseInt(timeParts[0] || 0), parseInt(timeParts[1] || 0), parseInt(timeParts[2] || 0)
            );
        }
    }
    return new Date(dateString);
};

/**
 * Returns a formatted day header string (e.g., "Today", "Yesterday", "Monday", or a full date)
 * based on the difference between the provided date and today.
 *
 * @param {Date} date - The date to evaluate.
 * @returns {string} The formatted header string.
 */
export const getDayHeader = (date) => {
    if (!date || isNaN(date.getTime())) return "Unknown Date";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const targetDay = new Date(date);
    targetDay.setHours(0, 0, 0, 0);

    if (targetDay.getTime() === today.getTime()) {
        return "Today";
    } else if (targetDay.getTime() === yesterday.getTime()) {
        return "Yesterday";
    } else {
        const diffTime = today.getTime() - targetDay.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 7 && diffDays > 0) {
            return targetDay.toLocaleDateString("en-US", { weekday: "long" });
        } else {
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        }
    }
};

/**
 * Formats a Date object into a readable time string (e.g., "10:30 am").
 *
 * @param {Date} date - The date to format.
 * @returns {string} Formatted time string.
 */
export const formatBubbleTime = (date) => {
    if (isNaN(date.getTime())) return "";
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
};

/**
 * Formats an event timestamp into friendly relative/absolute strings:
 * "Today, 03:45 PM", "Yesterday, 11:20 AM", "22 Jul 2026, 03:45 PM"
 */
export const formatEventDateTime = (dateInput) => {
    const date = parseMessageDate(dateInput);
    if (!date || isNaN(date.getTime())) return "";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });

    if (targetDay.getTime() === today.getTime()) {
        return `Today, ${timeStr}`;
    } else if (targetDay.getTime() === yesterday.getTime()) {
        return `Yesterday, ${timeStr}`;
    } else {
        const day = String(date.getDate()).padStart(2, "0");
        const month = date.toLocaleDateString("en-US", { month: "short" });
        const year = date.getFullYear();
        return `${day} ${month} ${year}, ${timeStr}`;
    }
};

/**
 * Maps system event audit data to standard title, Lucide icon, and formatted actor name.
 * Uses formatActorDisplayName to ensure correct performer roles:
 * - SuperAdmin -> "System Admin"
 * - Admin -> "John (Admin)"
 * - Associate -> "Mani"
 * - Unresolved -> "Team Member"
 */
export const getSystemEventDetails = (audit) => {
    if (!audit) {
        return {
            title: "Admin Action",
            icon: React.createElement(Cog, { size: 14, className: "text-slate-500 shrink-0" }),
            performedBy: null,
            hidePerformer: true
        };
    }

    const isWebhookOrAuto = audit.source === "WEBHOOK" || audit.metadata?.source === "WEBHOOK" || audit.metadata?.isAutomatic === true || (!audit.actorId && !audit.performedById && (!audit.performedByName || audit.performedByName === "System Admin") && audit.eventType === "LEAD_CREATED");

    const actorUserObj = typeof audit.actorId === "object" && audit.actorId !== null ? audit.actorId : null;
    const performedByObj = typeof audit.performedBy === "object" && audit.performedBy !== null ? audit.performedBy : null;

    const resolvedName =
        actorUserObj?.name ||
        actorUserObj?.preferredName ||
        performedByObj?.name ||
        performedByObj?.preferredName ||
        (typeof audit.performedBy === "string" && audit.performedBy ? audit.performedBy : null) ||
        audit.performedByName ||
        audit.metadata?.performedByName ||
        audit.metadata?.performedBy ||
        "";

    const resolvedRole =
        actorUserObj?.role ||
        performedByObj?.role ||
        audit.performedByRole ||
        audit.role ||
        audit.metadata?.performedByRole ||
        "";

    const resolvedDept =
        actorUserObj?.department ||
        performedByObj?.department ||
        audit.performedByDept ||
        audit.department ||
        audit.metadata?.performedByDept ||
        "";

    const actorObj = {
        name: resolvedName,
        role: resolvedRole,
        department: resolvedDept
    };

    let performedBy = formatActorDisplayName(actorObj);
    let hidePerformer = false;

    if (isWebhookOrAuto || !actorObj.name) {
      performedBy = null;
      hidePerformer = true;
    }

    const action = audit.eventType || audit.action || "System Action";
    const actionLower = action.toLowerCase();
    const eventTypeUpper = audit.eventType ? audit.eventType.toUpperCase() : "";

    let title = action;
    let icon = React.createElement(Cog, { size: 14, className: "text-slate-500 shrink-0" });

    if (eventTypeUpper) {
      if (eventTypeUpper === "CUSTOMER_CREATED") {
        title = "Customer Created";
        icon = React.createElement(UserPlus, { size: 14, className: "text-[#00a884] shrink-0" });
      } else if (eventTypeUpper === "LEAD_CREATED") {
        title = isWebhookOrAuto ? "New Lead" : "New Lead Created";
        icon = React.createElement(Tag, { size: 14, className: "text-blue-500 shrink-0" });
      } else if (eventTypeUpper === "CHAT_STARTED") {
        title = "Chat Started";
        icon = React.createElement(MessageSquare, { size: 14, className: "text-blue-500 shrink-0" });
      } else if (eventTypeUpper === "CHAT_CLOSED") {
        title = "Chat Closed";
        icon = React.createElement(Lock, { size: 14, className: "text-rose-500 shrink-0" });
      } else if (eventTypeUpper === "CHAT_REOPENED") {
        title = "Chat Reopened";
        icon = React.createElement(Unlock, { size: 14, className: "text-emerald-500 shrink-0" });
      } else if (eventTypeUpper === "LEAD_ASSIGNED") {
        const target = audit.targetUser?.name || audit.metadata?.targetUserName || audit.metadata?.newOwner;
        title = target ? `Lead Assigned to ${target}` : "Lead Assigned";
        icon = React.createElement(UserCheck, { size: 14, className: "text-indigo-500 shrink-0" });
      } else if (eventTypeUpper === "CUSTOMER_ASSIGNED") {
        const target = audit.targetUser?.name || audit.metadata?.targetUserName || audit.metadata?.newOwner;
        title = target ? `Customer Assigned to ${target}` : "Customer Assigned";
        icon = React.createElement(UserCheck, { size: 14, className: "text-indigo-500 shrink-0" });
      } else if (eventTypeUpper === "FOLLOWUP_CREATED") {
        title = "Follow Up Created";
        icon = React.createElement(Clock, { size: 14, className: "text-amber-500 shrink-0" });
      } else if (eventTypeUpper === "FOLLOWUP_COMPLETED") {
        title = "Follow Up Completed";
        icon = React.createElement(Check, { size: 14, className: "text-emerald-500 shrink-0" });
      } else if (eventTypeUpper === "LEAD_STATUS_CHANGED") {
        const newSt = audit.metadata?.newStatus || audit.metadata?.status;
        title = newSt ? `Lead Status Changed to ${newSt}` : "Lead Status Changed";
        icon = React.createElement(RefreshCw, { size: 14, className: "text-violet-500 shrink-0" });
      } else if (eventTypeUpper === "CUSTOMER_UPDATED" || eventTypeUpper === "PROFILE_UPDATED") {
        title = "Customer Profile Updated";
        icon = React.createElement(User, { size: 14, className: "text-indigo-500 shrink-0" });
      } else if (eventTypeUpper === "NAME_UPDATED") {
        title = "Name changed";
        icon = React.createElement(User, { size: 14, className: "text-indigo-500 shrink-0" });
      } else if (eventTypeUpper === "ADDRESS_UPDATED" || eventTypeUpper === "ADDRESS_CHANGED") {
        title = "Address changed";
        icon = React.createElement(MapPin, { size: 14, className: "text-slate-500 shrink-0" });
      } else if (eventTypeUpper === "CITY_UPDATED") {
        title = "City changed";
        icon = React.createElement(MapPin, { size: 14, className: "text-slate-500 shrink-0" });
      } else if (eventTypeUpper === "SOURCE_UPDATED") {
        title = "Source changed";
        icon = React.createElement(Globe, { size: 14, className: "text-blue-500 shrink-0" });
      } else if (eventTypeUpper === "ENQUIRED_FOR_UPDATED") {
        title = "Enquired For changed";
        icon = React.createElement(HelpCircle, { size: 14, className: "text-amber-500 shrink-0" });
      } else if (eventTypeUpper === "LEAD_TYPE_UPDATED") {
        title = "Lead Type changed";
        icon = React.createElement(Tag, { size: 14, className: "text-violet-500 shrink-0" });
      } else if (eventTypeUpper === "BRANCH_UPDATED") {
        title = "Branch changed";
        icon = React.createElement(Building2, { size: 14, className: "text-teal-500 shrink-0" });
      } else if (eventTypeUpper === "OVERALL_REMARKS_UPDATED") {
        title = "Overall Remarks changed";
        icon = React.createElement(FileText, { size: 14, className: "text-indigo-500 shrink-0" });
      } else if (eventTypeUpper === "FOLLOWUP_REMARK_UPDATED") {
        const field = audit.metadata?.field;
        if (field === "day1Remarks") title = "Day 1 Remarks changed";
        else if (field === "day2Remarks") title = "Day 2 Remarks changed";
        else if (field === "day3Remarks") title = "Day 3 Remarks changed";
        else title = "Follow-up Remarks changed";
        icon = React.createElement(Clock, { size: 14, className: "text-amber-500 shrink-0" });
      } else if (eventTypeUpper === "TEMPLATE_SENT") {
        title = "Template Sent";
        icon = React.createElement(FileText, { size: 14, className: "text-violet-500 shrink-0" });
      }
    } else if (actionLower.includes("closed")) {
        title = "Chat Closed";
        icon = React.createElement(Lock, { size: 14, className: "text-rose-500 shrink-0" });
    } else if (actionLower.includes("reopened")) {
        title = "Chat Reopened";
        icon = React.createElement(Unlock, { size: 14, className: "text-emerald-500 shrink-0" });
    } else if (actionLower.includes("assigned")) {
        title = "Lead Assigned";
        icon = React.createElement(UserCheck, { size: 14, className: "text-[#00a884] shrink-0" });
    }

    return {
        title,
        icon,
        performedBy
    };
};

export const mutateLastMessage = (history, updates) => {
    if (!history || history.length === 0) return history;
    const newHistory = [...history];
    newHistory[newHistory.length - 1] = {
        ...newHistory[newHistory.length - 1],
        ...updates
    };
    return newHistory;
};

export const MessageStatusIcon = ({ status }) => {
    const msgStat = (status || "").toUpperCase();
    switch (msgStat) {
        case "SENDING": return React.createElement(Clock, { size: 12, className: "text-slate-400 shrink-0" });
        case "SENT": return React.createElement(Check, { size: 14, className: "text-slate-400 shrink-0" });
        case "DELIVERED": return React.createElement(CheckCheck, { size: 14, className: "text-slate-400 shrink-0" });
        case "UNDELIVERED": return React.createElement(AlertCircle, { size: 12, className: "text-red-500 shrink-0" });
        case "QUEUED" : return React.createElement(Clock, { size: 12, className: "text-yellow-500 shrink-0" });
        case "READ": return React.createElement(CheckCheck, { size: 14, className: "text-blue-500 shrink-0" });
        case "PENDING": return React.createElement(Clock, { size: 12, className: "text-yellow-500 shrink-0" });
        case "FAILED": return React.createElement(AlertCircle, { size: 12, className: "text-red-500 shrink-0" });
        default: return null;
    }
};