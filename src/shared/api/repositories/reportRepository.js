import api from "@/shared/lib/axios";

export const reportRepository = {
  getAdminReports: (options = {}) => api.get("/api/admin/reports", options),
  getAdminDashboard: (endpoint, query, options = {}) => api.get(`${endpoint}?${query}`, options),
  getAssociateDashboard: (query = "", options = {}) => 
    api.get(`/api/associate/dashboard?${query}`, options),

  getMessageLogs: (query = "", options = {}) =>
    api.get(`/api/message-logs?${query}`, options),

  exportMessageLogs: (query = "", options = {}) =>
    api.get(`/api/message-logs?${query}&mode=export`, { ...options, responseType: 'blob' })
};
