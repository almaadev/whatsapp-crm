import api from "@/shared/lib/axios";

export const customerRepository = {
  getCustomers: (options = {}) => api.get("/api/customers", options),
  getCustomerByPhone: (phone, options = {}) => api.get(`/api/customers/${phone}`, options),
  createCustomer: (payload, options = {}) => api.post("/api/customers", payload, options),
  updateCustomer: (phone, payload, options = {}) => api.put(`/api/customers/${phone}`, payload, options)
};
