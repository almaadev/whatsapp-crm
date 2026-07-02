import Reminder from "@/models/Reminder";

export async function createReminder(data) {
  return await Reminder.create(data);
}

export async function findRemindersByAssociate(associateId) {
  return await Reminder.find({ associateId, status: "pending" }).lean();
}

export async function cancelReminders(filter) {
  return await Reminder.updateMany(filter, { $set: { status: "cancelled" } });
}

export async function updateReminders(filter, update) {
  return await Reminder.updateMany(filter, { $set: update });
}

export async function findReminderById(id) {
  return await Reminder.findById(id).lean();
}
