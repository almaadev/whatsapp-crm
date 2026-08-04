import { findLastMessageByPhone, getModelByCategory } from "@/shared/repositories/messageRepository";
import Message from "@/shared/models/Message";

export const KEYWORD_ROUTES = [];

export { getModelByCategory };

export const checkIsChatClosed = async (phone, category) => {
  const lastMsg = await findLastMessageByPhone(phone, Message);
  if (!lastMsg) return true;
  return lastMsg.isChatClosed === true;
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
