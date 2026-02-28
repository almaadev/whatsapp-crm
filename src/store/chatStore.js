import { create } from "zustand";

export const useChatStore = create((set, get) => ({
  selectedChat: null,
  messages: [],
  notifications: [],

  setMessages: (newMessagesFromServer) => set((state) => {
    let updatedSelectedChat = state.selectedChat;

    const deduplicateHistory = (localHist, serverHist) => {
      if (!localHist || localHist.length === 0) return serverHist;
      if (!serverHist || serverHist.length === 0) return localHist;

      const merged = [...serverHist];
      
      localHist.forEach(localMsg => {
        if (!localMsg.tempId) return;

        const isDuplicate = merged.some(serverMsg => {
          const isSameText = serverMsg.message === localMsg.message;
          const isSameDirection = serverMsg.direction === localMsg.direction;
          const localTime = new Date(localMsg.timestamp).getTime();
          const serverTime = new Date(serverMsg.timestamp).getTime();
          const isCloseInTime = Math.abs(serverTime - localTime) < 15000; 

          return isSameText && isSameDirection && isCloseInTime;
        });

        if (!isDuplicate) {
          merged.push(localMsg);
        }
      });

      return merged.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    };

    if (state.selectedChat) {
      const serverVersion = newMessagesFromServer.find(c => c.phone === state.selectedChat.phone);
      if (serverVersion) {
        const localHist = state.selectedChat.history || [];
        const serverHist = serverVersion.history || [];
        
        updatedSelectedChat = {
          ...serverVersion,
          history: deduplicateHistory(localHist, serverHist)
        };
      }
    }

    const processedMessages = newMessagesFromServer.map(serverChat => {
      const localChat = state.messages.find(c => c.phone === serverChat.phone);
      if (localChat) {
        return {
          ...serverChat,
          history: deduplicateHistory(localChat.history || [], serverChat.history || [])
        };
      }
      return serverChat;
    });

    return { 
      messages: processedMessages, 
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

  // FIXED: Deduplication logic directly inside addMessage
  addMessage: (newMessage) => {
    set((state) => {
      
      // Smart checker to block duplicate socket messages
      const isDuplicateMessage = (history) => {
        if (!history) return false;
        return history.some(existing => {
          const sameText = existing.message === newMessage.message;
          const sameMedia = existing.mediaUrl === newMessage.mediaUrl;
          const sameDirection = existing.direction === newMessage.direction;
          const timeDiff = Math.abs(new Date(existing.timestamp) - new Date(newMessage.timestamp));
          
          return (sameText || sameMedia) && sameDirection && (timeDiff < 15000); // 15 seconds window
        });
      };

      let chatExists = false;
      const updatedMessages = state.messages.map((chat) => {
        if (chat.phone === newMessage.phone) {
          chatExists = true;

          // BLOCK DUPLICATE
          if (isDuplicateMessage(chat.history)) {
             return chat; 
          }

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
        // BLOCK DUPLICATE FOR OPEN CHAT WINDOW
        if (!isDuplicateMessage(state.selectedChat.history)) {
          updatedSelectedChat = {
            ...state.selectedChat,
            message: newMessage.message,
            lastSeenAt: newMessage.timestamp || new Date().toISOString(),
            history: state.selectedChat.history ? [...state.selectedChat.history, newMessage] : [newMessage]
          };
        }
      }

      return { messages: updatedMessages, selectedChat: updatedSelectedChat };
    });
  },
}));