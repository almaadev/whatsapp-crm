import { create } from "zustand";
import { normalizePhone, isSamePhone } from "@/shared/utils/phoneUtils";
import { resolveCustomerDisplayName, isValidDisplayName } from "@/shared/utils/customerResolver";

/**
 * Robust check if two conversation references represent the same customer/chat thread.
 * 1. CustomerId matching (Primary identity)
 * 2. Canonical Phone / Phone identity matching (Secondary identity)
 */
export const isSameConversation = (chatA, chatB) => {
  if (!chatA || !chatB) return false;

  // 1. Primary: Match by customerId
  const idA = chatA.customerId || (chatA._id && !chatA.message && chatA.phone ? chatA._id : null);
  const idB = chatB.customerId || (chatB._id && !chatB.message && chatB.phone ? chatB._id : null);
  if (idA && idB && String(idA) === String(idB)) {
    return true;
  }

  // 2. Secondary: Match by canonical phone / phone identity
  const phoneA = chatA.canonicalPhone || chatA.phone;
  const phoneB = chatB.canonicalPhone || chatB.phone;
  if (phoneA && phoneB && isSamePhone(phoneA, phoneB)) {
    return true;
  }

  return false;
};

/**
 * Shared helper to check if a local optimistic update is recent (under 15s).
 * Prevents stale remote data from immediately overwriting optimistic UI states.
 */
const isRecentOptimisticUpdate = (localUpdatedAt) => {
  return localUpdatedAt && Date.now() - localUpdatedAt < 15000;
};

/**
 * Shared helper to check if two messages are duplicates based on ID, twilio SID, content, direction, and timestamp proximity.
 */
const isMessageDuplicate = (existingMessage, newMessage) => {
  if (!existingMessage || !newMessage) return false;

  // 1. Explicit ID matches (Primary Identity)
  if (newMessage._id && existingMessage._id && String(existingMessage._id) === String(newMessage._id)) return true;
  if (newMessage.messageId && (existingMessage.messageId === newMessage.messageId || String(existingMessage._id) === String(newMessage.messageId))) return true;
  if (newMessage.twilioSid && existingMessage.twilioSid && existingMessage.twilioSid === newMessage.twilioSid) return true;
  if (newMessage.tempId && existingMessage.tempId && existingMessage.tempId === newMessage.tempId) return true;

  // 2. If BOTH messages already have distinct server IDs / Twilio SIDs, they are distinct messages
  const hasExistingServerId = !!(existingMessage._id || existingMessage.twilioSid || existingMessage.messageId);
  const hasNewServerId = !!(newMessage._id || newMessage.twilioSid || newMessage.messageId);
  if (hasExistingServerId && hasNewServerId) {
    return false;
  }

  // 3. Reconcile in-flight optimistic OUTBOUND message with incoming server socket message:
  const isExistingInFlight = existingMessage.status === "Sending" || !!existingMessage.tempId || !existingMessage._id;
  const isNewServerOutbound = newMessage.direction === "OUTBOUND" && hasNewServerId;
  const isSameDirection = existingMessage.direction === newMessage.direction;
  const timeDiff = Math.abs(new Date(existingMessage.timestamp || 0).getTime() - new Date(newMessage.timestamp || 0).getTime());

  if (isExistingInFlight && isNewServerOutbound && isSameDirection && timeDiff < 30000) {
    const isSameText = (existingMessage.message || "").trim() === (newMessage.message || "").trim();
    const isSameTemplate = !!(
      (existingMessage.isTemplate && newMessage.isTemplate) ||
      (existingMessage.templateMetadata?.templateId && newMessage.templateMetadata?.templateId &&
       String(existingMessage.templateMetadata.templateId) === String(newMessage.templateMetadata.templateId)) ||
      (existingMessage.templateSid && newMessage.templateSid && existingMessage.templateSid === newMessage.templateSid)
    );
    const isSameMedia = !!(existingMessage.mediaUrl && existingMessage.mediaUrl === newMessage.mediaUrl);

    if (isSameText || isSameTemplate || isSameMedia || timeDiff < 10000) {
      if (newMessage._id) existingMessage._id = newMessage._id;
      if (newMessage.twilioSid) existingMessage.twilioSid = newMessage.twilioSid;
      if (newMessage.message) existingMessage.message = newMessage.message;
      if (newMessage.status && newMessage.status !== "Sending") {
        existingMessage.status = newMessage.status;
        existingMessage.messageStatus = newMessage.status;
      }
      if (newMessage.templateMetadata) existingMessage.templateMetadata = newMessage.templateMetadata;
      return true;
    }
  }

  // 4. Fallback fuzzy match for other cases
  const isSameText = (existingMessage.message || "").trim() === (newMessage.message || "").trim();
  const isSameMedia = existingMessage.mediaUrl === newMessage.mediaUrl;
  
  return (isSameText || (isSameMedia && existingMessage.mediaUrl)) && isSameDirection && (timeDiff < 15000);
};

