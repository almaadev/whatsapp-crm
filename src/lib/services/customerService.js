import { findAllCustomers, findCustomerByPhone, updateCustomer } from "../repositories/customerRepository";
import { normalizePhone } from "../utils/phoneUtils";

export const customerService = {
  async getCustomers(filters = {}) {
    return await findAllCustomers(filters);
  },

  async getCustomerByPhone(phone) {
    const cleanPhone = normalizePhone(phone);
    return await findCustomerByPhone(cleanPhone);
  },

  async updateCustomer(phone, data) {
    const cleanPhone = normalizePhone(phone);
    return await updateCustomer(cleanPhone, data);
  }
};
