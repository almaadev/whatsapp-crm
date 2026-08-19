/**
 * Privacy & Sanitization Utilities.
 * Sanitizes sensitive chat / user assignment information where necessary.
 * Preserves activity timeline audit history details.
 */

export function sanitizeLastHandled(lastHandled, loggedInUser) {
  if (!lastHandled) return null;
  if (!loggedInUser) return lastHandled;

  const isSuperAdmin = loggedInUser.role === "superAdmin";
  const isCurrentHandler = 
    (lastHandled.userId && lastHandled.userId === loggedInUser.id) || 
    (lastHandled.name && lastHandled.name === loggedInUser.name);

  if (isSuperAdmin || isCurrentHandler) {
    return {
      ...lastHandled,
      isCurrentHandler,
      isHandledByOther: !isCurrentHandler,
    };
  }

  return {
    isCurrentHandler: false,
    isHandledByOther: true,
    name: lastHandled.name || "Team Member",
    role: lastHandled.role || "",
    department: lastHandled.department || "",
    userId: lastHandled.userId || "",
  };
}

/**
 * Sanitizes a single chat item from the chat list.
 */
export function sanitizeChat(chat, loggedInUser) {
  if (!chat) return chat;
  return {
    ...chat,
    lastHandled: sanitizeLastHandled(chat.lastHandled, loggedInUser),
  };
}

/**
 * Sanitizes a list of chats.
 */
export function sanitizeChatList(chats, loggedInUser) {
  if (!Array.isArray(chats)) return chats;
  return chats.map((chat) => sanitizeChat(chat, loggedInUser));
}

/**
 * Sanitizes customer/lead history details while preserving authoritative activity timeline performer identity.
 */
export function sanitizeCustomerOrLeadData(data, loggedInUser) {
  if (!data) return data;
  if (!loggedInUser) return data;

  const isSuperAdmin = loggedInUser.role === "superAdmin";
  const sanitized = { ...data };

  // Sanitize creatorInfo
  if (sanitized.creatorInfo) {
    const isCreator = 
      (sanitized.creatorInfo.userId && sanitized.creatorInfo.userId === loggedInUser.id) || 
      (sanitized.creatorInfo.name && sanitized.creatorInfo.name === loggedInUser.name);
      
    if (!isSuperAdmin && !isCreator && !sanitized.creatorInfo.name) {
      sanitized.creatorInfo = {
        name: "Team Member",
        role: "",
        department: "",
        branchName: sanitized.creatorInfo.branchName || "",
      };
    }
  }

  // Preserve chatHistory (Timeline activity logs) - DO NOT anonymize activity performers to "Team Member"
  if (Array.isArray(sanitized.chatHistory)) {
    sanitized.chatHistory = sanitized.chatHistory.map((entry) => ({ ...entry }));
  }

  // Sanitize previous cycles history (leads array)
  if (Array.isArray(sanitized.history)) {
    sanitized.history = sanitized.history.map((cycle) => {
      return { ...cycle };
    });
  }

  return sanitized;
}
