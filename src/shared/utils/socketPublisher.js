/**
 * Helper to inspect connected socket count in a room
 */
export function getRoomSocketCount(roomName) {
  if (!global.io) return 0;
  const room = global.io.sockets?.adapter?.rooms?.get(roomName);
  return room ? room.size : 0;
}

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
  if (!global.io) {
    console.warn("⚠️ [SOCKET PUBLISHER] emitNewMessage failed: global.io is undefined");
    return;
  }
  const phone = payload.phone;
  const canonicalPhone = payload.canonicalPhone || phone;
  const customerId = payload.customerId;
  const targetBranch = branchId || payload.branchId;

  console.log(`[SOCKET PUBLISHER] EMIT MESSAGE | event=new_message | customerId=${customerId} | canonicalPhone=${canonicalPhone} | messageId=${payload.messageId || payload._id}`);

  if (phone) {
    const phoneCount = getRoomSocketCount(phone);
    console.log(`[SOCKET DEBUG] message target | room=${phone} | socketCount=${phoneCount}`);
    global.io.to(phone).emit("new_message", payload);
  }
  
  // Broadcast to global CRM event bus
  global.io.emit("new_message", payload);

  if (targetBranch) {
    const branchRoom = `branch:${targetBranch.toString()}`;
    const branchCount = getRoomSocketCount(branchRoom);
    console.log(`[SOCKET DEBUG] message target | room=${branchRoom} | socketCount=${branchCount}`);
    global.io.to(branchRoom).emit("new_message", payload);
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
  emitNewMessage(payload, branchId);
}

export function emitMessageStatusUpdate(payload, branchId = null) {
  if (!global.io) return;
  const phone = payload.phone;
  const sid = payload.sid || payload.twilioSid;
  const status = payload.status;
  const targetBranch = branchId || payload.branchId;

  console.log(`[SOCKET PUBLISHER] EMIT STATUS | event=message_status_update | sid=${sid} | status=${status} | phone=${phone}`);

  if (phone) {
    global.io.to(phone).emit("message_status_update", payload);
  }
  global.io.emit("message_status_update", payload);
  if (targetBranch) {
    global.io.to(`branch:${targetBranch.toString()}`).emit("message_status_update", payload);
  }
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

export function emitAssociateSessionUpdated(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("associate_session_updated", payload);
  const targetBranch = branchId || payload.branchId;
  if (targetBranch) {
    global.io.to(`branch:${targetBranch.toString()}`).emit("associate_session_updated", payload);
  }
}

export function emitNotificationCreated(payload, recipientUserId) {
  if (!global.io || !recipientUserId) return;
  const room = `user:${recipientUserId.toString()}`;
  const socketCount = getRoomSocketCount(room);
  console.log(`[SOCKET DEBUG] message target | room=${room} | socketCount=${socketCount}`);
  console.log(`[SOCKET PUBLISHER] EMIT NOTIFICATION_CREATED | event=notification_created | room=${room} | notificationId=${payload?._id}`);
  global.io.to(room).emit("notification_created", payload);
}

export function emitNotificationUpdated(payload, recipientUserId) {
  if (!global.io || !recipientUserId) return;
  const room = `user:${recipientUserId.toString()}`;
  const socketCount = getRoomSocketCount(room);
  console.log(`[SOCKET DEBUG] message target | room=${room} | socketCount=${socketCount}`);
  console.log(`[SOCKET PUBLISHER] EMIT NOTIFICATION_UPDATED | event=notification_updated | room=${room} | notificationId=${payload?._id}`);
  global.io.to(room).emit("notification_updated", payload);
}

export function emitNotificationRead(payload, recipientUserId) {
  if (!global.io || !recipientUserId) return;
  global.io.to(`user:${recipientUserId.toString()}`).emit("notification_read", payload);
}

export function emitNotificationUnread(payload, recipientUserId) {
  if (!global.io || !recipientUserId) return;
  global.io.to(`user:${recipientUserId.toString()}`).emit("notification_unread", payload);
}

export function emitNotificationDismissed(payload, recipientUserId) {
  if (!global.io || !recipientUserId) return;
  global.io.to(`user:${recipientUserId.toString()}`).emit("notification_dismissed", payload);
}

export function emitNotificationClearedAll(payload, recipientUserId) {
  if (!global.io || !recipientUserId) return;
  global.io.to(`user:${recipientUserId.toString()}`).emit("notification_cleared_all", payload);
}

export function emitChatDeleted(payload, branchId = null) {
  if (!global.io) return;
  global.io.emit("chat_deleted", payload);

  const targetBranch = branchId || payload.branchId;
  if (targetBranch) {
    global.io.to(`branch:${targetBranch.toString()}`).emit("chat_deleted", payload);
  }
}

export function emitUserUpdated(payload) {
  if (!global.io) return;
  global.io.emit("user_updated", payload);
}



