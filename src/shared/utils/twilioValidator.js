import twilio from "twilio";
import { getStatusCallbackUrl } from "../../features/admin/services/twilioService.js";

/**
 * Validates Twilio webhook request signature using Twilio's official SDK.
 * 
 * @param {Request} req - Next.js Request object
 * @param {Object} body - Parsed request body (key-value params)
 * @param {string|null} canonicalUrlOverride - Optional canonical URL
 * @returns {boolean} - true if signature is valid according to Twilio SDK
 */
export function validateTwilioWebhookSignature(req, body = {}, canonicalUrlOverride = null) {
  // In production mode, signature validation is mandatory and NEVER bypassed
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction && process.env.TWILIO_VALIDATE_SIGNATURE === "false") {
    return true;
  }

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) {
    console.error("❌ [TWILIO VALIDATION] TWILIO_AUTH_TOKEN is missing in environment variables.");
    return false;
  }

  const signature = req.headers.get("x-twilio-signature") || "";
  if (!signature) {
    console.warn("⚠️ [TWILIO VALIDATION] Missing x-twilio-signature header.");
    return false;
  }

  // 1. Primary & Canonical URL Validation
  let canonicalUrl = canonicalUrlOverride || process.env.TWILIO_STATUS_CALLBACK_URL || null;
  if (!canonicalUrl) {
    try {
      canonicalUrl = getStatusCallbackUrl();
    } catch {
      canonicalUrl = null;
    }
  }

  const urlObj = new URL(req.url);
  const searchStr = urlObj.search || "";

  if (canonicalUrl) {
    const cleanCanonical = canonicalUrl.replace(/\/+$/, "");
    const targetCanonical = cleanCanonical + searchStr;
    const isValidCanonical = twilio.validateRequest(authToken, signature, targetCanonical, body);
    if (isValidCanonical) {
      return true;
    }
    // Also try canonical without search if search was present
    if (searchStr && twilio.validateRequest(authToken, signature, cleanCanonical, body)) {
      return true;
    }
  }

  // 2. Trusted Reverse Proxy Reconstructed URL
  // Only trust proxy headers when matching configured/known trusted host domains
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const rawHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const host = rawHost.trim().toLowerCase();

  const TRUSTED_DOMAINS = [
    "whatsapp.almaaerp.in",
    "crm.almaaerp.in",
    (process.env.HOST || "").toLowerCase(),
    "localhost",
    "127.0.0.1",
  ].filter(Boolean);

  const isTrustedHost = TRUSTED_DOMAINS.some(
    (td) => host === td || host.startsWith(`${td}:`) || host.endsWith(`.${td}`)
  );

  if (isTrustedHost && host) {
    const fullUrl = `${proto}://${host}${urlObj.pathname}${searchStr}`;
    if (twilio.validateRequest(authToken, signature, fullUrl, body)) {
      return true;
    }
  }

  // 3. Exact req.url fallback
  if (twilio.validateRequest(authToken, signature, req.url, body)) {
    return true;
  }

  return false;
}
