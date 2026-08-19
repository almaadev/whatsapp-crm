export function resolveLeadStatus(lead) {
  if (!lead) return "New";

  const history = Array.isArray(lead.leads)
    ? lead.leads
    : Array.isArray(lead.followups)
      ? lead.followups
      : [];

  if (history.length === 0) {
    return "New";
  }

  const latest = history[history.length - 1];

  return latest?.status || "New";
}

export const LEAD_STATUS_TRANSITIONS = {
  New: ["Follow Up", "Closed", "Not Interested"],
  "Follow Up": ["Closed", "Not Interested"],
  Closed: ["Follow Up", "Not Interested"],
  "Not Interested": ["Follow Up", "Closed"],
};

export function getAvailableLeadStatuses({
  currentStatus,
  hasLeadHistory,
}) {
  // Truly new lead with no lifecycle history
  if (!hasLeadHistory) {
    return [
      "New",
      "Follow Up",
      "Closed",
      "Not Interested",
    ];
  }

  // Existing lead:
  // New is permanently unavailable and the current status cannot be selected again.
  return LEAD_STATUS_TRANSITIONS[currentStatus] || [];
}

export function isLeadLifecycleActivity(activity) {
  if (!activity) return false;

  // Handle database follow-up items (which don't have an eventType)
  if (!activity.eventType) {
    return ["New", "Follow Up", "Closed", "Not Interested"].includes(activity.status);
  }

  const lifecycleEvents = [
    "CUSTOMER_CREATED",
    "LEAD_CREATED",
    "LEAD_ASSIGNED",
    "CUSTOMER_ASSIGNED",
    "FOLLOWUP_CREATED",
    "FOLLOWUP_COMPLETED",
    "LEAD_STATUS_CHANGED",
    "CHAT_CLOSED",
    "CHAT_REOPENED",
  ];

  if (!lifecycleEvents.includes(activity.eventType)) {
    return false;
  }

  // LEAD_STATUS_CHANGED must specifically represent
  // New / Follow Up / Closed / Not Interested lifecycle states.
  if (activity.eventType === "LEAD_STATUS_CHANGED") {
    const status =
      activity.status ||
      activity.metadata?.status ||
      activity.metadata?.newStatus ||
      activity.metadata?.toStatus;

    return ["New", "Follow Up", "Closed", "Not Interested"].includes(status);
  }

  return true;
}

export function getClosedLeadCount(lead) {
  if (!lead) return 0;

  const history = Array.isArray(lead.leads)
    ? lead.leads
    : Array.isArray(lead.followups)
      ? lead.followups
      : Array.isArray(lead.history)
        ? lead.history
        : [];

  return history.filter(
    (entry) => entry?.status === "Closed"
  ).length;
}

