export function emitNewMessage(payload) {
  if (global.io) {
    global.io.emit("new_message", payload);
  }
}

export function emitMessageStatusUpdate(payload) {
  if (global.io) {
    global.io.emit("message_status_update", payload);
  }
}

export function emitLeadStatusUpdate(payload) {
  if (global.io) {
    global.io.emit("lead_status_update", payload);
  }
}
