import axios from "axios";

export const chatService = {
  getMessages: async (role) => {
    try {
      const { data } = await axios.get(`/api/chats`); 
      
      if (!Array.isArray(data)) return [];

      const uniqueConversations = {};
      
      data.forEach((msg) => {
        // Skip if phone number is missing
        if (!msg.phone) return;

        // Grouping Logic
        if (!uniqueConversations[msg.phone]) {
          uniqueConversations[msg.phone] = { ...msg, history: [msg] };
        } else {
          uniqueConversations[msg.phone].history.push(msg);
          
          // ALWAYS UPDATE THESE TO REFLECT THE LATEST MESSAGE
          // FIX: If message is empty but media exists, show a placeholder
          let displayText = msg.message;
          if (!displayText && msg.mediaUrl) {
              if (msg.mediaType?.includes("video")) displayText = "🎥 Video";
              else if (msg.mediaType?.includes("audio")) displayText = "🎵 Audio";
              else if (msg.mediaType?.includes("pdf") || msg.mediaType?.includes("document")) displayText = "📄 Document";
              else displayText = "📷 Photo";
          }

          uniqueConversations[msg.phone].message = displayText;
          uniqueConversations[msg.phone].lastSeenAt = msg.timestamp;
          uniqueConversations[msg.phone].status = msg.status;
          
          // FIX: Update direction and READ STATUS so UI knows the latest state
          uniqueConversations[msg.phone].direction = msg.direction; 
          uniqueConversations[msg.phone].read = msg.read;
          
          if (msg.name && msg.name !== msg.phone) {
             uniqueConversations[msg.phone].name = msg.name;
          }
        }
      });
      
      return Object.values(uniqueConversations);

    } catch (error) {
      console.error("Chat Service Error:", error);
      return [];
    }
  },

  sendMessage: async (payload) => {
     await axios.post("/api/chats", payload);
     return { success: true };
  }
};