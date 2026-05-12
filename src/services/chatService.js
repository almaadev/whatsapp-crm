import axios from "axios";

export const chatService = {
  getMessages: async (role) => {
    try {
      const { data } = await axios.get(`/api/chats`); 
      
      if (!Array.isArray(data)) return [];

      const uniqueConversations = {};
      
      data.forEach((msg) => {
<<<<<<< HEAD
        // Skip if phone number is missing
=======
>>>>>>> c1be5bc (Initial commit from new system)
        if (!msg.phone) return;

        // Grouping Logic
        if (!uniqueConversations[msg.phone]) {
          uniqueConversations[msg.phone] = { ...msg, history: [msg] };
        } else {
          uniqueConversations[msg.phone].history.push(msg);
<<<<<<< HEAD
          
          // ALWAYS UPDATE THESE TO REFLECT THE LATEST MESSAGE
=======

>>>>>>> c1be5bc (Initial commit from new system)
          let displayText = msg.message;
          if (!displayText && msg.mediaUrl) {
              if (msg.mediaType?.includes("video")) displayText = "🎥 Video";
              else if (msg.mediaType?.includes("audio")) displayText = "🎵 Audio";
              else if (msg.mediaType?.includes("pdf") || msg.mediaType?.includes("document")) displayText = "📄 Document";
              else displayText = "📷 Photo";
          }

          uniqueConversations[msg.phone].message = displayText;
          uniqueConversations[msg.phone].lastSeenAt = msg.timestamp;
          
<<<<<<< HEAD
          // FIX: Message Delivery Status-ஐயும் லேட்டஸ்ட்டாக அப்டேட் செய்கிறோம் (Chat List-ல் டிக் தெரிய)
=======
>>>>>>> c1be5bc (Initial commit from new system)
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
<<<<<<< HEAD
=======
  ,
 updateChatControlStatus: async(phone, isChatClosed, chatType) => {
    const res = await fetch("/api/chats/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, isChatClosed, chatType })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to sync toggle");
    }
    return res.json();
  },

  updateLeadLifecycle: async(payload) => {
    const res = await fetch("/api/lead-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update lead status");
    return res.json();
  },

  setReminder: async(payload) => {
    const res = await fetch("/api/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to set reminder");
    return res.json();
  },

  forwardLead: async(payload) => {
    const res = await fetch("/api/forward-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error("Failed to forward lead");
    return res.json();
  },
  sendTemplateMessage: async (payload) => {
    const res = await fetch("/api/messages/send-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to send template");
    }
    return res.json();
  }
>>>>>>> c1be5bc (Initial commit from new system)
};