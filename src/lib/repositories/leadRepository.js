import Lead from "@/models/Lead";

export async function findLeadByPhone(phone) {
  return await Lead.findOne({ phone }); // Not lean because we might save() it
}

export async function createLead(data) {
  return await Lead.create(data);
}

export async function updateLead(lead) {
  return await lead.save();
}

export async function aggregateLeads(pipeline) {
  return await Lead.aggregate(pipeline);
}

export async function closeLeadsByPhones(phones, closedByInfo) {
  return await Lead.updateMany(
    { phone: { $in: phones } },
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
