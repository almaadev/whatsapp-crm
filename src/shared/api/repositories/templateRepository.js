import api from "@/shared/lib/axios";

export const templateRepository = {
  getTemplates: (options = {}) => api.get("/api/admin/templates", options),
  getGeneralTemplates: (options = {}) => api.get("/api/templates", options),
  getTemplateById: (id, options = {}) => api.get(`/api/admin/templates/${id}`, options),
  syncTwilioTemplates: (options = {}) => api.get("/api/admin/twilio", options),
  syncTwilioRate: (payload, options = {}) => api.post("/api/admin/twilio", payload, options),
  createAdminTemplate: (payload, options = {}) => api.post("/api/admin/templates", payload, options),
  createTemplate: (payload, options = {}) => api.post("/api/admin/templates/create", payload, options),
  deleteAdminTemplate: (id, options = {}) => api.delete(`/api/admin/templates/${id}`, options),
  sendTemplate: (payload, options = {}) => api.post("/api/send-template", payload, options),
};
