import api from "@/shared/lib/axios";

export const chatRepository = {
  getChats: (options = {}) => api.get("/api/chats", options),
  getChatsByCategory: (category, options = {}) => api.get(`/api/category-chats/${category}`, options),
  sendMessage: (payload, options = {}) => api.post("/api/chats", payload, options),
  updateStatus: (payload, options = {}) => api.post("/api/chats/status", payload, options),
  markRead: (payload, options = {}) => api.post("/api/chats/mark-read", payload, options),
  updateCategoryLeadStatus: (category, payload, options = {}) => api.post(`/api/category-leads-update/${category}`, payload, options),
  sendCategoryMessage: (category, payload, options = {}) => api.post(`/api/category-chats/${category}`, payload, options),
  sendTemplate: (payload, options = {}) => api.post("/api/send-template", payload, options)
};
