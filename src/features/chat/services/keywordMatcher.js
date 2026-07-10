import { findAllAutomations } from "@/shared/repositories/keywordAutomationRepository";
import { findTemplateBySid } from "@/shared/repositories/templateRepository";
import { findCustomerByPhone } from "@/shared/repositories/customerRepository";
import { createMessage, getModelByCategory } from "@/shared/repositories/messageRepository";
import { determineConversationRoute } from "@/features/chat/services/chatRoutingService";
import { sendTemplateMessage } from "@/features/admin/services/twilioService";
import { emitNewMessage, emitCategoryMessage } from "@/features/chat/services/socketEmitter";
import Message from "@/shared/models/Message";

export async function processKeywordAutoReply(phone, messageText) {
  if (!messageText) return false;

  try {
    const activeKeywords = await findAllAutomations({ isActive: true });
    if (!activeKeywords.length) return false;

    const cleanText = messageText.toLowerCase().trim();
    const matchedKeyword = activeKeywords.find((k) => k.key === cleanText);

    if (matchedKeyword) {
      console.log(`🤖 [AUTO-REPLY] Match found for keyword: "${matchedKeyword.key}"`);

      const sentMessage = await sendTemplateMessage(phone, matchedKeyword.templateSid, "{}");

      const template = await findTemplateBySid(matchedKeyword.templateSid);
      const messageBody = template ? template.body : `Automated Template: ${matchedKeyword.templateSid}`;

      let customer = await findCustomerByPhone(phone);
      let targetCategory = customer?.activeRouteCategory || "Direct Lead";
      if (!customer) {
        targetCategory = await determineConversationRoute(phone, messageText, null);
      }

      const msgPayload = {
        phone: phone, message: messageBody, direction: "OUTBOUND",
        status: sentMessage.status || "queued", twilioSid: sentMessage.sid, 
        senderName: "System Automation", isAutomated: true,
        templateSid: matchedKeyword.templateSid, source: "Keyword Automation",
        chatType: targetCategory, timestamp: new Date(), read: "TRUE",
        isChatClosed: false, mediaUrl: "", mediaType: ""
      };

      const TargetModel = getModelByCategory(targetCategory);
      const savedMsg = await createMessage(msgPayload, TargetModel);
      
      if (targetCategory !== "Direct Lead") {
        await createMessage({ ...msgPayload, twilioSid: `${sentMessage.sid}_mirror` }, Message);
      }

      const socketEmitObj = { ...msgPayload, _id: savedMsg._id };

      if (targetCategory !== "Direct Lead") {
        emitCategoryMessage(targetCategory, socketEmitObj);
      }

      emitNewMessage({ ...socketEmitObj, categoryLabel: targetCategory !== "Direct Lead" ? targetCategory : null });

      return true;
    }
  } catch (error) {
    console.error("❌ [AUTO-REPLY] Error processing keyword match:", error);
  }
  return false;
}
