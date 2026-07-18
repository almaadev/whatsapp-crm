import { create } from "zustand";

/**
 * Shared helper to check if a local optimistic update is recent (under 15s).
 * Prevents stale remote data from immediately overwriting optimistic UI states.
 */
const isRecentOptimisticUpdate = (localUpdatedAt) => {
  return localUpdatedAt && Date.now() - localUpdatedAt < 15000;
};

/**
 * Shared helper to check if two messages are duplicates based on content, direction, and timestamp proximity.
 */
const isMessageDuplicate = (existingMessage, newMessage) => {
  const isSameText = existingMessage.message === newMessage.message;
  const isSameMedia = existingMessage.mediaUrl === newMessage.mediaUrl;
  const isSameDirection = existingMessage.direction === newMessage.direction;
  const timeDiff = Math.abs(new Date(existingMessage.timestamp).getTime() - new Date(newMessage.timestamp).getTime());
  
  return (isSameText || (isSameMedia && existingMessage.mediaUrl)) && isSameDirection && (timeDiff < 15000);
};

/**
 * Merges local optimistic history with remote history, discarding duplicates.
 */
const mergeChatHistory = (localHistory, remoteHistory) => {
  if (!localHistory || localHistory.length === 0) return remoteHistory;
  if (!remoteHistory || remoteHistory.length === 0) return localHistory;

  const mergedHistory = [...remoteHistory];

  localHistory.forEach((localMsg) => {
    if (!localMsg.tempId) return;

    const isDuplicate = mergedHistory.some((remoteMsg) => isMessageDuplicate(localMsg, remoteMsg));

    if (!isDuplicate) {
      mergedHistory.push(localMsg);
    }
  });

  return mergedHistory.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
};

/**
 * Zustand store for managing general chat state (inbox, leads, etc.).
 * Handles message deduplication, optimistic updates, and real-time state mutations.
 */
