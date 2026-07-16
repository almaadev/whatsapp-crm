import { findCustomerByPhone, updateCustomerOptOutStatus, upsertCustomer, updateCustomer } from "../repositories/customerRepository";
import { getModelByCategory, insertManyMessages } from "../repositories/messageRepository";
import { sendWhatsAppMessage } from "./twilioService";
import { emitNewMessage, emitCategoryMessage, emitMessageStatusUpdate } from "./socketEmitter";
import { determineConversationRoute } from "./chatRoutingService";
import { invalidateCache } from "./cacheService";
import { normalizePhone } from "../utils/phoneUtils";
import { processKeywordAutoReply } from "./keywordMatcher";
import Message from "@/models/Message";
import ProductMessage from "@/models/ProductMessage";
import MDCampMessage from "@/models/MDCampMessage";
import TherapyMessage from "@/models/TherapyMessage";

const TWILIO_STATUSES = [
  "queued", "sending", "sent", "failed", "delivered", "undelivered", 
  "read", "partially_delivered", "canceled"
];

function buildInboundMessages({ phone, messageText, twilioSid, profileName, body, numMedia }) {
  const base = {
    phone, direction: "INBOUND", status: "RECEIVED", read: "FALSE",
    isChatClosed: false, senderName: profileName, timestamp: new Date(),
  };

  if (numMedia > 0) {
    return Array.from({ length: numMedia }, (_, i) => ({
      ...base, message: messageText, twilioSid: numMedia > 1 ? `${twilioSid}_${i}` : twilioSid,
      mediaUrl: body[`MediaUrl${i}`] || "", mediaType: body[`MediaContentType${i}`] || "",
    }));
  }

  return [{ ...base, message: messageText, twilioSid, mediaUrl: "", mediaType: "" }];
}