/**
 * Merges local optimistic history with remote history, discarding duplicates.
 */
const mergeChatHistory = (localHistory, remoteHistory) => {
  if (!localHistory || localHistory.length === 0) return remoteHistory || [];
  if (!remoteHistory || remoteHistory.length === 0) return localHistory || [];

  const mergedHistory = [...remoteHistory];

  localHistory.forEach((localMsg) => {
    const isDuplicate = mergedHistory.some((remoteMsg) => isMessageDuplicate(localMsg, remoteMsg));

    if (!isDuplicate) {
      mergedHistory.push(localMsg);
    }
  });

  return mergedHistory.sort(
    (a, b) => new Date(a.timestamp || a.createdAt || 0).getTime() - new Date(b.timestamp || b.createdAt || 0).getTime()
  );
};

/**
 * Zustand store for managing general chat state (inbox, leads, etc.).
 * Handles conversation upserting, message deduplication, optimistic updates, and real-time state mutations.
 */
export const useChatStore = create((set, get) => ({
  selectedChat: null,
  messages: [],
  notifications: [],
  selectedSender: typeof window !== "undefined" ? localStorage.getItem("selected_whatsapp_sender") || "" : "",
  availableNumbers: [],
  setSelectedSender: (sender) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("selected_whatsapp_sender", sender);
    }
    set({ selectedSender: sender });
  },
  setAvailableNumbers: (numbers) => set({ availableNumbers: numbers }),

  setMessages: (incomingChats) =>
    set((state) => {
      if (!Array.isArray(incomingChats)) return {};

      let updatedSelectedChat = state.selectedChat;

      if (state.selectedChat) {
        const remoteChatVersion = incomingChats.find((c) =>
          isSameConversation(c, state.selectedChat)
        );
        
        if (remoteChatVersion) {
          const localHistory = state.selectedChat.history || [];
          const remoteHistory = remoteChatVersion.history || [];
          const isRecentUpdate = isRecentOptimisticUpdate(state.selectedChat._localUpdatedAt);

          // Preserve customer name if local has a valid name and remote doesn't
          let resolvedName = remoteChatVersion.name;
          if (!isValidDisplayName(resolvedName, remoteChatVersion.phone) && isValidDisplayName(state.selectedChat.name, state.selectedChat.phone)) {
            resolvedName = state.selectedChat.name;
          }

          const mergedHistory = mergeChatHistory(localHistory, remoteHistory);
          const lastMergedMsg = mergedHistory.length > 0 ? mergedHistory[mergedHistory.length - 1] : null;

          const localTimestamp = new Date(state.selectedChat.lastSeenAt || state.selectedChat.timestamp || 0).getTime();
          const remoteTimestamp = new Date(remoteChatVersion.lastSeenAt || remoteChatVersion.timestamp || 0).getTime();
          const isLocalNewer = localTimestamp > remoteTimestamp || isRecentUpdate;

          updatedSelectedChat = {
            ...remoteChatVersion,
            name: resolvedName,
            message: lastMergedMsg?.message || (isLocalNewer ? state.selectedChat.message : remoteChatVersion.message),
            direction: lastMergedMsg?.direction || (isLocalNewer ? state.selectedChat.direction : remoteChatVersion.direction),
            lastSeenAt: isLocalNewer ? state.selectedChat.lastSeenAt : remoteChatVersion.lastSeenAt,
            timestamp: isLocalNewer ? state.selectedChat.timestamp : remoteChatVersion.timestamp,
            status: isRecentUpdate ? state.selectedChat.status : remoteChatVersion.status,
            priority: isRecentUpdate ? state.selectedChat.priority : remoteChatVersion.priority,
            isChatClosed: isRecentUpdate ? state.selectedChat.isChatClosed : remoteChatVersion.isChatClosed,
            isClosed: isRecentUpdate ? state.selectedChat.isClosed : remoteChatVersion.isClosed,
            _localUpdatedAt: isRecentUpdate ? state.selectedChat._localUpdatedAt : null,
            history: mergedHistory,
          };
        }
      }

      // Deduplicate incomingChats itself
      const dedupedIncoming = [];
      incomingChats.forEach((incoming) => {
        const existingIdx = dedupedIncoming.findIndex((c) => isSameConversation(c, incoming));
        if (existingIdx >= 0) {
          dedupedIncoming[existingIdx] = {
            ...dedupedIncoming[existingIdx],
            history: mergeChatHistory(dedupedIncoming[existingIdx].history || [], incoming.history || [])
          };
        } else {
          dedupedIncoming.push(incoming);
        }
      });

      const processedMessages = dedupedIncoming.map((remoteChat) => {
        const localChat = state.messages.find((c) =>
          isSameConversation(c, remoteChat)
        );

        if (localChat) {
          const isRecentUpdate = isRecentOptimisticUpdate(localChat._localUpdatedAt);

          let resolvedName = remoteChat.name;
          if (!isValidDisplayName(resolvedName, remoteChat.phone) && isValidDisplayName(localChat.name, localChat.phone)) {
            resolvedName = localChat.name;
          }

          const mergedHistory = mergeChatHistory(localChat.history || [], remoteChat.history || []);
          const lastMergedMsg = mergedHistory.length > 0 ? mergedHistory[mergedHistory.length - 1] : null;

          const localTimestamp = new Date(localChat.lastSeenAt || localChat.timestamp || 0).getTime();
          const remoteTimestamp = new Date(remoteChat.lastSeenAt || remoteChat.timestamp || 0).getTime();
          const isLocalNewer = localTimestamp > remoteTimestamp || isRecentUpdate;

          return {
            ...remoteChat,
            name: resolvedName,
            message: lastMergedMsg?.message || (isLocalNewer ? localChat.message : remoteChat.message),
            direction: lastMergedMsg?.direction || (isLocalNewer ? localChat.direction : remoteChat.direction),
            lastSeenAt: isLocalNewer ? localChat.lastSeenAt : remoteChat.lastSeenAt,
            timestamp: isLocalNewer ? localChat.timestamp : remoteChat.timestamp,
            unreadCount: isLocalNewer ? Math.max(localChat.unreadCount || 0, remoteChat.unreadCount || 0) : remoteChat.unreadCount,
            status: isRecentUpdate ? localChat.status : remoteChat.status,
            priority: isRecentUpdate ? localChat.priority : remoteChat.priority,
            isChatClosed: isRecentUpdate ? localChat.isChatClosed : remoteChat.isChatClosed,
            isClosed: isRecentUpdate ? localChat.isClosed : remoteChat.isClosed,
            _localUpdatedAt: isRecentUpdate ? localChat._localUpdatedAt : null,
            history: mergedHistory,
          };
        }
        return remoteChat;
      });

      return {
        messages: processedMessages,
        selectedChat: updatedSelectedChat,
      };
    }),

  setSelectedChat: (chat) => set({ selectedChat: chat }),

  addNotification: (note) =>
    set((state) => ({
      notifications: [note, ...state.notifications],
    })),

  clearNotifications: () => set({ notifications: [] }),

  updateChatDetails: (phone, details) => {
    set((state) => {
      const detailsWithMeta = { ...details, _localUpdatedAt: Date.now() };

      const updatedMessages = state.messages.map((chat) =>
        isSamePhone(chat.phone, phone) || (chat.customerId && details.customerId && String(chat.customerId) === String(details.customerId))
          ? { ...chat, ...detailsWithMeta }
          : chat,
      );

      let updatedSelectedChat = state.selectedChat;
      if (state.selectedChat && (isSamePhone(state.selectedChat.phone, phone) || (state.selectedChat.customerId && details.customerId && String(state.selectedChat.customerId) === String(details.customerId)))) {
        updatedSelectedChat = { ...state.selectedChat, ...detailsWithMeta };
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },

  updateMessageStatus: (phone, tempId, newStatus, twilioSid = null) => {
    set((state) => {
      const ALLOWED_TRANSITIONS = {
        QUEUED: new Set(["QUEUED", "SENDING", "SENT", "DELIVERED", "READ", "UNDELIVERED", "FAILED", "CANCELED"]),
        SENDING: new Set(["SENDING", "SENT", "DELIVERED", "READ", "UNDELIVERED", "FAILED", "CANCELED"]),
        SENT: new Set(["SENT", "DELIVERED", "READ", "UNDELIVERED", "FAILED", "CANCELED"]),
        DELIVERED: new Set(["DELIVERED", "READ", "UNDELIVERED", "FAILED"]),
        READ: new Set(["READ"]),
        UNDELIVERED: new Set(["UNDELIVERED", "FAILED"]),
        FAILED: new Set(["FAILED", "UNDELIVERED"]),
        CANCELED: new Set(["CANCELED"]),
      };

      const shouldUpdate = (curr, next) => {
        if (!curr) return true;
        if (!next) return false;
        const c = (curr || "").toUpperCase().trim();
        const n = (next || "").toUpperCase().trim();
        if (c === n) return true;
        const allowed = ALLOWED_TRANSITIONS[c];
        return allowed ? allowed.has(n) : true;
      };

      const updateHistory = (history) => {
        if (!history || !Array.isArray(history)) return [];
        return history.map((msg) => {
          const isMatch =
            (twilioSid && (msg.twilioSid === twilioSid || msg.sid === twilioSid)) ||
            (tempId && (
              msg.tempId === tempId ||
              msg.id === tempId ||
              msg._id === tempId ||
              msg.messageId === tempId ||
              msg.twilioSid === tempId
            ));

          if (isMatch) {
            const currentStat = msg.messageStatus || msg.status || "SENT";
            const targetStat = shouldUpdate(currentStat, newStatus) ? newStatus : currentStat;
            return {
              ...msg,
              status: targetStat,
              messageStatus: targetStat,
              ...(twilioSid && { twilioSid }),
            };
          }
          return msg;
        });
      };

      // Search across messages: check phone match OR if twilioSid/tempId exists in chat history
      const updatedMessages = state.messages.map((chat) => {
        const isPhoneMatch = phone && isSamePhone(chat.phone, phone);
        const hasSidInHistory = (twilioSid || tempId) && chat.history?.some((m) =>
          (twilioSid && (m.twilioSid === twilioSid || m.sid === twilioSid)) ||
          (tempId && (m.tempId === tempId || m.id === tempId || m._id === tempId || m.messageId === tempId || m.twilioSid === tempId))
        );

        if (isPhoneMatch || hasSidInHistory) {
          const updatedHistory = updateHistory(chat.history);
          const lastMsg = updatedHistory.length > 0 ? updatedHistory[updatedHistory.length - 1] : null;
          return {
            ...chat,
            messageStatus: lastMsg?.messageStatus || lastMsg?.status || chat.messageStatus,
            history: updatedHistory,
          };
        }
        return chat;
      });

      let updatedSelectedChat = state.selectedChat;
      if (state.selectedChat) {
        const isSelectedPhoneMatch = phone && isSamePhone(state.selectedChat.phone, phone);
        const isSelectedSidMatch = (twilioSid || tempId) && state.selectedChat.history?.some((m) =>
          (twilioSid && (m.twilioSid === twilioSid || m.sid === twilioSid)) ||
          (tempId && (m.tempId === tempId || m.id === tempId || m._id === tempId || m.messageId === tempId || m.twilioSid === tempId))
        );

        if (isSelectedPhoneMatch || isSelectedSidMatch) {
          const updatedHistory = updateHistory(state.selectedChat.history);
          const lastMsg = updatedHistory.length > 0 ? updatedHistory[updatedHistory.length - 1] : null;
          updatedSelectedChat = {
            ...state.selectedChat,
            messageStatus: lastMsg?.messageStatus || lastMsg?.status || state.selectedChat.messageStatus,
            history: updatedHistory,
          };
        }
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },

  /**
   * Authoritative UPSERT helper: merges inbound or outbound message into existing conversation
   * or creates a single new conversation row for genuinely new customers.
   */
  addMessage: (newMessage) => {
    set((state) => {
      const hasDuplicateInHistory = (history) => {
        if (!history || !Array.isArray(history)) return false;
        return history.some((existingMsg) => isMessageDuplicate(existingMsg, newMessage));
      };

      let displayText = newMessage.message || "";
      if (!displayText && newMessage.mediaUrl) {
        if (newMessage.mediaType?.includes("video")) displayText = "🎥 Video";
        else if (newMessage.mediaType?.includes("audio")) displayText = "🎵 Audio";
        else if (newMessage.mediaType?.includes("pdf") || newMessage.mediaType?.includes("document")) displayText = "📄 Document";
        else displayText = "📷 Photo";
      }

      const existingChat = state.messages.find((chat) => isSameConversation(chat, newMessage));
      const isCurrentActive = isSameConversation(state.selectedChat, newMessage);
      const shouldIncrementUnread = newMessage.direction === "INBOUND" && !isCurrentActive;

      let updatedChat = null;

      if (existingChat) {
        if (hasDuplicateInHistory(existingChat.history)) {
          const newUnreadCount = shouldIncrementUnread 
            ? (existingChat.unreadCount || 0) + 1 
            : (isCurrentActive ? 0 : (existingChat.unreadCount || 0));

          const updatedChat = {
            ...existingChat,
            history: [...existingChat.history],
            unreadCount: newUnreadCount,
            _localUpdatedAt: Date.now(),
          };

          const otherMessages = state.messages.filter((chat) => !isSameConversation(chat, newMessage));
          const updatedMessages = [updatedChat, ...otherMessages];

          let updatedSelectedChat = state.selectedChat;
          if (isCurrentActive) {
            updatedSelectedChat = {
              ...state.selectedChat,
              ...updatedChat,
              history: [...(existingChat.history || [])],
            };
          }

          return { messages: updatedMessages, selectedChat: updatedSelectedChat };
        }

        const newUnreadCount = shouldIncrementUnread 
          ? (existingChat.unreadCount || 0) + 1 
          : (isCurrentActive ? 0 : (existingChat.unreadCount || 0));

        const updatedHistory = existingChat.history ? [...existingChat.history, newMessage] : [newMessage];
        
        // Preserve customer name: never overwrite a valid existing name with "Unknown" or phone
        let resolvedName = existingChat.name;
        if (!isValidDisplayName(resolvedName, existingChat.phone)) {
          resolvedName = newMessage.customerName || newMessage.name || existingChat.name;
        }
        resolvedName = resolveCustomerDisplayName({
          customerName: resolvedName,
          name: resolvedName,
          senderName: newMessage.senderName,
          phone: existingChat.phone || newMessage.phone
        });

        updatedChat = {
          ...existingChat,
          customerId: existingChat.customerId || newMessage.customerId,
          phone: existingChat.phone || newMessage.phone,
          canonicalPhone: existingChat.canonicalPhone || newMessage.canonicalPhone || normalizePhone(newMessage.phone),
          name: resolvedName,
          message: displayText,
          direction: newMessage.direction,
          read: isCurrentActive ? "TRUE" : (newMessage.direction === "INBOUND" ? "FALSE" : existingChat.read),
          messageStatus: newMessage.status || "RECEIVED",
          lastSeenAt: newMessage.timestamp || new Date().toISOString(),
          timestamp: newMessage.timestamp || new Date().toISOString(),
          history: updatedHistory,
          sendBy: newMessage.sendBy || existingChat.sendBy || null,
          unreadCount: newUnreadCount,
          isClosed: newMessage.isClosed !== undefined ? newMessage.isClosed : (newMessage.isChatClosed !== undefined ? newMessage.isChatClosed : existingChat.isClosed),
          isChatClosed: newMessage.isChatClosed !== undefined ? newMessage.isChatClosed : (newMessage.isClosed !== undefined ? newMessage.isClosed : existingChat.isChatClosed),
          _localUpdatedAt: Date.now(),
        };
      } else {
        // Genuinely NEW customer/thread
        let resolvedName = resolveCustomerDisplayName({
          customerName: newMessage.customerName || newMessage.name,
          name: newMessage.customerName || newMessage.name,
          senderName: newMessage.senderName,
          phone: newMessage.phone
        });

        updatedChat = {
          customerId: newMessage.customerId || null,
          phone: newMessage.phone,
          canonicalPhone: newMessage.canonicalPhone || normalizePhone(newMessage.phone),
          name: resolvedName,
          message: displayText,
          direction: newMessage.direction,
          city: newMessage.city || "",
          read: isCurrentActive ? "TRUE" : (newMessage.direction === "INBOUND" ? "FALSE" : "TRUE"),
          messageStatus: newMessage.status || "RECEIVED",
          lastSeenAt: newMessage.timestamp || new Date().toISOString(),
          timestamp: newMessage.timestamp || new Date().toISOString(),
          status: newMessage.status || "New",
          priority: newMessage.priority || "Medium",
          role: newMessage.role || "sales",
          history: [newMessage],
          sendBy: newMessage.sendBy || null,
          unreadCount: shouldIncrementUnread ? 1 : 0,
          isClosed: newMessage.isClosed || false,
          isChatClosed: newMessage.isChatClosed || false,
          branchId: newMessage.branchId || null,
          _localUpdatedAt: Date.now(),
        };
      }

      // Upsert into state.messages: remove older instance of this conversation and prepend updatedChat
      const otherMessages = state.messages.filter((chat) => !isSameConversation(chat, newMessage));
      const updatedMessages = [updatedChat, ...otherMessages];

      let updatedSelectedChat = state.selectedChat;
      if (isCurrentActive) {
        if (!hasDuplicateInHistory(state.selectedChat?.history)) {
          const selectedHistory = state.selectedChat?.history ? [...state.selectedChat.history, newMessage] : [newMessage];
          updatedSelectedChat = {
            ...state.selectedChat,
            ...updatedChat,
            history: selectedHistory,
            unreadCount: 0,
            read: "TRUE",
            _localUpdatedAt: Date.now(),
          };
        }
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },

  upsertChatConversation: (conversation) => {
    set((state) => {
      const existingIdx = state.messages.findIndex((c) => isSameConversation(c, conversation));
      let updatedMessages = [...state.messages];

      if (existingIdx >= 0) {
        const existing = updatedMessages[existingIdx];
        updatedMessages[existingIdx] = {
          ...existing,
          ...conversation,
          name: isValidDisplayName(existing.name, existing.phone) ? existing.name : (conversation.name || existing.name),
          history: mergeChatHistory(existing.history || [], conversation.history || [])
        };
      } else {
        updatedMessages = [conversation, ...updatedMessages];
      }

      let updatedSelectedChat = state.selectedChat;
      if (isSameConversation(state.selectedChat, conversation)) {
        updatedSelectedChat = {
          ...state.selectedChat,
          ...conversation,
          history: mergeChatHistory(state.selectedChat.history || [], conversation.history || [])
        };
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },

  removeConversations: ({ customerIds = [], phones = [] } = {}) => {
    set((state) => {
      const custIdSet = new Set((Array.isArray(customerIds) ? customerIds : [customerIds]).filter(Boolean).map(id => String(id)));
      const phoneList = (Array.isArray(phones) ? phones : [phones]).filter(Boolean);

      const shouldRemove = (chat) => {
        if (!chat) return false;
        const cId = chat.customerId || (chat._id && !chat.message && chat.phone ? chat._id : null);
        if (cId && custIdSet.has(String(cId))) return true;
        if (phoneList.some(p => isSamePhone(chat.phone, p) || (chat.canonicalPhone && isSamePhone(chat.canonicalPhone, p)))) return true;
        return false;
      };

      const remainingMessages = state.messages.filter((chat) => !shouldRemove(chat));
      let updatedSelectedChat = state.selectedChat;
      if (shouldRemove(state.selectedChat)) {
        updatedSelectedChat = null;
      }

      return {
        messages: remainingMessages,
        selectedChat: updatedSelectedChat,
      };
    });
  }
}));


