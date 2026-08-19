import { CRM_TEMPLATE_VARIABLES } from "./templateVariables.js";

/**
 * Extracts all variable keys inside {{variable}} placeholders from text.
 * @param {string} text 
 * @returns {string[]} Array of unique variable keys
 */
export function extractVariablesFromText(text) {
  if (!text || typeof text !== "string") return [];
  const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.add(match[1].trim());
  }
  return Array.from(matches);
}

/**
 * Sanitizes template text for WhatsApp compatibility:
 * - Converts HTML breaks to newlines
 * - Strips any arbitrary HTML markup (e.g. <span>, <div>, <p>)
 * - Preserves native WhatsApp markdown (*bold*, _italic_, ~strike~, ```monospace```)
 * @param {string} text 
 * @returns {string} Clean WhatsApp-compatible string
 */
export function sanitizeWhatsAppText(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<p>/gi, "")
    .replace(/<\/p>/gi, "\n")
    .replace(/<strong>(.*?)<\/strong>/gi, "*$1*")
    .replace(/<b>(.*?)<\/b>/gi, "*$1*")
    .replace(/<em>(.*?)<\/em>/gi, "_$1_")
    .replace(/<i>(.*?)<\/i>/gi, "_$1_")
    .replace(/<del>(.*?)<\/del>/gi, "~$1~")
    .replace(/<strike>(.*?)<\/strike>/gi, "~$1~")
    .replace(/<code>(.*?)<\/code>/gi, "```$1```")
    .replace(/<[^>]*>/g, "") // Strip any remaining tags
    .trim();
}

/**
 * Resolves a single variable key against provided domain context.
 */
export function resolveVariableValue(key, context = {}) {
  const { customer = {}, lead = {}, branch = {}, customerAddress = {} } = context;
  const rawKey = key.trim();

  switch (rawKey) {
    case "name":
    case "customerName": {
      const rawName = customer.name || customer.customerName || "";
      if (rawName && !rawName.startsWith("whatsapp:") && rawName.toLowerCase() !== "unknown") {
        return rawName.trim();
      }
      return null;
    }

    case "firstName": {
      const rawName = customer.name || customer.customerName || "";
      if (rawName && !rawName.startsWith("whatsapp:") && rawName.toLowerCase() !== "unknown") {
        const parts = rawName.trim().split(/\s+/);
        return parts[0] || null;
      }
      return null;
    }

    case "phone": {
      const rawPhone = customer.phone || "";
      return rawPhone ? rawPhone.replace("whatsapp:", "").trim() : null;
    }

    case "branchName": {
      if (branch && branch.name) return branch.name;
      if (customer.branch && customer.branch.name) return customer.branch.name;
      if (customer.branchName) return customer.branchName;
      return null;
    }

    case "associateName": {
      // Strictly resolve assigned associate from customer/lead data — NEVER logged-in user
      const assigned = customer.assignedTo || lead.assignedTo || customer.associate;
      if (assigned && assigned.toLowerCase() !== "unassigned") {
        return assigned;
      }
      return null;
    }

    case "leadType": {
      return customer.activeRouteCategory || lead.leadType || null;
    }

    case "leadStatus": {
      return customer.status || lead.status || null;
    }

    case "remarks": {
      return customer.remarks || (lead.leads && lead.leads[0]?.overAllRemarks) || null;
    }

    case "city": {
      return customerAddress.city || customer.city || null;
    }

    default:
      return null;
  }
}

/**
 * Resolves a CRM template body against customer/lead/branch context.
 * Used by Manual Send, Keyword Automation, and Preview UI.
 *
 * @param {Object} params
 * @param {string|Object} params.template - Template object or body string
 * @param {Object} [params.customer] - Customer document
 * @param {Object} [params.lead] - Lead document
 * @param {Object} [params.branch] - Branch document
 * @param {Object} [params.customerAddress] - Address document
 * @param {boolean} [params.useSampleData=false] - If true, fills missing variables with sample data for preview
 * @returns {{ resolvedText: string, resolvedVariables: Object, missingVariables: string[], isValid: boolean }}
 */
export function resolveTemplate({
  template,
  customer = {},
  lead = {},
  branch = {},
  customerAddress = {},
  useSampleData = false,
}) {
  const bodyText = typeof template === "string" ? template : template?.body || "";
  const cleanBody = sanitizeWhatsAppText(bodyText);
  const variableKeys = extractVariablesFromText(cleanBody);

  const context = { customer, lead, branch, customerAddress };
  const resolvedVariables = {};
  const missingVariables = [];

  let resolvedText = cleanBody;

  for (const key of variableKeys) {
    const varMeta = CRM_TEMPLATE_VARIABLES[key] || {};
    let val = resolveVariableValue(key, context);

    if (!val && useSampleData) {
      val = varMeta.sample || `[${key}]`;
    }

    if (!val && varMeta.fallback) {
      val = varMeta.fallback;
    }

    if (val !== null && val !== undefined && String(val).trim() !== "") {
      resolvedVariables[key] = String(val).trim();
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      resolvedText = resolvedText.replace(regex, resolvedVariables[key]);
    } else {
      missingVariables.push(key);
      // If variable cannot be resolved and has no fallback, remove placeholder or flag
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      resolvedText = resolvedText.replace(regex, "");
    }
  }

  // Clean up any double spaces left from blank replacements
  resolvedText = resolvedText.replace(/[ \t]+/g, " ").trim();

  return {
    resolvedText,
    resolvedVariables,
    missingVariables,
    isValid: missingVariables.length === 0,
  };
}
