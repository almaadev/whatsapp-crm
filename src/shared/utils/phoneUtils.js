export function normalizePhone(raw = "") {
  let p = raw.toString().trim();
  p = p.replace("whatsapp:", "").trim();
  if (p && !p.startsWith("+")) p = `+${p}`;
  return p ? `whatsapp:${p}` : "";
}

export function stripWhatsAppPrefix(phone = "") {
  return phone.replace("whatsapp:", "");
}

export function formatForTwilio(phone = "") {
  return phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`;
}
