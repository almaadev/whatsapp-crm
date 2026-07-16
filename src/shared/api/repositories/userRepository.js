import api from "@/shared/lib/axios";

export const userRepository = {
<<<<<<< HEAD
  getCurrentUser: (options = {}) => api.get("/api/auth/me", options),
=======
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
  getUsers: (options = {}) => api.get("/api/users", options),
  getUserById: (id, options = {}) => api.get(`/api/users/${id}`, options),
  createUser: (payload, options = {}) => api.post("/api/users", payload, options),
  updateUser: (id, payload, options = {}) => api.put(`/api/users/${id}`, payload, options),
  updateUserWithoutId: (payload, options = {}) => api.put("/api/users", payload, options),
<<<<<<< HEAD
  deleteUser: (id, options = {}) => api.delete(`/api/users?id=${id}`, options),
=======
  deleteUser: (id, options = {}) => api.delete(`/api/users?id=${id}`, options)
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
};
