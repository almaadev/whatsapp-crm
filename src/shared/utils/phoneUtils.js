export function normalizePhone(raw = "") {
  if (!raw) return "";
  let p = raw.toString().trim();
  p = p.replace("whatsapp:", "").trim();
  
  // Clean all non-digit characters except the leading '+'
  const hasPlus = p.startsWith("+");
  let digits = p.replace(/\D/g, "");
  
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
  return phone.replace("whatsapp:", "");
}

export function formatForTwilio(phone = "") {
  return phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
}
