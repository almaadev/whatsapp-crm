import api from "@/shared/lib/axios";

export const authRepository = {
  getCurrentUser: (options = {}) => api.get("/api/auth/me", options),
  logout: (options = {}) => api.post("/api/auth/logout", {}, options)
};
