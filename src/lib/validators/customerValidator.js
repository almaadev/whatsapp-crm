export function validateCustomerUpdate(body) {
  if (!body.phone) {
    return { valid: false, message: "Phone is required" };
  }
  return { valid: true };
}
