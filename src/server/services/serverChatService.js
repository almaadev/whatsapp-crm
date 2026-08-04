import Message from "@/shared/models/Message";
import Customer from "@/shared/models/Customer";
import Lead from "@/shared/models/Lead";
import { 
  emitChatStatusUpdated, 
  publishPerformanceEvent 
} from "@/shared/utils/socketPublisher";

export const serverChatService = {
  async updateChatControlStatus(phone, isChatClosed, chatType, session) {
    // 1. Fetch customer to resolve branchId
    const customerDoc = await Customer.findOne({ phone }).lean();
    const branchId = customerDoc ? customerDoc.branchId : null;

    // 2. Check if chat is locked by someone else
    const activeChatHandlers = global.activeChatHandlers;
    const handler = activeChatHandlers ? activeChatHandlers.get(phone) : null;
    const isHandledActive = handler && (!handler.lockedUntil || handler.lockedUntil > Date.now());

    if (isHandledActive) {
      const currentUserId = session.user.id || session.user.email;
      if (handler.userId !== currentUserId) {
        throw new Error(`Access denied: Chat is currently locked and handled by ${handler.name || 'another user'}.`);
      }
    }

    const result = await Message.updateMany(
      { phone },
      { $set: { isChatClosed } }
    );

    const now = new Date();
    const chatHistoryEntry = {
      action: isChatClosed ? "Closed" : "Reopened",
      eventType: isChatClosed ? "Chat Closed" : "Chat Reopened",
      performedBy: session.user.id,
      performedById: session.user.id,
      performedByName: session.user.name || "User",
      performedByRole: session.user.role || "associate",
      performedAt: now,
      timestamp: now,
      notes: isChatClosed ? "Chat marked as closed" : "Chat reopened"
    };

    const customerUpdate = {
      $push: { chatHistory: chatHistoryEntry },
      $set: { isClosed: isChatClosed }
    };

    if (isChatClosed === true) {
      customerUpdate.$set.activeRouteCategory = "Direct Lead";
    }

    await Customer.findOneAndUpdate(
      { phone },
      customerUpdate
    );

    // Call publisher to emit socket events
    emitChatStatusUpdated({
      phone,
      isChatClosed,
      isClosed: isChatClosed,
      chatType
    }, branchId);

    // Telemetry specific for lead reopened if chat reopened
    if (!isChatClosed) {
      // Reopened events
      publishPerformanceEvent("lead_reopened", {
        phone,
        name: customerDoc?.name || "Unknown",
        branchId,
        performedBy: session.user.name
      }, branchId);
      
      publishPerformanceEvent("chat_reopened", {
        phone,
        branchId
      }, branchId);
    } else {
      publishPerformanceEvent("chat_closed", {
        phone,
        branchId
      }, branchId);
    }

    return result;
  }
};
