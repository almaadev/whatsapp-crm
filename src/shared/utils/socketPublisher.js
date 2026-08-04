/**
 * Central Enterprise Socket Event Publisher for the CRM.
 * Handles performance monitoring events (role & branch scoped), room-targeted broadcasts,
 * and unified real-time event dispatching across all CRM business actions.
 */

export function publishPerformanceEvent(eventType, payload, branchId) {
  if (!global.io) return;

  const eventPayload = {
    eventType,
    payload,
    branchId: branchId ? branchId.toString() : null,
    timestamp: new Date().toISOString()
  };

  // 1. Broadcast to Super Admins (room "performance-monitor:all")
  global.io.to("performance-monitor:all").emit("performance_monitor_event", eventPayload);

  // 2. Broadcast to Branch Admins (room "performance-monitor:branch:<branchId>")
  if (branchId) {
    global.io.to(`performance-monitor:branch:${branchId.toString()}`).emit("performance_monitor_event", eventPayload);
  }
}

export function emitNewMessage(payload, branchId = null) {
  if (!global.io) return;
  const phone = payload.phone;
  if (phone) {
    global.io.to(phone).emit("new_message", payload);
  }
  global.io.emit("new_message", payload);

  const targetBranch = branchId || payload.branchId;
  if (targetBranch) {
    global.io.to(`branch:${targetBranch.toString()}`).emit("new_message", payload);
  }

  // Send telemetry
  const direction = payload.direction || "INBOUND";
  const eventType = direction === "INBOUND" ? "incoming_whatsapp_message" : "outgoing_message";
  publishPerformanceEvent(eventType, {
    phone: payload.phone,
    message: payload.message || "",
    direction,
    branchId: targetBranch,
    timestamp: payload.timestamp || new Date()
  }, targetBranch);
}

export function emitCategoryMessage(category, payload, branchId = null) {
  if (!global.io) return;
  const phone = payload.phone;
  
  let catEvent = "new_message";
  if (category === "Product Lead") {
    catEvent = "new_product_message";
  } else if (category === "MD Camp") {
    catEvent = "new_mdcamp_message";
  } else if (category === "Therapy") {
    catEvent = "new_therapy_message";
  }

  if (phone) {
    global.io.to(phone).emit(catEvent, payload);
  }
  global.io.emit(catEvent, payload);

  const targetBranch = branchId || payload.branchId;

  // Also emit as a standard incoming or outgoing chat message
  const direction = payload.direction || "INBOUND";
  const eventType = direction === "INBOUND" ? "incoming_whatsapp_message" : "outgoing_message";
  publishPerformanceEvent(eventType, {
    phone: payload.phone,
    message: payload.message || "",
    direction,
    branchId: targetBranch,
    timestamp: payload.timestamp || new Date()
  }, targetBranch);
}

export function emitMessageStatusUpdate(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("message_status_update", payload);
}

export function emitLeadStatusUpdate(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("lead_status_update", payload);
  global.io.emit("lead_status_changed", payload);

  const targetBranch = branchId || payload.branchId;
  if (targetBranch) {
    global.io.to(`branch:${targetBranch.toString()}`).emit("lead_status_changed", payload);
  }
}

export function emitFollowUpAdded(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("followup_added", payload);
  global.io.emit("lead_status_update", payload);

  const targetBranch = branchId || payload.branchId;
  publishPerformanceEvent("followup_added", payload, targetBranch);
}

export function emitChatLockUpdated(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("chat_lock_updated", payload);

  const eventType = payload.handler ? "lock_chat" : "unlock_chat";
  publishPerformanceEvent(eventType, {
    phone: payload.phone,
    handler: payload.handler,
    branchId
  }, branchId);
}

export function emitChatUnhandled(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("chat_unhandled", payload);

  publishPerformanceEvent("active_chat_closed", {
    phone: payload.phone,
    branchId
  }, branchId);
}

export function emitChatHandled(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("chat_handled", payload);

  publishPerformanceEvent("active_chat_started", {
    phone: payload.phone,
    handler: payload.handler,
    branchId
  }, branchId || payload.handler?.branchId || payload.handler?.branch);
}

export function emitCustomerBranchUpdated(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("customer_branch_updated", payload);
  global.io.emit("customer_updated", payload);

  publishPerformanceEvent("customer_branch_changed", {
    phone: payload.phone,
    branchId: payload.branchId,
    branchName: payload.branchName,
    updatedBy: payload.updatedBy
  }, branchId || payload.branchId);
}

export function emitCustomerUpdated(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("customer_updated", payload);

  const targetBranch = branchId || payload.branchId;
  publishPerformanceEvent("customer_assigned", {
    phone: payload.phone,
    assignedTo: payload.assignedTo || payload.associate,
    branchId: targetBranch
  }, targetBranch);
}

export function emitChatStatusUpdated(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("chat_status_updated", payload);
  global.io.emit("customer_updated", payload);

  const eventType = payload.isChatClosed ? "chat_closed" : "chat_reopened";
  publishPerformanceEvent(eventType, {
    phone: payload.phone,
    isClosed: payload.isChatClosed,
    branchId
  }, branchId);
}

export function emitTemplateSent(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("template_sent", payload);

  const targetBranch = branchId || payload.branchId;
  publishPerformanceEvent("template_sent", payload, targetBranch);
}

export function emitBulkMessageStatus(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("bulk_message_status", payload);

  const targetBranch = branchId || payload.branchId;
  publishPerformanceEvent("bulk_message_status", payload, targetBranch);
}

export function emitDashboardStatsUpdated(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("dashboard_stats_updated", payload);
}
