import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";

/**
 * Parses a date string into a Date object.
 * Handles various formats, including ISO strings and custom date/time formats.
 *
 * @param {string} dateString - The date string to parse.
 * @returns {Date} A valid Date object.
 */
export const parseMessageDate = (dateString) => {
    if (!dateString) return new Date();
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
 * Mutates the last message in a chat history array with the provided updates.
 *
 * @param {Array} history - The chat history array.
 * @param {Object} updates - The fields to update on the last message.
 * @returns {Array} A new array with the mutated last message.
 */
export const mutateLastMessage = (history, updates) => {
    if (!history || history.length === 0) return history;
    const newHistory = [...history];
    newHistory[newHistory.length - 1] = {
        ...newHistory[newHistory.length - 1],
        ...updates
    };
    return newHistory;
};

/**
 * Renders an icon corresponding to the message delivery status (e.g., Sent, Delivered, Read).
 *
 * @param {Object} props
 * @param {string} props.status - The delivery status string.
 * @returns {JSX.Element|null} The status icon component.
 */
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