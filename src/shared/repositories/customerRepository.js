import Customer from "@/shared/models/Customer";
import User from "@/shared/models/User";

export async function findAllCustomers(filter = {}) {
  return await Customer.find(filter).populate({
    path: "createdBy",
    select: "name role department branch"
  }).lean();
}

export async function findCustomerByPhone(phone) {
  return await Customer.findOne({ phone }).populate({
    path: "createdBy",
    select: "name role department branch"
  }).lean();
}

export async function upsertCustomer(phone, customerPayload, createdById = null) {
  const update = { $set: customerPayload };
  if (createdById) {
    update.$setOnInsert = { createdBy: createdById };
  }
  return await Customer.findOneAndUpdate(
    { phone },
    update,
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
