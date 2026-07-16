import { unauthorized } from "@/lib/utils/responseUtils";

export function requireAuth(session) {
  if (!session || !session.user) {
    return { valid: false, response: unauthorized() };
  }
  return { valid: true };
}

export function requireAdmin(session) {
  const auth = requireAuth(session);
  if (!auth.valid) return auth;

  const isAdmin = 
    session.user.role === "superAdmin" || 
    ((session.user.role === "sales" || session.user.role === "doctor") && session.user.department === "admin");

  if (!isAdmin) {
    return { valid: false, response: unauthorized() }; 
  }

  return { valid: true };
}

export function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === "") {
      return { valid: false, message: `Missing required field: ${field}` };
    }
  }
  return { valid: true };
}
