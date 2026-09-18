import Message from "../../../shared/models/Message.js";
import Customer from "../../../shared/models/Customer.js";
import { getPhoneVariations } from "../../../shared/utils/phoneUtils.js";

export const KEYWORD_ROUTES = [];

export const getModelByCategory = (category) => Message;

export const findLastMessageByPhone = async (phone, Model = Message) => {
  const variations = getPhoneVariations(phone);
  return await Model.findOne({ phone: { $in: variations } }).sort({ timestamp: -1 }).lean();
};

export const checkIsChatClosed = async (phone, category) => {
  const variations = getPhoneVariations(phone);
  const customer = await Customer.findOne({ phone: { $in: variations } }).lean();
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
