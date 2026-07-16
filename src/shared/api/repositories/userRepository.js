import api from "@/shared/lib/axios";

export const userRepository = {
  getCurrentUser: (options = {}) => api.get("/api/auth/me", options),
  getUsers: (options = {}) => api.get("/api/users", options),
  getUserById: (id, options = {}) => api.get(`/api/users/${id}`, options),
  createUser: (payload, options = {}) => api.post("/api/users", payload, options),
  updateUser: (id, payload, options = {}) => api.put(`/api/users/${id}`, payload, options),
  updateUserWithoutId: (payload, options = {}) => api.put("/api/users", payload, options),
  deleteUser: (id, options = {}) => api.delete(`/api/users?id=${id}`, options),
  getBranches: (options = {}) => api.get("/api/branches", options),
};
