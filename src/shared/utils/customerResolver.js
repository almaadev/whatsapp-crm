/**
 * Universal Customer Display Resolver
 *
 * Implements strict display name priority:
 * 1. Customer Name (from Customer or Lead record)
 * 2. Saved Contact Name
 * 3. WhatsApp Profile Name (from Message history / webhook profileName / senderName)
 * 4. Phone Number (only if no name exists, cleanly formatted without "whatsapp:" prefix)
 */

/**
 * Clean phone numbers by stripping "whatsapp:" prefix and trimming whitespace.
 * @param {string} phone
 * @returns {string} Cleaned phone number
 */
export function cleanPhoneNumber(phone) {
  if (!phone) return "";
  return String(phone).replace(/whatsapp:/gi, "").trim();
}

/**
 * Validates whether a candidate name string is a legitimate customer name.
 * Rejects "Unknown", "null", "undefined", raw phone strings, and bot names.
 * @param {string} candidate
 * @param {string} [rawPhone]
 * @returns {boolean}
 */
export function isValidDisplayName(candidate, rawPhone) {
  if (!candidate || typeof candidate !== "string") return false;
  const trimmed = candidate.trim();
  if (!trimmed) return false;

  const lower = trimmed.toLowerCase();
  if (
    lower === "unknown" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "unassigned" ||
    lower.startsWith("whatsapp:")
  ) {
    return false;
  }

  // Reject system automation names
  if (
    lower === "auto answer" ||
    lower === "system automation" ||
    lower === "system" ||
    lower === "twilio bot"
  ) {
    return false;
  }

  // Reject if candidate is identical to raw phone or cleaned phone
  if (rawPhone) {
    const cleanedRaw = cleanPhoneNumber(rawPhone);
    const cleanedCand = cleanPhoneNumber(trimmed);
    if (cleanedCand === cleanedRaw || trimmed === rawPhone) {
      return false;
    }
  }

  return true;
}

/**
 * Universal Customer Display Resolver
 *
 * Evaluates candidate names according to the required priority order.
 *
 * @param {Object|string} input - Source data containing customer fields, lead fields, or history
 * @returns {string} The resolved display name for the customer
 */
export function resolveCustomerDisplayName(input = {}) {
  if (!input) return "";

  if (typeof input === "string") {
    if (isValidDisplayName(input)) return input.trim();
    return cleanPhoneNumber(input);
  }

  const phone = input.phone || input.phoneNumber || input.customerPhone || "";
  const rawPhoneClean = cleanPhoneNumber(phone);

  // Level 1: Customer Name (from Customer / Lead / Direct properties)
  const candidate1 =
    input.customer?.name ||
    input.lead?.name ||
    input.customerName ||
    input.name;
  if (isValidDisplayName(candidate1, phone)) {
    return candidate1.trim();
  }

  // Level 2: Saved Contact Name
  const candidate2 =
    input.contactName ||
    input.customer?.contactName ||
    input.savedContactName;
  if (isValidDisplayName(candidate2, phone)) {
    return candidate2.trim();
  }

  // Level 3: WhatsApp Profile Name (from direct property)
  const candidate3 =
    input.profileName ||
    input.senderName ||
    input.customer?.profileName;
  if (isValidDisplayName(candidate3, phone)) {
    return candidate3.trim();
  }

  // Level 3 (cont.): Inspect message history for inbound senderName / profileName
  const history = input.history || input.messages || input.chatHistory || [];
  if (Array.isArray(history) && history.length > 0) {
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i];
      if (msg) {
        const msgSender = msg.senderName || msg.profileName;
        if (isValidDisplayName(msgSender, phone)) {
          return msgSender.trim();
        }
      }
    }
  }

  // Level 4: Phone Number (clean, without "whatsapp:" prefix)
  if (rawPhoneClean) {
    return rawPhoneClean;
  }

  return "Unknown";
}

export default resolveCustomerDisplayName;
