import twilio from "twilio";

/**
 * Validates Twilio webhook request signature.
 * 
 * @param {Request} req - Next.js Request object
 * @param {Object} body - Parsed request body (key-value params)
 * @returns {boolean} - true if signature is valid or explicitly bypassed
 */
export function validateTwilioWebhookSignature(req, body = {}) {
  // Explicit bypass for testing / local debugging when configured
  if (process.env.TWILIO_VALIDATE_SIGNATURE === "false") {
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

  // Reconstruct full external URL for Twilio validation
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const urlObj = new URL(req.url);
  const fullUrl = host ? `${proto}://${host}${urlObj.pathname}${urlObj.search}` : req.url;

  try {
    const isValid = twilio.validateRequest(authToken, signature, fullUrl, body);
    if (!isValid && req.url !== fullUrl) {
      // Fallback try with exact req.url
      return twilio.validateRequest(authToken, signature, req.url, body);
    }
    return isValid;
  } catch (err) {
    console.error("❌ [TWILIO VALIDATION] Error validating Twilio signature:", err.message);
    return false;
  }
}
