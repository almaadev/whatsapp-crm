export function validateLeadInput(body) {
  const mobileRaw = body.phone || body.mobile;
  if (!mobileRaw) {
    return { valid: false, message: "Mobile number is required" };
  }

  const validLeadTypes = ["Direct Lead", "MD Camp", "Product Lead", "Therapy"];
  if (body.leadType && !validLeadTypes.includes(body.leadType)) {
    return { valid: false, message: `Invalid leadType. Must be one of: ${validLeadTypes.join(", ")}` };
  }

  return { valid: true };
}

export function validateLeadCloseInput(body) {
  if (!body.phones || !Array.isArray(body.phones) || body.phones.length === 0) {
    return { valid: false, message: "Array of phones is required" };
  }
  return { valid: true };
}
