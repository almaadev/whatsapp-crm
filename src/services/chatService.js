import axios from "axios";

export const chatService = {
  getMessages: async (role) => {
    try {
      const { data } = await axios.get(`/api/chats`); 
      
      if (!Array.isArray(data)) return [];

      const uniqueConversations = {};
      
      data.forEach((msg) => {
        if (!msg.phone) return;

        // Grouping Logic
        if (!uniqueConversations[msg.phone]) {
          uniqueConversations[msg.phone] = { ...msg, history: [msg] };
        } else {
          uniqueConversations[msg.phone].history.push(msg);

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
          uniqueConversations[msg.phone].messageStatus = msg.messageStatus; 
          
          uniqueConversations[msg.phone].direction = msg.direction; 
          uniqueConversations[msg.phone].read = msg.read;
          
          // 🚀 FIX: Prevent Priority and Closed state from being stripped during array grouping!
           uniqueConversations[msg.phone].priority = msg.priority;
          if (msg.isChatClosed !== undefined) uniqueConversations[msg.phone].isChatClosed = msg.isChatClosed;

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
  sendTemplateMessage: async ({ phone, templateSid, chatType, associateName, contentVariables }) => {
    const res = await fetch("/api/send-template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, templateSid, chatType, associateName, contentVariables })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to send template");
    }
    return res.json();
  }
};