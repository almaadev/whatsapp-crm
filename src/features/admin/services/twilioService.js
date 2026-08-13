import twilio from "twilio";
import connectDB from "@/shared/lib/db/mongodb";
import TwilioNumber from "@/shared/models/TwilioNumber";
import Branch from "@/shared/models/Branch";
import User from "@/shared/models/User";
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

export function formatPhoneNumber(rawNumber) {
  if (!rawNumber) return "";
  let cleaned = rawNumber.replace("whatsapp:", "").trim();
  if (!cleaned.startsWith("+")) {
    cleaned = `+${cleaned}`;
  }
  return cleaned;
}

export function formatWhatsAppAddress(rawNumber) {
  const cleaned = formatPhoneNumber(rawNumber);
  return cleaned ? `whatsapp:${cleaned}` : "";
}

/**
 * Bootstrap Twilio numbers from ENV on app initialization.
 * Reads process.env values, creates DB records if missing.
 * After bootstrapping, system exclusively relies on Database records.
 */
export async function bootstrapTwilioNumbersFromEnv() {
  try {
    await connectDB();
    const envNumbersString =
      process.env.TWILIO_PHONE_NUMBERS ||
      process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER ||
      process.env.TWILIO_PHONE_NUMBER ||
      "";

    const envNumbers = envNumbersString
      .split(",")
      .map((n) => formatPhoneNumber(n))
      .filter((n) => n.length > 5);

    if (envNumbers.length === 0) return;

    for (let i = 0; i < envNumbers.length; i++) {
      const num = envNumbers[i];
      const existing = await TwilioNumber.findOne({ phoneNumber: num });
      if (!existing) {
        await TwilioNumber.create({
          friendlyName: i === 0 ? "Main Business Sender" : `Sender Number ${i + 1}`,
          phoneNumber: num,
          status: "active",
          isActive: true,
        });
        console.log(`✅ [TWILIO BOOTSTRAP] Created TwilioNumber record for ${num}`);
      }
    }
  } catch (err) {
    console.error("❌ [TWILIO BOOTSTRAP] Error initializing Twilio numbers from ENV:", err.message);
  }
}

/**
 * Get available Twilio numbers based on 3-tier ownership hierarchy:
 * - Super Admin: all active numbers
 * - Admin: numbers assigned directly to Admin (assignedAdmins array / assignedSenderNumbers)
 * - Associate: numbers assigned to Associate that belong to their Admin (assignedSenderNumbers / assignedSenderNumber)
 */
export async function getAvailableNumbers(user = null) {
  await connectDB();
  await bootstrapTwilioNumbersFromEnv();

  const allNumbers = await TwilioNumber.find().lean();

  if (!user) return allNumbers;

  const role = user.role;
  const department = user.department;
  const userId = (user.id || user._id)?.toString();

  // 1. Super Admin: full access to every sender
  if (role === "superAdmin") {
    return allNumbers;
  }

  // Fetch full User document if user object is lightweight session user
  let fullUserDoc = null;
  if (userId) {
    fullUserDoc = await User.findById(userId).lean();
  }
  const activeUser = fullUserDoc || user;

  const assignedSenderIds = new Set(
    [
      ...(activeUser.assignedSenderNumbers || []),
      ...(activeUser.assignedTwilioNumbers || []),
      activeUser.assignedSenderNumber,
    ]
      .filter(Boolean)
      .map((id) => (id._id || id).toString())
  );

  // 2. Admin (Department is admin OR role is admin/superAdmin): access numbers assigned directly to this Admin
  const isAdmin = department === "admin" || role === "admin" || activeUser.isAdmin;
  if (isAdmin) {
    const adminNumbers = allNumbers.filter((num) => {
      const isDirectAdmin = (num.assignedAdmins || []).some((id) => id.toString() === userId);
      const isUserAssigned = assignedSenderIds.has(num._id.toString());
      return isDirectAdmin || isUserAssigned;
    });

    return adminNumbers;
  }

  // 3. Associate (Telecaller / Support): strictly assigned sender numbers owned by their Admin
  const associateNumbers = allNumbers.filter((num) => {
    const isAssignedToAssociate = assignedSenderIds.has(num._id.toString());
    if (!isAssignedToAssociate) return false;

    // Check if the number is assigned to Associate's Admin
    if (activeUser.createdBy || activeUser.assignedBy) {
      const adminId = (activeUser.assignedBy || activeUser.createdBy)?.toString();
      const isAdminAssigned = (num.assignedAdmins || []).some((id) => id.toString() === adminId);
      // If adminId exists, enforce that Admin owns this number
      if (adminId && !isAdminAssigned) {
        return false;
      }
    }

    return true;
  });

  return associateNumbers;
}

/**
 * Get active Twilio numbers assigned to a specific branch (Legacy/Filtering fallback).
 */
