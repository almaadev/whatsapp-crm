import { create } from "zustand";

export const useChatStore = create((set, get) => ({
  selectedChat: null,
  messages: [],
  notifications: [],

  setMessages: (newMessagesFromServer) => set((state) => {
    let updatedSelectedChat = state.selectedChat;

    if (state.selectedChat) {
      const serverVersion = newMessagesFromServer.find(c => c.phone === state.selectedChat.phone);
      if (serverVersion) {
        const localHist = state.selectedChat.history || [];
        const serverHist = serverVersion.history || [];
        
        // Keep local history if it has more messages (optimistic updates)
        updatedSelectedChat = {
          ...serverVersion,
          history: localHist.length > serverHist.length ? localHist : serverHist
        };
      }
    }

    return { 
      messages: newMessagesFromServer, 
      selectedChat: updatedSelectedChat 
    };
  }),

  setSelectedChat: (chat) => set({ selectedChat: chat }),

  addNotification: (note) => set((state) => ({
    notifications: [note, ...state.notifications]
  })),

  clearNotifications: () => set({ notifications: [] }),

  updateChatDetails: (phone, details) => {
    set((state) => {
      const updatedMessages = state.messages.map((chat) =>
        chat.phone === phone ? { ...chat, ...details } : chat
      );

      let updatedSelectedChat = state.selectedChat;
      if (state.selectedChat?.phone === phone) {
        updatedSelectedChat = { ...state.selectedChat, ...details };
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },

  updateMessageStatus: (phone, tempId, newStatus) => {
    set((state) => {
      const updateHistory = (history) => {
        if (!history) return [];
        return history.map(msg => 
          msg.tempId === tempId ? { ...msg, status: newStatus } : msg
        );
      };

      const updatedMessages = state.messages.map((chat) => {
        if (chat.phone === phone) {
           return { ...chat, history: updateHistory(chat.history) };
        }
        return chat;
      });

      let updatedSelectedChat = state.selectedChat;
      if (state.selectedChat?.phone === phone) {
          updatedSelectedChat = { 
            ...state.selectedChat, 
            history: updateHistory(state.selectedChat.history) 
          };
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },

  addMessage: (newMessage) => {
    set((state) => {
      let chatExists = false;
      const updatedMessages = state.messages.map((chat) => {
        if (chat.phone === newMessage.phone) {
          chatExists = true;
          const updatedHistory = chat.history ? [...chat.history, newMessage] : [newMessage];
          return { 
            ...chat, 
            message: newMessage.message, 
            lastSeenAt: newMessage.timestamp || new Date().toISOString(), 
            history: updatedHistory 
          };
        }
        return chat;
      });

      if (!chatExists) {
        const newChat = {
          phone: newMessage.phone,
          name: newMessage.name || newMessage.phone,
          message: newMessage.message,
          lastSeenAt: newMessage.timestamp || new Date().toISOString(),
          status: newMessage.status || "New",
          role: newMessage.role || "sales",
          history: [newMessage] 
        };
        updatedMessages.unshift(newChat);
      }

      let updatedSelectedChat = state.selectedChat;
      if (state.selectedChat?.phone === newMessage.phone) {
        updatedSelectedChat = {
          ...state.selectedChat,
          message: newMessage.message,
          lastSeenAt: newMessage.timestamp || new Date().toISOString(),
          history: state.selectedChat.history ? [...state.selectedChat.history, newMessage] : [newMessage]
        };
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },
}));