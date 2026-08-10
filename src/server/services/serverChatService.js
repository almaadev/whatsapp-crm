import Message from "@/shared/models/Message";
import Customer from "@/shared/models/Customer";
import Lead from "@/shared/models/Lead";
import Activity from "@/shared/models/Activity";
import { activityService } from "@/server/services/activityService";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { 
  emitChatStatusUpdated, 
  publishPerformanceEvent 
} from "@/shared/utils/socketPublisher";

export const serverChatService = {
  async updateChatControlStatus(phone, isChatClosed, chatType, session) {
    // 1. Fetch customer to resolve branchId
    const customerDoc = await Customer.findOne({ phone }).lean();
    if (!customerDoc) {
      throw new Error(`Customer with phone ${phone} not found.`);
    }
    const branchId = customerDoc.branchId;

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
    let chatAction = "Reopened";
    let chatEventType = "Chat Reopened";
    let loggedEventType = ActivityEvents.CHAT_REOPENED;

    if (isChatClosed) {
      chatAction = "Closed";
      chatEventType = "Chat Closed";
      loggedEventType = ActivityEvents.CHAT_CLOSED;
    } else {
      const hasPreviousChat = await Activity.exists({
        customerId: customerDoc._id,
        eventType: { $in: [ActivityEvents.CHAT_STARTED, ActivityEvents.CHAT_CLOSED, ActivityEvents.CHAT_REOPENED] }
      });
      if (!hasPreviousChat) {
        chatAction = "Started";
        chatEventType = "Chat Started";
        loggedEventType = ActivityEvents.CHAT_STARTED;
      }
    }

    const customerUpdate = {
      $set: { isClosed: isChatClosed }
    };

    if (isChatClosed) {
      customerUpdate.$set.closedById = session.user.id;
      customerUpdate.$set.closedAt = now;
    } else {
      if (loggedEventType === ActivityEvents.CHAT_REOPENED) {
        customerUpdate.$set.reopenedById = session.user.id;
        customerUpdate.$set.reopenedAt = now;
      }
    }

    await Customer.findOneAndUpdate(
      { phone },
      customerUpdate
    );

    // Find lead to pass its ID to activity logger (if it exists)
    const lead = await Lead.findOne({ customerId: customerDoc._id }).lean();

    // Log the Chat Activity through centralized service
    await activityService.log({
      eventType: loggedEventType,
      entityType: "Chat",
      entityId: customerDoc._id,
      customerId: customerDoc._id,
      leadId: lead?._id || null,
      actorId: session.user.id,
      source: ActivitySources.WEB,
      metadata: {
        notes: isChatClosed ? "Chat marked as closed" : (chatAction === "Started" ? "Chat started" : "Chat reopened"),
        previousState: isChatClosed ? "OPEN" : "CLOSED",
        newState: isChatClosed ? "CLOSED" : "OPEN"
      }
    });

    // Call publisher to emit socket events
    emitChatStatusUpdated({
      phone,
      isChatClosed,
      isClosed: isChatClosed,
      chatType
    }, branchId);

    // Telemetry specific for chat reopen/close
    if (!isChatClosed) {
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