export async function getBranchNumbers(branchId) {
  await connectDB();
  if (!branchId) return [];
  return await TwilioNumber.find({
    branchId: branchId,
    isActive: true,
    status: "active",
  }).lean();
}

/**
 * Validate whether a user is authorized to send messages using a specific sender number.
 */
export async function validateSenderPermission(user, requestedSender = null) {
  await connectDB();
  const available = await getAvailableNumbers(user);

  if (available.length === 0) {
    return {
      allowed: false,
      reason: "No active WhatsApp sender number is assigned to your account. Please contact your administrator.",
      senderNumber: null,
    };
  }

  if (!requestedSender) {
    const defaultSender = available[0];
    return {
      allowed: true,
      senderNumber: formatPhoneNumber(defaultSender.phoneNumber),
      numberDoc: defaultSender,
    };
  }

  const cleanedSender = formatPhoneNumber(requestedSender);
  const match = available.find((n) => formatPhoneNumber(n.phoneNumber) === cleanedSender);

  if (!match) {
    return {
      allowed: false,
      reason: `Forbidden: You do not have permission to send from ${requestedSender}`,
      senderNumber: cleanedSender,
      numberDoc: null,
    };
  }

  return { allowed: true, senderNumber: cleanedSender, numberDoc: match };
}

/**
 * Resolves the appropriate sender number given a user context and requested sender.
 */
export async function resolveSenderNumber(user, requestedSender = null) {
  await connectDB();
  await bootstrapTwilioNumbersFromEnv();

  const validation = await validateSenderPermission(user, requestedSender);
  if (!validation.allowed) {
    throw new Error(validation.reason || `Forbidden: Permission denied for sender ${requestedSender}`);
  }

  return validation.senderNumber;
}

/**
 * Fetches template detail either from local DB or falls back to Twilio Content API.
 */
export async function getTemplateDetail(templateSid) {
  try {
    const dbTpl = await findTemplateBySid(templateSid);
    if (dbTpl) return dbTpl;
  } catch (e) {
    console.error("Error finding template in DB:", e);
  }

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
        types: content.types,
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
      isDynamic: false,
    };
  }

  if (!template.body) {
    return {
      isValid: false,
      reason: "Template body is empty or not defined.",
      errorType: "EMPTY_BODY",
      isDynamic: false,
    };
  }

  const regex = /\{\{([^}]+)\}\}/g;
  let match;
  const requiredPlaceholders = new Set();
  while ((match = regex.exec(template.body)) !== null) {
    requiredPlaceholders.add(match[1].trim());
  }

  const hasPlaceholders = requiredPlaceholders.size > 0;

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
        isDynamic: true,
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
          isDynamic: true,
        };
      }
      cleanedVariables[placeholder] = String(val);
    }

    return {
      isValid: true,
      isDynamic: true,
      contentVariables: cleanedVariables,
    };
  } else {
    return {
      isValid: true,
      isDynamic: false,
      contentVariables: null,
    };
  }
}

/**
 * Centralized WhatsApp message dispatch.
 */
export async function sendWhatsAppMessage(to, body, options = {}) {
  const { senderNumber = null, user = null } = options;
  const resolvedSender = await resolveSenderNumber(user, senderNumber);
  const client = getTwilioClient();

  const formattedTo = formatWhatsAppAddress(to);
  const formattedFrom = formatWhatsAppAddress(resolvedSender);

  const sent = await client.messages.create({
    body,
    from: formattedFrom,
    to: formattedTo,
    statusCallback: getStatusCallbackUrl(),
  });

  return {
    ...sent,
    senderNumber: resolvedSender,
  };
}

/**
 * Centralized WhatsApp template message dispatch.
 */
export async function sendTemplateMessage(to, templateSid, contentVariables = null, options = {}) {
  if (!templateSid) {
    throw new Error("Validation Failed: Content SID is missing.");
  }

  const template = await getTemplateDetail(templateSid);
  if (!template) {
    throw new Error(`Validation Failed: Template with SID ${templateSid} not found.`);
  }

  const validation = validateTemplatePayload(template, contentVariables);
  if (!validation.isValid) {
    throw new Error(`Validation Failed: ${validation.reason}`);
  }

  const { senderNumber = null, user = null } = options;
  const resolvedSender = await resolveSenderNumber(user, senderNumber);
  const client = getTwilioClient();

  const formattedTo = formatWhatsAppAddress(to);
  const formattedFrom = formatWhatsAppAddress(resolvedSender);

  const messagePayload = {
    contentSid: templateSid,
    from: formattedFrom,
    to: formattedTo,
    statusCallback: getStatusCallbackUrl(),
  };

  if (validation.isDynamic && validation.contentVariables) {
    messagePayload.contentVariables = JSON.stringify(validation.contentVariables);
  }

  const sent = await client.messages.create(messagePayload);
  return {
    ...sent,
    senderNumber: resolvedSender,
  };
}
