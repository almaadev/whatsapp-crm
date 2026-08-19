export function normalizePhone(raw = "") {
  if (!raw) return "";
  let p = raw.toString().trim();
  p = p.replace("whatsapp:", "").trim();
  
  // Clean all non-digit characters except the leading '+'
  const hasPlus = p.startsWith("+");
  let digits = p.replace(/\D/g, "");
  if (!digits) return "";
  
  if (hasPlus) {
    p = `+${digits}`;
  } else {
    // If it doesn't start with '+', handle Indian number formatting rules:
    if (digits.length === 10) {
      p = `+91${digits}`;
    } else if (digits.length === 11 && digits.startsWith("0")) {
      p = `+91${digits.substring(1)}`;
    } else if (digits.length === 12 && digits.startsWith("91")) {
      p = `+${digits}`;
    } else if (digits.length === 13 && digits.startsWith("091")) {
      p = `+${digits.substring(1)}`;
    } else {
      p = `+${digits}`; // Fallback: just prepend '+' to whatever digits we have
    }
  }
  
  return p ? `whatsapp:${p}` : "";
}

export function stripWhatsAppPrefix(phone = "") {
  return String(phone || "").replace("whatsapp:", "").trim();
}

export function formatForTwilio(phone = "") {
  const p = String(phone || "").trim();
  if (!p) return "";
  return p.startsWith("whatsapp:") ? p : `whatsapp:${p}`;
}

export function isSamePhone(phoneA = "", phoneB = "") {
  if (!phoneA || !phoneB) return false;
  if (phoneA === phoneB) return true;
  const normA = normalizePhone(phoneA);
  const normB = normalizePhone(phoneB);
  if (normA && normB && normA === normB) return true;

  // Fallback comparison for 10-digit suffixes
  const digitsA = String(phoneA).replace(/\D/g, "");
  const digitsB = String(phoneB).replace(/\D/g, "");
  if (digitsA && digitsB && digitsA.length >= 10 && digitsB.length >= 10) {
    return digitsA.slice(-10) === digitsB.slice(-10);
  }
  return false;
}

export function getPhoneVariations(rawPhone = "") {
  if (!rawPhone) return [];
  const raw = String(rawPhone).trim();
  const canonical = normalizePhone(raw);
  const cleanDigits = raw.replace(/\D/g, "");
  const cleanCanonical = canonical.replace("whatsapp:", "").replace("+", "");

  const variations = new Set();
  if (canonical) variations.add(canonical);
  if (raw) variations.add(raw);
  
  const allDigitSets = new Set([cleanDigits, cleanCanonical].filter(Boolean));
  for (const d of allDigitSets) {
    variations.add(d);
    variations.add(`+${d}`);
    variations.add(`whatsapp:${d}`);
    variations.add(`whatsapp:+${d}`);

    if (d.length === 10) {
      variations.add(`91${d}`);
      variations.add(`+91${d}`);
      variations.add(`whatsapp:91${d}`);
      variations.add(`whatsapp:+91${d}`);
    } else if (d.length === 12 && d.startsWith("91")) {
      const ten = d.substring(2);
      variations.add(ten);
      variations.add(`+${ten}`);
      variations.add(`whatsapp:${ten}`);
      variations.add(`whatsapp:+91${ten}`);
      variations.add(`+91${ten}`);
    }
  }

  return Array.from(variations);
}
