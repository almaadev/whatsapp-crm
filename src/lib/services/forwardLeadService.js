import { updateCustomer } from "../repositories/customerRepository";
import { createMessage } from "../repositories/messageRepository";
import { sendWhatsAppMessage } from "./twilioService";
import { emitNewMessage } from "./socketEmitter";
import { invalidateCache } from "./cacheService";
import { normalizePhone } from "../utils/phoneUtils";

export const forwardLeadService = {
  async forwardLead(body, session) {
    const { customerPhone, targetPhone, message, associateName } = body;
    const forwardedBy = session.user.name;

    const cleanCustomerPhone = normalizePhone(customerPhone);
    const cleanTargetPhone = normalizePhone(targetPhone);

    try {
      await sendWhatsAppMessage(cleanTargetPhone, message);
    } catch (e) {
      console.error("Twilio Error", e);
    }

    await updateCustomer(cleanCustomerPhone, { assignedTo: associateName });

    const sysMessage = `[System]: Lead forwarded to ${associateName} by ${forwardedBy}`;
    await createMessage({
      phone: cleanCustomerPhone,
      message: sysMessage,
      direction: "OUTBOUND",
      status: "READ",
      twilioSid: "sys_" + Date.now(),
      senderName: "System"
    });

    emitNewMessage({
      phone: cleanCustomerPhone,
      name: `Lead: ${cleanCustomerPhone}`,
      message: sysMessage,
      direction: "INBOUND",
      timestamp: new Date().toISOString(),
      status: "RECEIVED",
      read: "FALSE",
      isForwarded: true,
      forwardedBy: forwardedBy,
      assignedTo: associateName
    });

    await invalidateCache("chats:all_data");

    return { success: true };
  }
};
