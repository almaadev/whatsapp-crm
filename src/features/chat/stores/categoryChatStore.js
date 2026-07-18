import { create } from "zustand";

function buildCategoryStore() {
  return create((set) => ({
    selectedChat: null,
    messages: [],
    notifications: [],

    setMessages: (newMessagesFromServer) =>
      set((state) => {
        let updatedSelectedChat = state.selectedChat;

        const deduplicateHistory = (localHist, serverHist) => {
          if (!localHist?.length) return serverHist;
          if (!serverHist?.length) return localHist;
          const merged = [...serverHist];
          localHist.forEach((localMsg) => {
            if (!localMsg.tempId) return;
            const isDuplicate = merged.some(
              (serverMsg) =>
                serverMsg.message === localMsg.message &&
                serverMsg.direction === localMsg.direction &&
                Math.abs(
                  new Date(
                    serverMsg.timestamp || serverMsg.createdAt || 0,
                  ).getTime() -
                    new Date(
                      localMsg.timestamp || localMsg.createdAt || 0,
                    ).getTime(),
                ) < 15000,
            );
            if (!isDuplicate) merged.push(localMsg);
          });
          return merged.sort(
            (a, b) =>
              new Date(a.timestamp || a.createdAt || 0) -
              new Date(b.timestamp || b.createdAt || 0),
          );
        };

        if (state.selectedChat) {
          const serverVersion = newMessagesFromServer.find(
            (c) => c.phone === state.selectedChat.phone,
          );
          if (serverVersion) {
            updatedSelectedChat = {
              ...serverVersion,
              history: deduplicateHistory(
                state.selectedChat.history || [],
                serverVersion.history || [],
              ),
            };
          }
        }

        const processedMessages = newMessagesFromServer.map((serverChat) => {
          const localChat = state.messages.find(
            (c) => c.phone === serverChat.phone,
          );
          if (localChat) {
            return {
              ...serverChat,
              history: deduplicateHistory(
                localChat.history || [],
                serverChat.history || [],
              ),
            };
          }
          return serverChat;
        });

        const uniqueChatsMap = new Map();
        processedMessages.forEach((chat) => {
          if (!uniqueChatsMap.has(chat.phone))
            uniqueChatsMap.set(chat.phone, chat);
        });

        return {
          messages: Array.from(uniqueChatsMap.values()),
          selectedChat: updatedSelectedChat,
        };
      }),

    setSelectedChat: (chat) => set({ selectedChat: chat }),
    addNotification: (note) =>
      set((state) => ({ notifications: [note, ...state.notifications] })),
    clearNotifications: () => set({ notifications: [] }),

    updateChatDetails: (phone, details) => {
      set((state) => {
        const updatedMessages = state.messages.map((chat) =>
          chat.phone === phone ? { ...chat, ...details } : chat,
        );
        let updatedSelectedChat = state.selectedChat;
        if (state.selectedChat?.phone === phone) {
          updatedSelectedChat = { ...state.selectedChat, ...details };
        }
        return { messages: updatedMessages, selectedChat: updatedSelectedChat };
      });
    },

    updateMessageStatus: (phone, tempId, newStatus, twilioSid = null) => {
      set((state) => {
        const updateHistory = (history) => {
          if (!history) return [];
          return history.map((msg) =>
            msg.tempId === tempId ||
            msg.id === tempId ||
            (twilioSid && msg.twilioSid === twilioSid)
              ? {
                  ...msg,
                  status: newStatus,
                  messageStatus: newStatus,
                  ...(twilioSid && { twilioSid }),
                }
              : msg,
          );
        };
        const updatedMessages = state.messages.map((chat) =>
          chat.phone === phone
            ? {
                ...chat,
                messageStatus: newStatus,
                history: updateHistory(chat.history),
              }
            : chat,
        );
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
          return history.some((existingItem) => {
            // History entries may be wrapped { type, data } or flat raw objects
            const existingMsg = existingItem?.data ?? existingItem;
            return (
              existingMsg.message === newMessage.message &&
              existingMsg.direction === newMessage.direction &&
              Math.abs(
                new Date(existingMsg.timestamp || existingMsg.createdAt || 0).getTime() -
                  new Date(newMessage.timestamp || newMessage.createdAt || 0).getTime()
              ) < 15000
            );
          });
        };

        const displayText = newMessage.message || "📷 Media";
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

          // Wrap in { type, data, timestamp } shape so MessageList can render it
          // consistently alongside audit entries from chronologicalTimeline.
          const wrappedNewMessage = {
            type: "message",
            data: newMessage,
            timestamp: newMessage.timestamp || newMessage.createdAt || new Date().toISOString(),
          };
          const updatedHistory = existingChat.history
            ? [...existingChat.history, wrappedNewMessage]
            : [wrappedNewMessage];

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
              history: state.selectedChat.history
                ? [...state.selectedChat.history, newMessage]
                : [newMessage],
              sendBy: newMessage.sendBy || null,
              unreadCount: 0,
            };
          }
        }

        return { messages: updatedMessages, selectedChat: updatedSelectedChat };
      });
    },
  }));
}

const storeCache = new Map();

/**
 * Gets or creates a Zustand store for a specific category (slug).
 * Ensures that each category (e.g., product-lead, md-camp) has its own independent state.
 *
 * @param {string} slug - The category slug.
 * @returns {import("zustand").UseBoundStore} The Zustand store for the category.
 */
export function getCategoryChatStore(slug) {
  if (!storeCache.has(slug)) {
    storeCache.set(slug, buildCategoryStore());
  }
  return storeCache.get(slug);
}

export const useProductChatStore = getCategoryChatStore("product");
export const useMDCampChatStore = getCategoryChatStore("mdcamp");
export const useTherapyChatStore = getCategoryChatStore("therapy");
