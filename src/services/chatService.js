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
          let displayText = msg.message;
          if (!displayText && msg.mediaUrl) {
              if (msg.mediaType?.includes("video")) displayText = "🎥 Video";
              else if (msg.mediaType?.includes("audio")) displayText = "🎵 Audio";
              else if (msg.mediaType?.includes("pdf") || msg.mediaType?.includes("document")) displayText = "📄 Document";
              else displayText = "📷 Photo";
          }

          uniqueConversations[msg.phone].message = displayText;
          uniqueConversations[msg.phone].lastSeenAt = msg.timestamp;
          
          // FIX: Message Delivery Status-ஐயும் லேட்டஸ்ட்டாக அப்டேட் செய்கிறோம் (Chat List-ல் டிக் தெரிய)
          uniqueConversations[msg.phone].status = msg.status; 
          uniqueConversations[msg.phone].messageStatus = msg.messageStatus; 
          
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
     const response = await axios.post("/api/chats", payload);
     return response.data; 
  }
};