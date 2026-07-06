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
        const displayText = newMessage.message || "📷 Media";
        let chatExists = false;
        const updatedMessages = state.messages.map((chat) => {
          if (chat.phone === newMessage.phone) {
            chatExists = true;
            const updatedHistory = chat.history
              ? [...chat.history, newMessage]
              : [newMessage];
            return {
              ...chat,
              message: displayText,
              direction: newMessage.direction,
              read: newMessage.direction === "INBOUND" ? "FALSE" : chat.read,
              messageStatus: newMessage.status,
              lastSeenAt: new Date().toISOString(),
              history: updatedHistory,
            };
          }
          return chat;
        });

        if (!chatExists) {
          updatedMessages.unshift({
            phone: newMessage.phone,
            name: newMessage.name || newMessage.phone,
            message: displayText,
            direction: newMessage.direction,
            read: newMessage.direction === "INBOUND" ? "FALSE" : "TRUE",
            messageStatus: newMessage.status,
            lastSeenAt: new Date().toISOString(),
            status: "New",
            role: newMessage.role || "sales",
            history: [newMessage],
          });
        }

        let updatedSelectedChat = state.selectedChat;
        if (state.selectedChat?.phone === newMessage.phone) {
          updatedSelectedChat = {
            ...state.selectedChat,
            message: displayText,
            direction: newMessage.direction,
            read:
              newMessage.direction === "INBOUND"
                ? "FALSE"
                : state.selectedChat.read,
            messageStatus: newMessage.status,
            lastSeenAt: new Date().toISOString(),
            history: state.selectedChat.history
              ? [...state.selectedChat.history, newMessage]
              : [newMessage],
          };
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
