import KeywordAutomation from "@/shared/models/KeywordAutomation";

export async function findAllAutomations(filter = {}) {
  return await KeywordAutomation.find(filter).sort({ createdAt: -1 }).lean();
}

export async function findAutomationByKeyword(keyword) {
  // exact match or we might want to do case-insensitive search if needed
  return await KeywordAutomation.findOne({
    keyword: keyword.toUpperCase(),
  }).lean();
}

export async function createAutomation(automationPayload) {
  return await KeywordAutomation.create(automationPayload);
}

export async function updateAutomation(id, automationPayload) {
  return await KeywordAutomation.findByIdAndUpdate(
    id,
    { $set: automationPayload },
    { returnDocument: "after" },
  );
}

export async function deleteAutomation(id) {
  return await KeywordAutomation.findByIdAndDelete(id);
}
