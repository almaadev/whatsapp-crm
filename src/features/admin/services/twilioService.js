import twilio from "twilio";
import { findTemplateBySid } from "@/shared/repositories/templateRepository";

let twilioClientInstance = null;

export function getTwilioClient() {
  if (!twilioClientInstance) {
    twilioClientInstance = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return twilioClientInstance;
}

export function getStatusCallbackUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL 
    ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status` 
    : "https://nonarsenic-nonparous-clotilde.ngrok-free.dev/api/webhook/status"; // fallback for local dev
}

/**
 * Fetches template detail either from local DB or falls back to Twilio Content API.
 */
export async function getTemplateDetail(templateSid) {
  // 1. Try DB lookup
  try {
    const dbTpl = await findTemplateBySid(templateSid);
    if (dbTpl) return dbTpl;
  } catch (e) {
    console.error("Error finding template in DB:", e);
  }

  // 2. Fall back to Twilio Content API fetch
  try {
    const client = getTwilioClient();
    const content = await client.content.v1.contents(templateSid).fetch();
    if (content) {
      const types = content.types || {};
      const typeKey = Object.keys(types)[0];
      let bodyText = "";
      if (typeKey && types[typeKey] && types[typeKey].body) {
        bodyText = types[typeKey].body;
      }
      return {
        sid: content.sid,
        name: content.friendlyName || "Unnamed Template",
        language: content.language,
        body: bodyText,
        variables: content.variables || {},
        types: content.types
      };
    }
  } catch (e) {
    console.error(`Error fetching template ${templateSid} from Twilio:`, e);
  }
  return null;
}

/**
 * Validates variables against template placeholders.
 */
export function validateTemplatePayload(template, contentVariables) {
  if (!template) {
    return {
      isValid: false,
      reason: "Template not found.",
      errorType: "TEMPLATE_NOT_FOUND",
      isDynamic: false
    };
  }

  if (!template.body) {
    return {
      isValid: false,
      reason: "Template body is empty or not defined.",
      errorType: "EMPTY_BODY",
      isDynamic: false
    };
  }

  // Extract all placeholders like {{1}}, {{2}} from body
  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  const requiredPlaceholders = new Set();
  while ((match = regex.exec(template.body)) !== null) {
    requiredPlaceholders.add(match[1].trim());
  }

  const hasPlaceholders = requiredPlaceholders.size > 0;
  
  // Handle stringified contentVariables safely
  let providedVars = contentVariables;
  if (typeof contentVariables === "string") {
    try {
      providedVars = JSON.parse(contentVariables);
    } catch (e) {
      providedVars = {};
    }
  }
  providedVars = providedVars || {};

  if (hasPlaceholders) {
    if (typeof providedVars !== "object" || Array.isArray(providedVars) || providedVars === null) {
      return {
        isValid: false,
        reason: "Template requires variables, but contentVariables is not a valid JSON object.",
        errorType: "INVALID_VARIABLES_FORMAT",
        isDynamic: true
      };
    }

    const cleanedVariables = {};
    for (const placeholder of requiredPlaceholders) {
      const val = providedVars[placeholder];
      if (val === undefined || val === null || String(val).trim() === "") {
        return {
          isValid: false,
          reason: `Template requires variable {{${placeholder}}} but no value was provided or it was empty.`,
          errorType: "MISSING_VARIABLE",
          missingPlaceholder: placeholder,
          isDynamic: true
        };
      }
      cleanedVariables[placeholder] = String(val); // ensure string type
    }

    return {
      isValid: true,
      isDynamic: true,
      contentVariables: cleanedVariables
    };
  } else {
    // Static Template: should not have contentVariables
    return {
      isValid: true,
      isDynamic: false,
      contentVariables: null
    };
  }
}

export async function sendWhatsAppMessage(to, body) {
  const client = getTwilioClient();
  const from = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
  
  const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const formattedFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  return await client.messages.create({
    body,
    from: formattedFrom,
    to: formattedTo,
    statusCallback: getStatusCallbackUrl()
  });
}

export async function sendTemplateMessage(to, templateSid, contentVariables = null) {
  if (!templateSid) {
    throw new Error("Validation Failed: Content SID is missing.");
  }

  const template = await getTemplateDetail(templateSid);
  if (!template) {
    throw new Error(`Validation Failed: Template with SID ${templateSid} not found.`);
  }

  // Validate the template payload
  const validation = validateTemplatePayload(template, contentVariables);

  if (!validation.isValid) {
    throw new Error(`Validation Failed: ${validation.reason}`);
  }

  const client = getTwilioClient();
  const from = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;

  const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const formattedFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;

  const messagePayload = {
    contentSid: templateSid,
    from: formattedFrom,
    to: formattedTo,
    statusCallback: getStatusCallbackUrl()
  };

  if (validation.isDynamic && validation.contentVariables) {
    messagePayload.contentVariables = JSON.stringify(validation.contentVariables);
  }

  return await client.messages.create(messagePayload);
}
