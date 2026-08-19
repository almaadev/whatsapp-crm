import { findAllAutomations } from "@/shared/repositories/keywordAutomationRepository";
import { findCustomerByPhone } from "@/shared/repositories/customerRepository";
import { createMessage, getModelByCategory } from "@/shared/repositories/messageRepository";
import { determineConversationRoute } from "@/features/chat/services/chatRoutingService";
import { 
  sendTemplateMessage, 
  sendWhatsAppMessage,
  getTemplateDetail, 
  validateTemplatePayload 
} from "@/features/admin/services/twilioService";
import { emitNewMessage } from "@/shared/utils/socketPublisher";
import Message from "@/shared/models/Message";
import CRMTemplate from "@/shared/models/CRMTemplate";
import Lead from "@/shared/models/Lead";
import Branch from "@/shared/models/Branch";
import { resolveTemplate } from "@/shared/utils/templateResolver";

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
async function saveAndEmitMessage({
  phone,
  messageText,
  status,
  twilioSid,
  templateSid = "",
  templateMetadata = null,
  targetCategory,
  senderNumber,
}) {
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
    templateMetadata: templateMetadata,
    source: "Keyword Automation",
    chatType: targetCategory || "Direct Lead",
    senderNumber: senderNumber,
    timestamp: new Date(),
    read: "TRUE",
    isChatClosed: false,
    mediaUrl: "",
    mediaType: "",
  };

  const savedMsg = await createMessage(msgPayload, Message);
  const socketEmitObj = { ...msgPayload, _id: savedMsg._id };

  emitNewMessage(socketEmitObj);

  return savedMsg;
}

function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const inFlightAutoReplies = new Set();

