import { findLastMessageByPhone, getModelByCategory } from "../repositories/messageRepository";
import Message from "@/models/Message";
import ProductMessage from "@/models/ProductMessage";
import MDCampMessage from "@/models/MDCampMessage";
import TherapyMessage from "@/models/TherapyMessage";

export const KEYWORD_ROUTES = [
  {
    type: "Product Lead",
    keywords: ["support", "product", "inquiry", "buy", "order", "price", "details", "medicine", "almaa product", "cost", "purchase"]
  },
  {
    type: "MD Camp",
    keywords: ["camp", "medical camp", "free checkup", "doctor camp", "md camp", "mdcamp"]
  },
  {
    type: "Therapy",
    keywords: ["therapy", "massage", "pain relief", "treatment", "varma", "siddha", "clinic"]
  }
];

export { getModelByCategory };

export const checkIsChatClosed = async (phone, category) => {
  const Model = getModelByCategory(category);
  const lastMsg = await findLastMessageByPhone(phone, Model);
  if (!lastMsg) return true;
  return lastMsg.isChatClosed === true;
};

export const matchKeywordRoute = (messageText) => {
  if (!messageText) return "Direct Lead";
  const msgLower = messageText.toLowerCase();

  for (const route of KEYWORD_ROUTES) {
    if (route.keywords.some(kw => msgLower.includes(kw))) {
      return route.type;
    }
  }
  return "Direct Lead";
};

export const resolveMostRecentCategory = async (phone) => {
  const [lastDirect, lastProduct, lastMDCamp, lastTherapy] = await Promise.all([
    findLastMessageByPhone(phone, Message),
    findLastMessageByPhone(phone, ProductMessage),
    findLastMessageByPhone(phone, MDCampMessage),
    findLastMessageByPhone(phone, TherapyMessage),
  ]);

  const candidates = [
    { msg: lastDirect, type: "Direct Lead" },
    { msg: lastProduct, type: "Product Lead" },
    { msg: lastMDCamp, type: "MD Camp" },
    { msg: lastTherapy, type: "Therapy" },
  ].filter((c) => c.msg !== null);

  if (candidates.length === 0) return "Direct Lead";

  candidates.sort((a, b) => {
    const aTime = new Date(a.msg.timestamp || a.msg.createdAt).getTime();
    const bTime = new Date(b.msg.timestamp || b.msg.createdAt).getTime();
    return bTime - aTime;
  });

  const mostRecent = candidates[0];
  if (mostRecent.msg.isChatClosed === true) return "Direct Lead";

  return mostRecent.type;
};

export const determineConversationRoute = async (phone, incomingMessage, currentActiveCategory) => {
  let targetCategory = "Direct Lead";
  let requiresRouting = true;

  const categoryToCheck = currentActiveCategory || "Direct Lead";
  const isClosed = await checkIsChatClosed(phone, categoryToCheck);

  if (isClosed === false) {
    targetCategory = categoryToCheck;
    requiresRouting = false;
  }

  if (requiresRouting) {
    const keywordMatch = matchKeywordRoute(incomingMessage);
    targetCategory = keywordMatch !== "Direct Lead"
      ? keywordMatch
      : await resolveMostRecentCategory(phone);
  }

  return targetCategory;
};
