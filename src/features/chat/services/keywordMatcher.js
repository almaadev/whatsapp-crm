import { findAllAutomations } from "@/shared/repositories/keywordAutomationRepository";
import { findCustomerByPhone } from "@/shared/repositories/customerRepository";
import { createMessage, getModelByCategory } from "@/shared/repositories/messageRepository";
import { determineConversationRoute } from "@/features/chat/services/chatRoutingService";
import { 
  sendTemplateMessage, 
  getTemplateDetail, 
  validateTemplatePayload 
} from "@/features/admin/services/twilioService";
import { emitNewMessage, emitCategoryMessage } from "@/features/chat/services/socketEmitter";
import Message from "@/shared/models/Message";

/**
 * Automatically builds variable values for dynamic templates based on customer attributes.
 */
function generateContentVariables(templateBody, customer, profileName) {
  if (!templateBody) return null;

  // Extract all placeholders like {{1}}, {{2}}...
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  const placeholders = new Set();
  while ((match = regex.exec(templateBody)) !== null) {
    placeholders.add(match[1].trim());
  }

  if (placeholders.size === 0) {
    return null;
  }

  const variables = {};
  for (const placeholder of placeholders) {
    let val = "";
    if (placeholder === "1") {
      val = customer?.name;
      if (!val || val === "Unknown" || val.startsWith("whatsapp:")) {
        val = profileName || "Customer";
      }
    } else if (placeholder === "2") {
      const bodyLower = templateBody.toLowerCase();
      const isTimeOrDate = bodyLower.includes("appointment") || bodyLower.includes("date") || bodyLower.includes("time") || bodyLower.includes("tomorrow");
      if (isTimeOrDate) {
        val = "Tomorrow";
      } else {
        val = customer?.city || "Chennai";
      }
    } else {
      val = "Value";
    }
    variables[placeholder] = val;
  }
  return variables;
}

/**
 * Saves the automated reply message (whether sent or failed) to MongoDB and triggers socket notifications.
 */
async function saveAndEmitMessage({ phone, messageText, status, twilioSid, templateSid, targetCategory }) {
  const msgPayload = {
    phone: phone,
    message: messageText,
    direction: "OUTBOUND",
    status: status,
    twilioSid: twilioSid,
    senderName: "Auto Answer",
    senderType: "system",
    isAutomated: true,
    sendBy: null,
    templateSid: templateSid,
    source: "Keyword Automation",
    chatType: targetCategory,
    timestamp: new Date(),
    read: "TRUE",
    isChatClosed: false,
    mediaUrl: "",
    mediaType: ""
  };

  const TargetModel = getModelByCategory(targetCategory);
  const savedMsg = await createMessage(msgPayload, TargetModel);

  if (targetCategory !== "Direct Lead") {
    await createMessage({ ...msgPayload, twilioSid: `${twilioSid}_mirror` }, Message);
  }

  const socketEmitObj = { ...msgPayload, _id: savedMsg._id };

  if (targetCategory !== "Direct Lead") {
    emitCategoryMessage(targetCategory, socketEmitObj);
  }

  emitNewMessage({ ...socketEmitObj, categoryLabel: targetCategory !== "Direct Lead" ? targetCategory : null });

  return savedMsg;
}

export async function processKeywordAutoReply(phone, messageText, profileName = "") {
  if (!messageText) return false;

  try {
    const activeKeywords = await findAllAutomations({ isActive: true });
    if (!activeKeywords.length) return false;

    const cleanText = messageText.toLowerCase().trim();
    const matchedKeyword = activeKeywords.find((k) => k.key === cleanText);

    if (matchedKeyword) {
      console.log(`🤖 [AUTO-REPLY] Match found for keyword: "${matchedKeyword.key}"`);

      // 1. Fetch template detail (MongoDB first, then Twilio Content API)
      const template = await getTemplateDetail(matchedKeyword.templateSid);
      const templateBody = template?.body || `Automated Template: ${matchedKeyword.templateSid}`;

      // 2. Fetch customer details and determine route category
      let customer = await findCustomerByPhone(phone);
      let targetCategory = customer?.activeRouteCategory || "Direct Lead";
      if (!customer) {
        targetCategory = await determineConversationRoute(phone, messageText, null);
      }

      // 3. Extract placeholders and generate content variables if needed
      const requiredPlaceholders = new Set();
      if (template?.body) {
        const regex = /\{\{([^}]+)\}\}/g;
        let match;
        while ((match = regex.exec(template.body)) !== null) {
          requiredPlaceholders.add(match[1].trim());
        }
      }
      const isDynamic = requiredPlaceholders.size > 0;

      let contentVariables = null;
      if (isDynamic) {
        contentVariables = generateContentVariables(template?.body, customer, profileName);
      }

      // 4. Output detailed log start
      console.log(`\n[AUTO REPLY]\nKeyword: "${matchedKeyword.key}"\n`);
      console.log(`Automation:\n- Rule ID: ${matchedKeyword._id}\n- Template Name: ${template?.name || "Unknown"}\n- Content SID: ${matchedKeyword.templateSid}\n`);
      console.log(`Template Analysis:\n- Variables Required: ${isDynamic ? "Yes" : "No"}\n- Variables Found: ${contentVariables && Object.keys(contentVariables).length > 0 ? "Yes" : "No"}\n`);

      if (isDynamic && contentVariables) {
        console.log(`Generated Content Variables:\n${JSON.stringify(contentVariables, null, 2)}\n`);
      }

      // 5. Validate template payload
      const validation = validateTemplatePayload(template, contentVariables);

      if (!validation.isValid) {
        console.log(`Validation Failed\nReason:\n${validation.reason}\nTwilio request cancelled.\n`);

        // Save failure status to database & notify UI
        const dummySid = `failed_auto_${Date.now()}`;
        await saveAndEmitMessage({
          phone,
          messageText: templateBody,
          status: "failed",
          twilioSid: dummySid,
          templateSid: matchedKeyword.templateSid,
          targetCategory
        });

        return false;
      }

      // 6. Send template via Twilio
      console.log(`Sending Template...`);
      try {
        const sentMessage = await sendTemplateMessage(phone, matchedKeyword.templateSid, validation.contentVariables);
        console.log(`Success\n`);

        // Save success status to database & notify UI
        await saveAndEmitMessage({
          phone,
          messageText: templateBody,
          status: sentMessage.status || "queued",
          twilioSid: sentMessage.sid,
          templateSid: matchedKeyword.templateSid,
          targetCategory
        });

        return true;
      } catch (sendError) {
        console.error(`❌ Twilio Send Error: ${sendError.message}`);
        console.log(`Validation Failed\nReason:\nTwilio API Error: ${sendError.message}\nTwilio request cancelled.\n`);

        // Save failure status to database & notify UI
        const dummySid = `failed_auto_${Date.now()}`;
        await saveAndEmitMessage({
          phone,
          messageText: templateBody,
          status: "failed",
          twilioSid: dummySid,
          templateSid: matchedKeyword.templateSid,
          targetCategory
        });

        return false;
      }
    }
  } catch (error) {
    console.error("❌ [AUTO-REPLY] Fatal Error processing keyword match:", error);
  }
  return false;
}