export async function processKeywordAutoReply(phone, messageText, profileName = "", senderNumber = null, options = {}) {
  if (!messageText) return false;

  const inboundSid = options?.inboundMessageSid;

  // In-flight concurrency lock: prevent race condition if retry arrives while external Twilio call is pending
  if (inboundSid && inFlightAutoReplies.has(inboundSid)) {
    console.log(`[AUTO-REPLY] Reply currently in-flight for inboundMessageSid=${inboundSid}. Skipping concurrent execution.`);
    return true;
  }

  if (inboundSid) {
    inFlightAutoReplies.add(inboundSid);
  }

  try {
    const activeKeywords = await findAllAutomations({ isActive: true });
    if (!activeKeywords.length) return false;

    const cleanText = normalizeText(messageText);
    const matchedKeyword = activeKeywords.find((k) => {
      if (Array.isArray(k.keywords) && k.keywords.length > 0) {
        return k.keywords.some((keyword) => {
          const cleanKeyword = normalizeText(keyword);
          return cleanKeyword && cleanText === cleanKeyword;
        });
      }
      const legacyKey = k.key || k.keyword;
      if (legacyKey) {
        const cleanKeyword = normalizeText(legacyKey);
        return cleanKeyword && cleanText === cleanKeyword;
      }
      return false;
    });

    if (matchedKeyword) {
      console.log(`🤖 [AUTO-REPLY] Match found for keyword: "${matchedKeyword.key || matchedKeyword.keywords?.[0]}" (Sender: ${senderNumber})`);

      // Outbound Idempotency Check: prevent duplicate Twilio send if retry occurs
      if (inboundSid) {
        const alreadySent = await Message.findOne({
          phone,
          direction: "OUTBOUND",
          "templateMetadata.sourceMessageSid": inboundSid,
        }).lean();

        if (alreadySent) {
          console.log(`[AUTO-REPLY] Outbound reply already sent for inboundMessageSid=${inboundSid}. Skipping duplicate dispatch.`);
          return true;
        }
      }

      // 1. Fetch customer details and determine route category
      let customer = await findCustomerByPhone(phone);
      let targetCategory = customer?.activeRouteCategory || "Direct Lead";
      if (!customer) {
        targetCategory = await determineConversationRoute(phone, messageText, null);
      }

      if (customer?.isOptedOut) {
        console.log(`[AUTO-REPLY] Customer ${phone} is opted out. Cancelling auto reply.`);
        return false;
      }

      // ==========================================
      // BRANCH A: CRM TEMPLATE AUTO-REPLY
      // ==========================================
      if (matchedKeyword.templateType === "crm" || (matchedKeyword.templateId && !matchedKeyword.templateSid)) {
        const crmTemplate = await CRMTemplate.findById(matchedKeyword.templateId).lean();
        if (!crmTemplate || crmTemplate.isArchived || !crmTemplate.isActive) {
          console.warn(`[AUTO-REPLY] CRM template ${matchedKeyword.templateId} is missing or inactive.`);
          return false;
        }

        // Fetch lead and branch context
        let leadDoc = null;
        if (customer?._id) {
          leadDoc = await Lead.findOne({ customerId: customer._id }).lean();
        }

        let branchDoc = null;
        if (customer?.branchId) {
          branchDoc = await Branch.findById(customer.branchId).lean();
        }

        const customerAddress = customer?.currentAddressId || {};

        // Resolve variables server-side
        const { resolvedText, resolvedVariables, missingVariables, isValid } = resolveTemplate({
          template: crmTemplate,
          customer,
          lead: leadDoc,
          branch: branchDoc,
          customerAddress,
        });

        if (!isValid && missingVariables.length > 0) {
          console.warn(`[AUTO-REPLY] Missing required variables for CRM template: ${missingVariables.join(", ")}`);
        }

        try {
          const sent = await sendWhatsAppMessage(phone, resolvedText, { senderNumber });
          await saveAndEmitMessage({
            phone,
            messageText: resolvedText,
            status: sent.status || "SENT",
            twilioSid: sent.sid || `crm_auto_${Date.now()}`,
            templateMetadata: {
              type: "crm",
              templateId: crmTemplate._id,
              templateName: crmTemplate.name,
              version: crmTemplate.version || 1,
              source: "automation",
              automationId: matchedKeyword._id,
              sourceMessageSid: options?.inboundMessageSid || null,
              variables: resolvedVariables,
            },
            targetCategory,
            senderNumber,
          });
          return true;
        } catch (sendErr) {
          console.error(`❌ [AUTO-REPLY] Failed to send CRM Template message: ${sendErr.message}`);
          await saveAndEmitMessage({
            phone,
            messageText: resolvedText,
            status: "failed",
            twilioSid: `failed_crm_${Date.now()}`,
            templateMetadata: {
              type: "crm",
              templateId: crmTemplate._id,
              templateName: crmTemplate.name,
              version: crmTemplate.version || 1,
              source: "automation",
              automationId: matchedKeyword._id,
              sourceMessageSid: options?.inboundMessageSid || null,
              variables: resolvedVariables,
            },
            targetCategory,
            senderNumber,
          });
          return false;
        }
      }

      // ==========================================
      // BRANCH B: WHATSAPP CONTENT API TEMPLATE AUTO-REPLY
      // ==========================================
      const template = await getTemplateDetail(matchedKeyword.templateSid);
      const templateBody = template?.body || `Automated Template: ${matchedKeyword.templateSid}`;

      // Extract placeholders and generate content variables if needed
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

      // Validate template payload
      const validation = validateTemplatePayload(template, contentVariables);

      if (!validation.isValid) {
        console.log(`Validation Failed\nReason:\n${validation.reason}\nTwilio request cancelled.\n`);

        const dummySid = `failed_auto_${Date.now()}`;
        await saveAndEmitMessage({
          phone,
          messageText: templateBody,
          status: "failed",
          twilioSid: dummySid,
          templateSid: matchedKeyword.templateSid,
          templateMetadata: {
            type: "whatsapp",
            source: "automation",
            automationId: matchedKeyword._id,
          },
          targetCategory,
          senderNumber,
        });

        return false;
      }

      // Send template via Twilio using customer's incoming sender number
      try {
        const sentMessage = await sendTemplateMessage(phone, matchedKeyword.templateSid, validation.contentVariables, { senderNumber });

        await saveAndEmitMessage({
          phone,
          messageText: templateBody,
          status: sentMessage.status || "queued",
          twilioSid: sentMessage.sid,
          templateSid: matchedKeyword.templateSid,
          templateMetadata: {
            type: "whatsapp",
            source: "automation",
            automationId: matchedKeyword._id,
            sourceMessageSid: options?.inboundMessageSid || null,
          },
          targetCategory,
          senderNumber,
        });

        return true;
      } catch (sendError) {
        console.error(`❌ Twilio Send Error: ${sendError.message}`);

        const dummySid = `failed_auto_${Date.now()}`;
        await saveAndEmitMessage({
          phone,
          messageText: templateBody,
          status: "failed",
          twilioSid: dummySid,
          templateSid: matchedKeyword.templateSid,
          templateMetadata: {
            type: "whatsapp",
            source: "automation",
            automationId: matchedKeyword._id,
            sourceMessageSid: options?.inboundMessageSid || null,
          },
          targetCategory,
          senderNumber,
        });

        return false;
      }
    }
  } catch (error) {
    console.error("❌ [AUTO-REPLY] Fatal Error processing keyword match:", error);
  } finally {
    if (inboundSid) {
      inFlightAutoReplies.delete(inboundSid);
    }
  }
  return false;
}
