import { findMessagesByDateRange, deleteMessagesByPhones, updateMessageStatus, getModelByCategory } from "../repositories/messageRepository";
import { findAllCustomers, updateCustomer } from "../repositories/customerRepository";
import { findLeadByPhone, createLead } from "../repositories/leadRepository";
import { getFromCache, setInCache, invalidateCache } from "./cacheService";
import { sendWhatsAppMessage } from "./twilioService";
import { emitNewMessage } from "./socketEmitter";
import { normalizePhone } from "../utils/phoneUtils";
import Message from "@/models/Message";

const REDIS_CACHE_TTL = 30;
const MAIN_INBOX_CACHE = "chats:main_inbox_data";

export const chatService = {
  async getInboxChats(session) {
    const cachedData = await getFromCache(MAIN_INBOX_CACHE);
    if (cachedData) return cachedData;

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [customers, msgs] = await Promise.all([
      findAllCustomers(),
      findMessagesByDateRange(sixtyDaysAgo, Message),
    ]);

    const allMessages = msgs.map((m) => ({
      ...m,
      categoryLabel: null,
      time: new Date(m.timestamp || m.createdAt || 0).getTime(),
    }));

    allMessages.sort((a, b) => a.time - b.time);

    const contactMap = new Map();
    customers.forEach((c) => {
      contactMap.set(c.phone, {
        name: c.name, status: c.status, city: c.city,
        assignedTo: c.assignedTo, activeRouteCategory: c.activeRouteCategory,
        unreadCount: c.unreadCount || 0, priority: c.priority,
      });
    });

    const chats = allMessages
      .map((msg) => {
        const customerInfo = contactMap.get(msg.phone) || {};
        return {
          phone: msg.phone, name: customerInfo.name || msg.senderName || msg.phone,
          message: msg.message || "", direction: msg.direction, city: customerInfo.city || "",
          activeRouteCategory: customerInfo.activeRouteCategory, status: customerInfo.status || "New",
          priority: customerInfo.priority ?? "Medium", messageStatus: msg.status || "RECEIVED",
          read: msg.read || "TRUE", timestamp: new Date(msg.time).toISOString(), twilioSid: msg.twilioSid || "",
          associate: customerInfo.assignedTo || "", categoryLabel: msg.categoryLabel, role: "sales",
          isChatClosed: msg.isChatClosed, mediaUrl: msg.mediaUrl || "", mediaType: msg.mediaType || "",
          lastSeenAt: new Date(msg.time).toISOString(), ...customerInfo,
        };
      })
      .filter((chat) => chat.phone && !chat.phone.includes("whatsapp:+14155238886"));

    await setInCache(MAIN_INBOX_CACHE, chats, REDIS_CACHE_TTL);
    return chats;
  },

  async sendMessage(body, session) {
    const { phone, message, name, role, skipSave } = body;
    const cleanPhone = normalizePhone(phone);

    let twilioSid = "sys_msg_" + Date.now();
    try {
      const sent = await sendWhatsAppMessage(cleanPhone, message);
      twilioSid = sent.sid;
    } catch (e) {
      console.error("Twilio Send Error:", e);
    }

    if (!skipSave) {
      await updateCustomer(cleanPhone, { 
        $setOnInsert: { name: name || cleanPhone, status: "New", assignedTo: "unassigned" } 
      }, { upsert: true });

      const lead = await findLeadByPhone(cleanPhone);
      const targetModel = lead && lead.leadType ? getModelByCategory(lead.leadType) : Message;

      await targetModel.create({
        phone: cleanPhone, message: message, direction: "OUTBOUND", status: "SENT",
        twilioSid: twilioSid, senderName: name || "Associate",
      });

      emitNewMessage({
        phone: cleanPhone, message: message, direction: "OUTBOUND",
        timestamp: new Date().toISOString(), status: "SENT", role: role || "sales",
        name: name || cleanPhone,
      });

      await invalidateCache(MAIN_INBOX_CACHE);
    }
    return { success: true, twilioSid };
  },

  async deleteChats(phones) {
    const cleanPhones = phones.map(normalizePhone);
    await deleteMessagesByPhones(cleanPhones);
    await invalidateCache(MAIN_INBOX_CACHE);
    return { success: true, deletedCount: phones.length };
  },

  async updateChatStatus(body) {
    const { phone, isChatClosed, chatType } = body;
    const cleanPhone = normalizePhone(phone);
    const ModelToUpdate = getModelByCategory(chatType);

    const result = await updateMessageStatus({ phone: cleanPhone }, { $set: { isChatClosed } }, ModelToUpdate);
    
    if (ModelToUpdate !== Message) {
      await updateMessageStatus({ phone: cleanPhone }, { $set: { isChatClosed } }, Message);
    }

    if (isChatClosed === true) {
      await updateCustomer(cleanPhone, { activeRouteCategory: "Direct Lead" });
    }
    
    await invalidateCache(MAIN_INBOX_CACHE);
    return { success: true, modifiedCount: result.modifiedCount, message: isChatClosed ? "Chat marked as closed and routing reset." : "Chat reopened." };
  },

  async markAsRead(phone) {
    const cleanPhone = normalizePhone(phone);
    await updateCustomer(cleanPhone, { unreadCount: 0 });

    const cachedData = await getFromCache("chats:all_data");
    if (cachedData) {
      let chats = cachedData.map(c => c.phone === cleanPhone ? { ...c, read: "TRUE", unreadCount: 0 } : c);
      await setInCache("chats:all_data", chats, 600);
    }
    return { success: true };
  }
};
