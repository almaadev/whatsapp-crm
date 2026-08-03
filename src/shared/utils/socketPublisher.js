/**
 * Central Socket Event Publisher for the CRM.
 * Handles performance monitoring events (role & branch scoped) as well as legacy events.
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
    global.io.to(phone).emit("incoming-message", payload);
  }
  global.io.emit("incoming-message", payload);
  global.io.emit("new_message", payload);

  // Send telemetry
  const direction = payload.direction || "INBOUND";
  const eventType = direction === "INBOUND" ? "incoming_whatsapp_message" : "outgoing_message";
  publishPerformanceEvent(eventType, {
    phone: payload.phone,
    message: payload.message || "",
    direction,
    branchId,
    timestamp: payload.timestamp || new Date()
  }, branchId || payload.branchId);
}

export function emitCategoryMessage(category, payload, branchId = null) {
  if (!global.io) return;
  const phone = payload.phone;
  if (phone) {
    global.io.to(phone).emit("incoming-message", payload);
  }
  global.io.emit("incoming-message", payload);

  if (category === "Product Lead") {
    global.io.emit("new_product_message", payload);
  } else if (category === "MD Camp") {
    global.io.emit("new_mdcamp_message", payload);
  } else if (category === "Therapy") {
    global.io.emit("new_therapy_message", payload);
  }

  // Also emit as a standard incoming or outgoing chat message
  const direction = payload.direction || "INBOUND";
  const eventType = direction === "INBOUND" ? "incoming_whatsapp_message" : "outgoing_message";
  publishPerformanceEvent(eventType, {
    phone: payload.phone,
    message: payload.message || "",
    direction,
    branchId,
    timestamp: payload.timestamp || new Date()
  }, branchId || payload.branchId);
}

export function emitMessageStatusUpdate(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("message_status_update", payload);
}

export function emitLeadStatusUpdate(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("lead_status_update", payload);
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

  // General customer performance update
  publishPerformanceEvent("customer_assigned", {
    phone: payload.phone,
    assignedTo: payload.assignedTo || payload.associate,
    branchId
  }, branchId);
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
