import Message from "@/shared/models/Message";

export function getModelByCategory(category) {
  return Message;
}

export async function findMessagesByDateRange(startDate, Model = Message) {
  return await Model.find({ timestamp: { $gte: startDate } }).lean();
}

export async function createMessage(messagePayload, Model = Message) {
  return await Model.create(messagePayload);
}

export async function insertManyMessages(messages, Model = Message) {
  return await Model.insertMany(messages);
}

export async function deleteMessagesByPhones(phones) {
  return await Message.deleteMany({ phone: { $in: phones } });
}

export async function markMessagesAsRead(phone) {
  await Message.updateMany({ phone }, { $set: { read: "TRUE" } });
}

export async function updateMessageStatus(filter, update, Model = Message) {
  return await Model.updateMany(filter, update);
}

export async function findLastMessageByPhone(phone, Model = Message) {
  return await Model.findOne({ phone }).sort({ timestamp: -1, createdAt: -1 }).lean();
}
