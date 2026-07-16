import api from "@/shared/lib/axios";

export const branchService = {
  async getBranches({ search = "", status = "", page = 1, limit = 20 } = {}) {
    const params = { page, limit };
    if (search) params.search = search;
    if (status) params.status = status;
    const response = await api.get("/api/branches", { params });
    return response.data;
  },

  async getBranch(id) {
    const response = await api.get(`/api/branches/${id}`);
    return response.data;
  },

  async createBranch(data) {
    const response = await api.post("/api/branches", data);
    return response.data;
  },

  async updateBranch(id, data) {
    const response = await api.put(`/api/branches/${id}`, data);
    return response.data;
  },

  async deleteBranch(id) {
    const response = await api.delete(`/api/branches/${id}`);
    return response.data;
  }
};
