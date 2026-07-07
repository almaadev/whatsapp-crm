import api from "@/shared/lib/axios";

export const automationRepository = {
  getKeywords: (options = {}) => api.get("/api/keyword-automation", options),
  createKeyword: (payload, options = {}) => api.post("/api/keyword-automation", payload, options),
  updateKeyword: (id, payload, options = {}) => api.put(`/api/keyword-automation/${id}`, payload, options),
  patchKeyword: (id, payload, options = {}) => api.patch(`/api/keyword-automation/${id}`, payload, options),
  deleteKeyword: (id, options = {}) => api.delete(`/api/keyword-automation/${id}`, options)
};
