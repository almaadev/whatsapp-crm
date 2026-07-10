import Message from "@/shared/models/Message";
import ProductMessage from "@/shared/models/ProductMessage";
import MDCampMessage from "@/shared/models/MDCampMessage";
import TherapyMessage from "@/shared/models/TherapyMessage";

export function getModelByCategory(category) {
  switch (category) {
    case "Product Lead": return ProductMessage;
    case "MD Camp": return MDCampMessage;
    case "Therapy": return TherapyMessage;
    default: return Message;
  }
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
  // Mark across all possible models just to be safe, or specify the model?
  // Usually this is done via updating the last message or emitting to UI, but in DB:
  // Actually, chatStore sets read=TRUE on UI, backend maybe doesn't do it?
  // Let's implement it generic
  await Promise.all([
    Message.updateMany({ phone }, { $set: { read: "TRUE" } }),
    ProductMessage.updateMany({ phone }, { $set: { read: "TRUE" } }),
    MDCampMessage.updateMany({ phone }, { $set: { read: "TRUE" } }),
    TherapyMessage.updateMany({ phone }, { $set: { read: "TRUE" } })
  ]);
}

export async function updateMessageStatus(filter, update, Model = Message) {
  return await Model.updateMany(filter, update);
}

export async function findLastMessageByPhone(phone, Model = Message) {
  return await Model.findOne({ phone }).sort({ timestamp: -1, createdAt: -1 }).lean();
}
