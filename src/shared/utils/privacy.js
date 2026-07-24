/**
 * Sanitizes chat lastHandled info.
 * @param {Object} lastHandled
 * @param {Object} loggedInUser
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

  // Anonymize
  return {
    isCurrentHandler: false,
    isHandledByOther: true,
    name: "Team Member",
    role: "",
    department: "",
    userId: "",
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
 * Sanitizes customer/lead history details.
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
      
    if (!isSuperAdmin && !isCreator) {
      sanitized.creatorInfo = {
        name: "Team Member",
        role: "",
        department: "",
        branchName: sanitized.creatorInfo.branchName || "",
      };
    }
  }

  // Sanitize assignedTo / associate
  if (sanitized.assignedTo && sanitized.assignedTo !== "Unassigned") {
    if (!isSuperAdmin && sanitized.assignedTo !== loggedInUser.name) {
      sanitized.assignedTo = "Team Member";
    }
  }
  if (sanitized.associate && sanitized.associate !== "Unassigned") {
    if (!isSuperAdmin && sanitized.associate !== loggedInUser.name) {
      sanitized.associate = "Team Member";
    }
  }

  // Sanitize chatHistory (Timeline logs)
  if (Array.isArray(sanitized.chatHistory)) {
    sanitized.chatHistory = sanitized.chatHistory.map((entry) => {
      const isPerformer = 
        entry.performedById === loggedInUser.id || 
        entry.performedByName === loggedInUser.name || 
        (entry.performedBy && (entry.performedBy.name === loggedInUser.name || entry.performedBy === loggedInUser.name));

      const entryCopy = { ...entry };

      if (!isSuperAdmin && !isPerformer) {
        // Anonymize performedBy
        if (entryCopy.performedBy && typeof entryCopy.performedBy === "object") {
          entryCopy.performedBy = {
            ...entryCopy.performedBy,
            name: "Team Member",
            role: "",
            department: "",
          };
        } else if (typeof entryCopy.performedBy === "string") {
          entryCopy.performedBy = "Team Member";
        }

        if (entryCopy.performedByName) {
          entryCopy.performedByName = "Team Member";
        }
        if (entryCopy.performedByRole) {
          entryCopy.performedByRole = "";
        }
      }

      // Sanitize targetUser if present
      if (entryCopy.targetUser) {
        const isTarget = 
          entryCopy.targetUser.userId === loggedInUser.id || 
          entryCopy.targetUser.name === loggedInUser.name;
          
        if (!isSuperAdmin && !isTarget) {
          entryCopy.targetUser = {
            ...entryCopy.targetUser,
            name: "Team Member",
            role: "",
            department: "",
          };
        }
      }

      return entryCopy;
    });
  }

  // Sanitize previous cycles history (leads array)
  if (Array.isArray(sanitized.history)) {
    sanitized.history = sanitized.history.map((cycle) => {
      const isAssociate = 
        cycle.associateId === loggedInUser.id || 
        cycle.associateName === loggedInUser.name;
        
      if (!isSuperAdmin && !isAssociate) {
        return {
          ...cycle,
          associateName: "Team Member",
          associateId: "",
        };
      }
      return cycle;
    });
  }

  // If used on a raw Customer document that has leads (e.g. inside Customer.toObject())
  if (Array.isArray(sanitized.leads)) {
    sanitized.leads = sanitized.leads.map((cycle) => {
      const isAssociate = 
        cycle.associateId === loggedInUser.id || 
        cycle.associateName === loggedInUser.name;
        
      if (!isSuperAdmin && !isAssociate) {
        return {
          ...cycle,
          associateName: "Team Member",
          associateId: "",
        };
      }
      return cycle;
    });
  }

  return sanitized;
}
