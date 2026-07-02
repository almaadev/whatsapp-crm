import BulkMessage from "@/models/BulkMessage";

export async function createBulkMessageLog(data) {
  return await BulkMessage.create(data);
}

export async function findBulkMessageLogs(filter = {}) {
  return await BulkMessage.find(filter).sort({ createdAt: -1 }).lean();
}

export async function findBulkMessageById(id) {
  return await BulkMessage.findById(id).lean();
}

export async function deleteBulkMessage(id) {
  return await BulkMessage.findByIdAndDelete(id);
}
