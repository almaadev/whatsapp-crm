export function validateSendMessage(body) {
  if (!body.phone || !body.message) {
    return { valid: false, message: "Required fields missing: phone and message" };
  }
  return { valid: true };
}

export function validateDeleteChats(body) {
  if (!body.phones || !Array.isArray(body.phones) || body.phones.length === 0) {
    return { valid: false, message: "No phones provided" };
  }
  return { valid: true };
}

export function validateStatusUpdate(body) {
  if (!body.phone || body.isChatClosed === undefined) {
    return { valid: false, message: "phone and isChatClosed are required" };
  }
  return { valid: true };
}
