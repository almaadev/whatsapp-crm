export function validateTemplateSend(body) {
  if (!body.phone || !body.templateSid) {
    return { valid: false, message: "phone and templateSid are required" };
  }
  return { valid: true };
}

export function validateTemplateInput(body) {
  if (!body.templateName || !body.category) {
    return { valid: false, message: "templateName and category are required" };
  }
  return { valid: true };
}
