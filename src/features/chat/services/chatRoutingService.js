import { findLastMessageByPhone, getModelByCategory } from "@/shared/repositories/messageRepository";
import Message from "@/shared/models/Message";
import Customer from "@/shared/models/Customer";

export const KEYWORD_ROUTES = [];

export { getModelByCategory };

export const checkIsChatClosed = async (phone, category) => {
  let customer = await Customer.findOne({ phone }).lean();
  if (!customer) {
    const cleanDigits = phone.replace("whatsapp:", "").replace("+", "");
    const tenDigit = cleanDigits.substring(cleanDigits.length - 10);
    const variations = [
      `whatsapp:${cleanDigits}`,
      `whatsapp:+${cleanDigits}`,
      `+${cleanDigits}`,
      cleanDigits,
      `whatsapp:${tenDigit}`,
      `whatsapp:+${tenDigit}`,
      `+${tenDigit}`,
      tenDigit
    ];
    customer = await Customer.findOne({ phone: { $in: variations } }).lean();
  }
  if (!customer) return true;
  return customer.isClosed === true;
};

export const matchKeywordRoute = (messageText) => {
  return "Direct Lead";
};

export const getMostRecentInteraction = async (phone) => {
  const lastDirect = await findLastMessageByPhone(phone, Message);
  if (!lastDirect) return null;
  return { msg: lastDirect, type: "Direct Lead" };
};

export const resolveMostRecentCategory = async (phone) => {
  return "Direct Lead";
};

export const determineConversationRoute = async (phone, incomingMessage, currentActiveCategory) => {
  return "Direct Lead";
};
