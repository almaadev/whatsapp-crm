import api from "@/shared/lib/axios";

export const bulkMessageRepository = {
  getBulkMessages: (options = {}) => api.get("/api/bulk-message", options),
  createBulkMessage: (payload, options = {}) => api.post("/api/bulk-message", payload, options),
  deleteBulkMessage: (id, options = {}) => api.delete(`/api/bulk-message?id=${id}`, options),
  getCampaignRecipients: (campaignId, params = {}, options = {}) =>
    api.get(`/api/bulk-message/${campaignId}/recipients`, { params, ...options }),
  getCampaignRecall: (campaignId, options = {}) =>
    api.get(`/api/bulk-message/${campaignId}/recall`, options),
};

export default bulkMessageRepository;
