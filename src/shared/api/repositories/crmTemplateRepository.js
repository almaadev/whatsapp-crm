import api from "@/shared/lib/axios";

export const crmTemplateRepository = {
  getTemplates: (params = {}, options = {}) =>
    api.get("/api/crm-templates", { params, ...options }),

  getTemplateById: (id, options = {}) =>
    api.get(`/api/crm-templates/${id}`, options),

  createTemplate: (payload, options = {}) =>
    api.post("/api/crm-templates", payload, options),

  updateTemplate: (id, payload, options = {}) =>
    api.patch(`/api/crm-templates/${id}`, payload, options),

  deleteTemplate: (id, options = {}) =>
    api.delete(`/api/crm-templates/${id}`, options),

  sendCRMTemplate: (payload, options = {}) =>
    api.post("/api/crm-templates/send", payload, options),
};
