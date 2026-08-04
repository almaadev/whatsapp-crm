import api from "@/shared/lib/axios";

export const chatRepository = {
  getChats: (options = {}) => api.get("/api/chats", options),
  sendMessage: (payload, options = {}) => api.post("/api/chats", payload, options),
  updateStatus: (payload, options = {}) => api.post("/api/chats/status", payload, options),
  markRead: (payload, options = {}) => api.post("/api/chats/mark-read", payload, options),
  sendTemplate: (payload, options = {}) => api.post("/api/send-template", payload, options)
};
