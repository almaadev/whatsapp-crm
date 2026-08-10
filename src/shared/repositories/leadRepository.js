import Lead from "@/shared/models/Lead";
import Customer from "@/shared/models/Customer";

export async function findLeadByPhone(phone) {
  const customer = await Customer.findOne({ phone }).lean();
  if (!customer) return null;
  return await Lead.findOne({ customerId: customer._id }); // Not lean because we might save() it
}

export async function createLead(leadPayload) {
  return await Lead.create(leadPayload);
}

export async function updateLead(lead) {
  return await lead.save();
}

export async function aggregateLeads(pipeline) {
  return await Lead.aggregate(pipeline);
}

export async function closeLeadsByPhones(phones, closedByInfo) {
  const customers = await Customer.find({ phone: { $in: phones } }).select("_id").lean();
  const customerIds = customers.map(c => c._id);
  
  return await Lead.updateMany(
    { customerId: { $in: customerIds } },
    { 
      $set: { 
        isClosed: true, 
        closedBy: closedByInfo.name, 
        closedById: closedByInfo.id, 
        closedAt: new Date() 
      } 
    }
  );
}

export async function findLeadsByFilter(match) {
  return await Lead.find(match).lean();
}
