export const getDisplayName = (
  phone,
  incomingName,
  contact
) => {
  if (
    contact?.name &&
    contact.name !== contact.phone
  ) {
    return contact.name;
  }

  if (
    incomingName &&
    incomingName !== "Unknown" &&
    incomingName !== "null" &&
    incomingName.trim() !== ""
  ) {
    return incomingName;
  }

  return phone.replace("whatsapp:", "");
};