export const webhookService = {
  async processInboundMessage(body) {
    const twilioSid = body.MessageSid || body.sid || "";
    let rawPhone = body.From || body.from || "";
    let phone = normalizePhone(rawPhone);

    const rawMessage = body.Body || body.body || "";
    let messageText = rawMessage.replace(/\\n/g, "\n");
    let numMedia = parseInt(body.NumMedia || body.numMedia || "0", 10);
    if (isNaN(numMedia)) numMedia = 0;
    const profileName = body.ProfileName || phone || "Unknown";

    if (!phone || (!messageText && numMedia === 0)) return { ignored: true };

    let customer = await findCustomerByPhone(phone);
    const incomingTextUpper = messageText.trim().toUpperCase();
    const isStopCommand = incomingTextUpper === "STOP" || incomingTextUpper === "UNSUBSCRIBE";
    const isStartCommand = incomingTextUpper === "START";

    if (isStopCommand) {
      if (!customer || !customer.isOptedOut) {
        await updateCustomerOptOutStatus(phone, true);
        await sendWhatsAppMessage(phone, "You have successfully unsubscribed from our WhatsApp updates.\nYou will no longer receive promotional messages from us.\nIf you wish to receive updates again, simply reply *START*.\nThank you!");
        return { optedOut: true };
      }
    } else if (isStartCommand) {
      if (customer && customer.isOptedOut) {
        await updateCustomerOptOutStatus(phone, false);
        await sendWhatsAppMessage(phone, "Welcome back! \nYou have successfully subscribed to our WhatsApp updates.\nYou'll now receive our latest updates and promotional messages.\nThank you for staying connected with us!");
      }
    }

    let targetCategory = "Direct Lead";
    try {
      targetCategory = await determineConversationRoute(phone, messageText, customer?.activeRouteCategory ?? null);
    } catch (routeError) {
      targetCategory = "Direct Lead";
    }

    if (!customer) {
      customer = await upsertCustomer(phone, {
        name: profileName, status: "New", activeRouteCategory: targetCategory,
        lastInteractionAt: new Date(), unreadCount: 1, source: "Whatsapp"
      });
    } else {
      const updates = {
        activeRouteCategory: targetCategory,
        lastInteractionAt: new Date(),
        unreadCount: (customer.unreadCount || 0) + 1
      };
      if (customer.name === "Unknown" || customer.name === phone.replace("whatsapp:", "")) {
        updates.name = profileName;
      }
      await updateCustomer(phone, updates);
    }

    const inboundMessages = buildInboundMessages({ phone, messageText, twilioSid, profileName, body, numMedia })
      .map((msg) => ({ ...msg, chatType: targetCategory }));

    const TargetModel = getModelByCategory(targetCategory);
    const savedMessages = await insertManyMessages(inboundMessages, TargetModel);
    
    const indicationText = targetCategory !== "Direct Lead"
        ? `🔄 [ROUTED TO ${targetCategory.toUpperCase()}]\n\nCustomer said: ${messageText || "(media)"}`
        : messageText;

    if (targetCategory !== "Direct Lead") {
      const mirrorMessages = inboundMessages.map((msg) => ({
        ...msg, message: indicationText, twilioSid: `${msg.twilioSid}_mirror`
      }));
      await insertManyMessages(mirrorMessages, Message);
    }

    const lastSaved = savedMessages[savedMessages.length - 1];
    const categoryEmit = {
      phone, name: profileName, message: messageText || (numMedia > 0 ? "📷 Media" : ""),
      direction: "INBOUND", timestamp: lastSaved.timestamp || new Date(), chatType: targetCategory,
      mediaUrl: inboundMessages[0]?.mediaUrl || "", mediaType: inboundMessages[0]?.mediaType || "",
      isChatClosed: false, read: "FALSE"
    };

    const catLabel = targetCategory === "Product Lead" ? "Product Inquiry" : 
                     targetCategory === "MD Camp" ? "MD Camp" : 
                     targetCategory === "Therapy" ? "Therapy" : null;

    if (targetCategory !== "Direct Lead") {
      emitCategoryMessage(targetCategory, categoryEmit);
    }

    emitNewMessage({
      ...categoryEmit, message: indicationText || categoryEmit.message, categoryLabel: catLabel
    });

    await processKeywordAutoReply(phone, messageText);
    await invalidateCache("chats:all_data", "chats:main_inbox_data");

    return { success: true };
  },

  async processStatusCallback(body) {
    const twilioSID = body.MessageSid || body.SmsSid || body.sid || "";
    const messageStatus = body.MessageStatus || body.SmsStatus || body.status || "";

    if (messageStatus && TWILIO_STATUSES.includes(messageStatus.toLowerCase())) {
      const formattedStatus = messageStatus.toUpperCase();
      let targetPhone = body.To || body.to || null; 
      let updatedDoc = null;

      if (twilioSID) {
        let retries = 8; 
        while (retries > 0 && !updatedDoc) {
          const [m1, m2, m3, m4] = await Promise.all([
            Message.findOneAndUpdate({ twilioSid: twilioSID }, { $set: { status: formattedStatus } }, { new: true }),
            ProductMessage.findOneAndUpdate({ twilioSid: twilioSID }, { $set: { status: formattedStatus } }, { new: true }),
            MDCampMessage.findOneAndUpdate({ twilioSid: twilioSID }, { $set: { status: formattedStatus } }, { new: true }),
            TherapyMessage.findOneAndUpdate({ twilioSid: twilioSID }, { $set: { status: formattedStatus } }, { new: true }),
          ]);
          updatedDoc = m1 || m2 || m3 || m4;
          if (updatedDoc) {
            targetPhone = updatedDoc.phone;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
          retries--;
        }
      }

      if (!updatedDoc && targetPhone) {
         let cleanPhone = normalizePhone(targetPhone);
         const fallbackUpdate = async (Model) => {
             const latest = await Model.findOne({ phone: cleanPhone, direction: "OUTBOUND" }).sort({ createdAt: -1 });
             if (latest) {
                 latest.status = formattedStatus;
                 if(!latest.twilioSid) latest.twilioSid = twilioSID; 
                 await latest.save();
                 return latest;
             }
             return null;
         };
         
         updatedDoc = await fallbackUpdate(Message) || await fallbackUpdate(ProductMessage) || await fallbackUpdate(MDCampMessage) || await fallbackUpdate(TherapyMessage);
      }

      emitMessageStatusUpdate({
        sid: twilioSID, status: formattedStatus, phone: targetPhone
      });

      await invalidateCache("chats:all_data", "chats:main_inbox_data");
      return { success: true, statusUpdated: !!updatedDoc, finalStatus: formattedStatus };
    }
    return { success: true, ignored: true, reason: "Not a valid status update" };
  }
};
