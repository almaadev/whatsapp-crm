import api from "@/shared/lib/axios";

export const leadRepository = {
  getLeads: (options = {}) => api.get("/api/leads", options),
  getLeadByPhone: (phone, options = {}) => api.get(`/api/leads/${phone}`, options),
  createLead: (payload, options = {}) => api.post("/api/leads", payload, options),
  updateLeadStatus: (payload, options = {}) => api.post("/api/lead-status", payload, options),
  forwardLead: (payload, options = {}) => api.post("/api/forward-lead", payload, options)
};
