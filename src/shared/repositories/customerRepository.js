import Customer from "@/shared/models/Customer";

export async function findAllCustomers(filter = {}) {
  return await Customer.find(filter).lean();
}

export async function findCustomerByPhone(phone) {
  return await Customer.findOne({ phone }).lean();
}

export async function upsertCustomer(phone, customerPayload) {
  return await Customer.findOneAndUpdate(
    { phone },
    { $set: customerPayload },
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

export async function createCustomer(customerPayload) {
  return await Customer.create(customerPayload);
}

export async function updateCustomer(phone, updates) {
  return await Customer.findOneAndUpdate({ phone }, updates, { new: true });
}
