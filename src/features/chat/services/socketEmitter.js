export function emitNewMessage(payload) {
  if (global.io) {
    global.io.emit("new_message", payload);
  }
}

export function emitCategoryMessage(category, payload) {
  if (global.io) {
    if (category === "Product Lead") {
      global.io.emit("new_product_message", payload);
    } else if (category === "MD Camp") {
      global.io.emit("new_mdcamp_message", payload);
    } else if (category === "Therapy") {
      global.io.emit("new_therapy_message", payload);
    }
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