export const useChatStore = create((set, get) => ({
  selectedChat: null,
  messages: [],
  notifications: [],

  setMessages: (incomingChats) =>
    set((state) => {
      let updatedSelectedChat = state.selectedChat;

      if (state.selectedChat) {
        const remoteChatVersion = incomingChats.find(
          (c) => c.phone === state.selectedChat.phone,
        );
        
        if (remoteChatVersion) {
          const localHistory = state.selectedChat.history || [];
          const remoteHistory = remoteChatVersion.history || [];
          const isRecentUpdate = isRecentOptimisticUpdate(state.selectedChat._localUpdatedAt);

          updatedSelectedChat = {
            ...remoteChatVersion,
            status: isRecentUpdate ? state.selectedChat.status : remoteChatVersion.status,
            priority: isRecentUpdate ? state.selectedChat.priority : remoteChatVersion.priority,
            isChatClosed: isRecentUpdate ? state.selectedChat.isChatClosed : remoteChatVersion.isChatClosed,
            _localUpdatedAt: isRecentUpdate ? state.selectedChat._localUpdatedAt : null,
            history: mergeChatHistory(localHistory, remoteHistory),
          };
        }
      }

      const processedMessages = incomingChats.map((remoteChat) => {
        const localChat = state.messages.find(
          (c) => c.phone === remoteChat.phone,
        );

        if (localChat) {
          const isRecentUpdate = isRecentOptimisticUpdate(localChat._localUpdatedAt);

          return {
            ...remoteChat,
            status: isRecentUpdate ? localChat.status : remoteChat.status,
            priority: isRecentUpdate ? localChat.priority : remoteChat.priority,
            isChatClosed: isRecentUpdate ? localChat.isChatClosed : remoteChat.isChatClosed,
            _localUpdatedAt: isRecentUpdate ? localChat._localUpdatedAt : null,
            history: mergeChatHistory(localChat.history || [], remoteChat.history || []),
            
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
        chat.phone === phone ? { ...chat, ...detailsWithMeta } : chat,
      );

      let updatedSelectedChat = state.selectedChat;
      if (state.selectedChat?.phone === phone) {
        updatedSelectedChat = { ...state.selectedChat, ...detailsWithMeta };
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },

  updateMessageStatus: (phone, tempId, newStatus, twilioSid = null) => {
    set((state) => {
      const updateHistory = (history) => {
        if (!history) return [];
        return history.map((msg) => {
          const isMatch =
            (tempId && (msg.tempId === tempId || msg.id === tempId || msg._id === tempId)) ||
            (twilioSid && (msg.twilioSid === twilioSid || msg.sid === twilioSid));

          if (isMatch) {
            return {
              ...msg,
              status: newStatus,
              messageStatus: newStatus,
              ...(twilioSid && { twilioSid }),
            };
          }
          return msg;
        });
      };

      const updatedMessages = state.messages.map((chat) => {
        if (chat.phone === phone) {
          return {
            ...chat,
            messageStatus: newStatus,
            history: updateHistory(chat.history),
          };
        }
        return chat;
      });

      let updatedSelectedChat = state.selectedChat;
      if (state.selectedChat?.phone === phone) {
        updatedSelectedChat = {
          ...state.selectedChat,
          messageStatus: newStatus,
          history: updateHistory(state.selectedChat.history),
        };
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },

  addMessage: (newMessage) => {
    set((state) => {
      const hasDuplicateInHistory = (history) => {
        if (!history) return false;
        return history.some((existingMsg) => isMessageDuplicate(existingMsg, newMessage));
      };

      let displayText = newMessage.message;
      if (!displayText && newMessage.mediaUrl) {
        if (newMessage.mediaType?.includes("video")) displayText = "🎥 Video";
        else if (newMessage.mediaType?.includes("audio")) displayText = "🎵 Audio";
        else if (newMessage.mediaType?.includes("pdf") || newMessage.mediaType?.includes("document")) displayText = "📄 Document";
        else displayText = "📷 Photo";
      }

      const existingChat = state.messages.find((chat) => chat.phone === newMessage.phone);
      let updatedChat = null;

      if (existingChat) {
        if (hasDuplicateInHistory(existingChat.history)) {
          return {};
        }

        const isCurrentActive = state.selectedChat?.phone === newMessage.phone;
        const shouldIncrementUnread = newMessage.direction === "INBOUND" && !isCurrentActive;
        const newUnreadCount = shouldIncrementUnread 
          ? (existingChat.unreadCount || 0) + 1 
          : (isCurrentActive ? 0 : (existingChat.unreadCount || 0));

        const updatedHistory = existingChat.history ? [...existingChat.history, newMessage] : [newMessage];
        
        updatedChat = {
          ...existingChat,
          message: displayText,
          direction: newMessage.direction,
          read: newMessage.direction === "INBOUND" ? "FALSE" : existingChat.read,
          messageStatus: newMessage.status,
          lastSeenAt: newMessage.timestamp || new Date().toISOString(),
          timestamp: newMessage.timestamp || new Date().toISOString(),
          history: updatedHistory,
          sendBy: newMessage.sendBy || null,
          unreadCount: newUnreadCount,
        };
      } else {
        const isCurrentActive = state.selectedChat?.phone === newMessage.phone;
        const shouldIncrementUnread = newMessage.direction === "INBOUND" && !isCurrentActive;
        
        updatedChat = {
          phone: newMessage.phone,
          name: newMessage.name || newMessage.phone,
          message: displayText,
          direction: newMessage.direction,
          city: newMessage.city,
          read: newMessage.direction === "INBOUND" ? "FALSE" : "TRUE",
          messageStatus: newMessage.status,
          lastSeenAt: newMessage.timestamp || new Date().toISOString(),
          timestamp: newMessage.timestamp || new Date().toISOString(),
          status: "New",
          role: newMessage.role || "sales",
          history: [newMessage],
          sendBy: newMessage.sendBy || null,
          unreadCount: shouldIncrementUnread ? 1 : 0,
        };
      }

      const otherMessages = state.messages.filter((chat) => chat.phone !== newMessage.phone);
      const updatedMessages = [updatedChat, ...otherMessages];

      let updatedSelectedChat = state.selectedChat;
      if (state.selectedChat?.phone === newMessage.phone) {
        if (!hasDuplicateInHistory(state.selectedChat.history)) {
          updatedSelectedChat = {
            ...state.selectedChat,
            message: displayText,
            direction: newMessage.direction,
            read: newMessage.direction === "INBOUND" ? "FALSE" : state.selectedChat.read,
            messageStatus: newMessage.status,
            lastSeenAt: newMessage.timestamp || new Date().toISOString(),
            timestamp: newMessage.timestamp || new Date().toISOString(),
            history: state.selectedChat.history ? [...state.selectedChat.history, newMessage] : [newMessage],
            sendBy: newMessage.sendBy || null,
            unreadCount: 0,
          };
        }
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },
}));
