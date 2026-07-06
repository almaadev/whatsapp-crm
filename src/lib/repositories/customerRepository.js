import Customer from "@/models/Customer";

export async function findAllCustomers(filter = {}) {
  return await Customer.find(filter).lean();
}

export async function findCustomerByPhone(phone) {
  return await Customer.findOne({ phone }).lean();
}

export async function upsertCustomer(phone, data) {
  return await Customer.findOneAndUpdate(
    { phone },
    { $set: data },
    { upsert: true, new: true },
  );
}

export async function updateCustomerOptOutStatus(phone, isOptedOut) {
  return await Customer.findOneAndUpdate(
    { phone },
    { isOptedOut },
    { upsert: true, new: true },
  );
}

export async function createCustomer(data) {
  return await Customer.create(data);
}

export async function updateCustomer(phone, updates) {
  return await Customer.findOneAndUpdate({ phone }, updates, { new: true });
}
