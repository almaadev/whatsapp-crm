import api from "@/shared/lib/axios";

export const authRepository = {
<<<<<<< HEAD
  getCurrentUser: (options = {}) => api.get("/api/auth/me", options),
=======
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
  logout: (options = {}) => api.post("/api/auth/logout", {}, options)
};
