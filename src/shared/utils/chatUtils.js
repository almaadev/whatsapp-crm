import { Check, CheckCheck, Clock, AlertCircle, Lock, Unlock, MapPin, UserCheck, Stethoscope, RefreshCw, Cog, Share2, Tag } from "lucide-react";

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
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = today - msgDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
    
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const dayName = date.toLocaleDateString([], { weekday: 'long' });
    return `${d} ${m} ${y} ${dayName}`;
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
 * Maps system event audit data to standard title, Lucide icon, and formatted username.
 * Supports events: Chat Closed, Chat Reopened, Branch Reassigned, Assigned to Associate,
 * Assigned to Doctor, Status Changed, Transferred, Super Admin Action.
 */
export const getSystemEventDetails = (audit) => {
    if (!audit) {
        return {
            title: "Admin Action",
            icon: <Cog size={14} className="text-slate-500 shrink-0" />,
            performedBy: "Super Admin"
        };
    }

    const action = audit.eventType || audit.action || "Super Admin Action";

    let performedBy = "Super Admin";
    if (audit.performedBy) {
        if (typeof audit.performedBy === "object" && audit.performedBy.name) {
            performedBy = audit.performedBy.name;
        } else if (typeof audit.performedBy === "string") {
            performedBy = audit.performedBy;
        }
    } else if (audit.performedByName) {
        performedBy = audit.performedByName;
    }

    const actionLower = action.toLowerCase();
    const eventType = audit.eventType ? audit.eventType.toLowerCase() : "";

    let title = action;
    let icon = <Cog size={14} className="text-slate-500 shrink-0" />;

    if (eventType === "lead_followup") {
        title = "Follow Up";
        icon = <Clock size={14} className="text-amber-500 shrink-0" />;
    } else if (eventType === "lead_closed") {
        title = "Closed";
        icon = <Check size={14} className="text-rose-500 shrink-0" />;
    } else if (eventType === "lead_not_interested") {
        title = "Status changed to Not Interested";
        icon = <AlertCircle size={14} className="text-slate-500 shrink-0" />;
    } else if (eventType === "lead_new") {
        title = "Status changed to New";
        icon = <RefreshCw size={14} className="text-blue-500 shrink-0" />;
    } else if (eventType === "lead_priority_changed") {
        title = "Priority changed";
        icon = <AlertCircle size={14} className="text-orange-500 shrink-0" />;
    } else if (eventType === "lead_branch_changed" || eventType === "chat branch reassigned") {
        title = "Chat Branch Reassigned";
        icon = <MapPin size={14} className="text-teal-500 shrink-0" />;
    } else if (eventType === "lead_type_changed") {
        title = "Lead Type changed";
        icon = <Tag size={14} className="text-violet-500 shrink-0" />;
    } else if (eventType === "lead_assigned") {
        const targetName = audit.targetUser?.name || audit.targetUserName;
        title = targetName ? `Assigned to ${targetName}` : "Assigned Associate Changed";
        icon = <UserCheck size={14} className="text-indigo-500 shrink-0" />;
    } else if (actionLower.includes("closed")) {
        title = "Chat Closed";
        icon = <Lock size={14} className="text-rose-500 shrink-0" />;
    } else if (actionLower.includes("reopened")) {
        title = "Chat Reopened";
        icon = <Unlock size={14} className="text-emerald-500 shrink-0" />;
    } else if (actionLower.includes("branch") || actionLower.includes("reassigned")) {
        title = "Chat Branch Reassigned";
        icon = <MapPin size={14} className="text-amber-500 shrink-0" />;
    } else if (actionLower.includes("doctor")) {
        const targetName = audit.targetUser?.name || audit.targetUserName;
        title = targetName ? `Assigned to Dr. ${targetName}` : "Assigned to Doctor";
        icon = <Stethoscope size={14} className="text-teal-500 shrink-0" />;
    } else if (actionLower.includes("assigned") || actionLower.includes("associate")) {
        const targetName = audit.targetUser?.name || audit.targetUserName;
        title = targetName ? `Assigned to ${targetName}` : "Assigned to Associate";
        icon = <UserCheck size={14} className="text-blue-500 shrink-0" />;
    } else if (actionLower.includes("transfer") || actionLower.includes("forward")) {
        const targetName = audit.targetUser?.name || audit.targetUserName;
        title = targetName ? `Transferred to ${targetName}` : "Chat Transferred";
        icon = <Share2 size={14} className="text-indigo-500 shrink-0" />;
    } else if (actionLower.includes("status")) {
        title = "Status Changed";
        icon = <RefreshCw size={14} className="text-violet-500 shrink-0" />;
    } else {
        if (!title.startsWith("Chat ") && !title.startsWith("Status") && !title.startsWith("Super Admin ")) {
            title = `Chat ${title}`;
        }
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
        case "SENDING": return <Clock size={12} className="text-slate-400 shrink-0" />;
        case "SENT": return <Check size={14} className="text-slate-400 shrink-0" />;
        case "DELIVERED": return <CheckCheck size={14} className="text-slate-400 shrink-0" />;
        case "UNDELIVERED": return <AlertCircle size={12} className="text-red-500 shrink-0" />;
        case "QUEUED" : return <Clock size={12} className="text-yellow-500 shrink-0" />;
        case "READ": return <CheckCheck size={14} className="text-blue-500 shrink-0" />;
        case "PENDING": return <Clock size={12} className="text-yellow-500 shrink-0" />;
        case "FAILED": return <AlertCircle size={12} className="text-red-500 shrink-0" />;
        default: return null;
    }
};