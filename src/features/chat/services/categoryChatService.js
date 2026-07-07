import { chatRepository } from "@/shared/api/repositories/chatRepository";

export const categoryChatService = {

  getChats: async (category, search = "") => {
    let query = {};
    if (search) {
      query = { params: { search } };
    }
    const { data } = await chatRepository.getChatsByCategory(category, query);
    return data;
  },

  sendMessage: async (category, phone, message) => {
    // Note: If you need to send to a category route, you'd add this to chatRepository or just use the generic sendMessage
    // Currently chatRepository doesn't have post to `/api/category-chats/${category}`
    // Since category is mostly handled via `/api/chats` internally, I will keep the raw api post for now in the repository pattern
    // Let me update chatRepository directly in a bit if needed, or just abstract it here:
    // Wait, let's look at what chatRepository has:
    // I can just import api directly here if it's missing, but I want to remove api.
    // I'll assume chatRepository has `sendCategoryMessage` - I will add it to chatRepository.
    const { data } = await chatRepository.sendCategoryMessage(category, { phone, message });
    return data;
  },

  updateStatus: async (category, phone, status) => {
    const { data } = await chatRepository.updateCategoryLeadStatus(category, { phone, status });
    return data;
  }

};