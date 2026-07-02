import KeywordAutomation from "@/models/KeywordAutomation";

export async function findAllAutomations(filter = {}) {
  return await KeywordAutomation.find(filter).sort({ createdAt: -1 }).lean();
}

export async function findAutomationByKeyword(keyword) {
  // exact match or we might want to do case-insensitive search if needed
  return await KeywordAutomation.findOne({ keyword: keyword.toUpperCase() }).lean();
}

export async function createAutomation(data) {
  return await KeywordAutomation.create(data);
}

export async function updateAutomation(id, data) {
  return await KeywordAutomation.findByIdAndUpdate(id, { $set: data }, { new: true });
}

export async function deleteAutomation(id) {
  return await KeywordAutomation.findByIdAndDelete(id);
}
