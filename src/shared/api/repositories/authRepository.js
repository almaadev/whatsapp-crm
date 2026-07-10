import api from "@/shared/lib/axios";

export const authRepository = {
  logout: (options = {}) => api.post("/api/auth/logout", {}, options)
};
