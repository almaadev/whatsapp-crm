import { chatRepository } from "@/shared/api/repositories/chatRepository";
import { leadRepository } from "@/shared/api/repositories/leadRepository";
import { templateRepository } from "@/shared/api/repositories/templateRepository";

/**
 * Service for handling chat-related API calls (inbox, sending, updating status).
 */
export const chatService = {
  /**
   * Fetches all chats and groups messages by phone number into conversation threads.
   *
   * @param {string} role - Optional role filter for fetching messages.
   * @returns {Promise<Array>} An array of grouped conversation objects.
   */
  getMessages: async (role) => {
    try {
      const { data } = await chatRepository.getChats();

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
    const response = await chatRepository.sendMessage(payload);
    return response.data;
  },
  
  updateChatControlStatus: async (phone, isChatClosed, chatType) => {
    const { data } = await chatRepository.updateStatus({ phone, isChatClosed, chatType });
    return data;
  },

  updateLeadLifecycle: async (payload) => {
    const { data } = await leadRepository.updateLeadStatus(payload);
    return data;
  },

  forwardLead: async (payload) => {
    const { data } = await leadRepository.forwardLead(payload);
    return data;
  },
  
  sendTemplateMessage: async ({ phone, templateSid, chatType, associateName, contentVariables }) => {
    const { data } = await templateRepository.sendTemplate({ phone, templateSid, chatType, associateName, contentVariables });
    return data;
  }
};