import { createReminder, updateReminders } from "../repositories/reminderRepository";
import { getUserNameById } from "../repositories/userRepository";
import { createMessage } from "../repositories/messageRepository";
import { sendWhatsAppMessage } from "./twilioService";
import { emitNewMessage } from "./socketEmitter";
import { invalidateCache } from "./cacheService";
import { normalizePhone } from "../utils/phoneUtils";
import Reminder from "@/models/Reminder";

export const reminderService = {
  async setReminder(body, session) {
    const { phone, message, date, time } = body;
    const scheduledTime = new Date(`${date}T${time}`);
    const cleanPhone = normalizePhone(phone);
    const associate = await getUserNameById(session.user.id, "Unknown");

    await updateReminders({ phone: cleanPhone, status: "PENDING" }, { status: "CANCELLED" });

    await createReminder({
      associate, phone: cleanPhone, message, scheduledTime, status: "PENDING"
    });
    return { success: true, message: "Reminder Set" };
  },

  async getReminder(phone) {
    const cleanPhone = normalizePhone(phone);
    const activeReminder = await Reminder.findOne({ phone: cleanPhone, status: "PENDING" }).sort({ createdAt: -1 }).lean();

    if (activeReminder) {
      return {
        success: true,
        reminder: { date: activeReminder.scheduledTime, message: activeReminder.message, associate: activeReminder.associate }
      };
    }
    return { success: true, reminder: null };
  },

  async cancelReminder(phone) {
    const cleanPhone = normalizePhone(phone);
    await updateReminders({ phone: cleanPhone, status: "PENDING" }, { status: "CANCELLED" });
    return { success: true, message: "Reminder Cancelled" };
  },

  async checkDueReminders() {
    const now = new Date();
    const dueReminders = await Reminder.find({ status: "PENDING", scheduledTime: { $lte: now } });

    if (dueReminders.length === 0) return { success: true, processed: [] };

    const processed = [];

    for (const reminder of dueReminders) {
      try {
        const cleanPhone = normalizePhone(reminder.phone);
        const text = `[Reminder]: ${reminder.message}`;
        
        const sent = await sendWhatsAppMessage(cleanPhone, text);

        await createMessage({
          phone: cleanPhone, message: text, direction: "OUTBOUND",
          status: "SENT", twilioSid: sent.sid, senderName: reminder.associate
        });

        emitNewMessage({
          phone: cleanPhone, message: text, direction: "OUTBOUND",
          timestamp: new Date().toISOString(), status: "SENT",
          role: "sales", name: reminder.associate
        });

        reminder.status = "DONE";
        await reminder.save();

        processed.push({ phone: reminder.phone, message: reminder.message, associate: reminder.associate });
      } catch (e) {
        console.error(`Reminder Send Failed for ${reminder.phone}`, e);
      }
    }

    await invalidateCache("chats:all_data");
    return { success: true, processed };
  }
};
