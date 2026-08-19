import connectDB from "../../shared/lib/db/mongodb.js";
import Customer from "../../shared/models/Customer.js";
import CustomerAddress from "../../shared/models/CustomerAddress.js";
import Message from "../../shared/models/Message.js";
import Lead from "../../shared/models/Lead.js";
import TwilioNumber from "../../shared/models/TwilioNumber.js";
import redis from "../../shared/lib/db/redis.js";
import twilio from "twilio";
import { isValidDisplayName } from "../../shared/utils/customerResolver.js";
import { emitNewMessage, emitCustomerUpdated, emitChatLockUpdated } from "../../shared/utils/socketPublisher.js";
import { ActivityEvents, ActivitySources } from "../../shared/constants/activityConstants.js";
import { normalizePhone, getPhoneVariations } from "../../shared/utils/phoneUtils.js";
import { determineConversationRoute, getModelByCategory } from "../../features/chat/services/chatRoutingService.js";
import { automationQueue, notificationQueue, activityQueue } from "../queues/queueManager.js";

const STOP_MESSAGE =
  "You have successfully unsubscribed from our WhatsApp updates.\nYou will no longer receive promotional messages from us.\nIf you wish to receive updates again, simply reply *START*.\nThank you!";
const START_MESSAGE =
  "Welcome back! \nYou have successfully subscribed to our WhatsApp updates.\nYou'll now receive our latest updates and promotional messages.\nThank you for staying connected with us!";

function buildInboundMessages({
  phone,
  messageText,
  twilioSid,
  profileName,
  body = {},
  numMedia = 0,
}) {
  const base = {
    phone,
    direction: "INBOUND",
    status: "RECEIVED",
    read: "FALSE",
    isChatClosed: false,
    senderName: profileName,
    timestamp: new Date(),
  };

  if (numMedia > 0) {
    return Array.from({ length: numMedia }, (_, i) => ({
      ...base,
      message: messageText,
      twilioSid: numMedia > 1 ? `${twilioSid}_${i}` : twilioSid,
      mediaUrl: body[`MediaUrl${i}`] || "",
      mediaType: body[`MediaContentType${i}`] || "",
    }));
  }

  return [
    {
      ...base,
      message: messageText,
      twilioSid,
      mediaUrl: "",
      mediaType: "",
    },
  ];
}

export const inboundMessageService = {
  /**
   * Processes inbound message payload asynchronously inside the worker.
   */
  async handleInboundMessage(jobData) {
    await connectDB();

    const {
      twilioSid = "",
      fromPhone = "",
      rawTo = "",
      messageText = "",
      numMedia = 0,
      profileName: rawProfileName = "",
      body = {},
    } = jobData;

    // 1. Format business number (To) & customer phone (From)
    let receivedOnNumber = (rawTo || "").replace("whatsapp:", "").trim();
    if (receivedOnNumber && !receivedOnNumber.startsWith("+")) {
      receivedOnNumber = `+${receivedOnNumber}`;
    }

    // Lookup TwilioNumber to get branch assignment
    let twilioNumberDoc = null;
    let branchId = null;
    let twilioNumberId = null;
    if (receivedOnNumber) {
      twilioNumberDoc = await TwilioNumber.findOne({ phoneNumber: receivedOnNumber }).lean();
      if (twilioNumberDoc) {
        branchId = twilioNumberDoc.branchId || null;
        twilioNumberId = twilioNumberDoc._id || null;
      }
    }

    const phone = normalizePhone(fromPhone);
    if (!phone || (!messageText && numMedia === 0)) {
      return { ignored: true, reason: "No phone or content" };
    }

    const profileName = rawProfileName || phone || "Unknown";
    console.log(`[INBOUND-SERVICE] processing MessageSid=${twilioSid} | phone=${phone} | profile=${profileName}`);

    // 2. Fetch Customer early for opt-out / opt-in verification
    const phoneVariations = getPhoneVariations(phone);
    let customer = await Customer.findOne({ phone: { $in: phoneVariations } });

    // 3. Handle STOP / START opt-out commands
    const incomingTextUpper = (messageText || "").trim().toUpperCase();
    const isStopCommand = incomingTextUpper === "STOP" || incomingTextUpper === "UNSUBSCRIBE";
    const isStartCommand = incomingTextUpper === "START";

    const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
    const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status`
      : "https://nonarsenic-nonparous-clotilde.ngrok-free.dev/api/webhook/status";

    if (isStopCommand) {
      if (customer && customer.isOptedOut === true) {
        // Already opted out, pass to CRM
      } else {
        await Customer.findOneAndUpdate(
          { phone },
          { isOptedOut: true },
          { upsert: true }
        );
        try {
          const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
          await client.messages.create({
            body: STOP_MESSAGE,
            from: myTwilioNumber,
            to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
            statusCallback: callbackUrl,
          });
        } catch (e) {
          console.error("[InboundMessageService] Twilio STOP send error:", e.message);
        }
        return { optedOut: true, phone };
      }
    } else if (isStartCommand) {
      const alreadyOptedIn = customer ? customer.isOptedOut === false : true;
      if (!alreadyOptedIn) {
        await Customer.findOneAndUpdate(
          { phone },
          { isOptedOut: false },
          { upsert: true }
        );
        try {
          const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
          await client.messages.create({
            body: START_MESSAGE,
            from: myTwilioNumber,
            to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
            statusCallback: callbackUrl,
          });
        } catch (e) {
          console.error("[InboundMessageService] Twilio START send error:", e.message);
        }
      }
    }

    // 4. Determine Conversation Route
    let targetCategory = "Direct Lead";
    try {
      targetCategory = await determineConversationRoute(
        phone,
        messageText,
        customer?.activeRouteCategory ?? null
      );
    } catch {
      targetCategory = "Direct Lead";
    }

    const isNewCustomer = !customer;
    let resolvedLead = null;

    // 5. Resolve or Create Customer & Lead
    if (!customer) {
      try {
        customer = await Customer.create({
          phone,
          name: isValidDisplayName(profileName, phone) ? profileName : "Unknown",
          status: "New",
          activeRouteCategory: targetCategory,
          lastInteractionAt: new Date(),
          unreadCount: 1,
          source: "Whatsapp",
          lastIncomingNumber: receivedOnNumber,
          isClosed: false,
        });

        const newAddress = await CustomerAddress.create({
          customerId: customer._id,
          city: "",
          address: "",
          isCurrent: true,
          validFrom: new Date(),
        });

        customer.currentAddressId = newAddress._id;

        resolvedLead = new Lead({
          customerId: customer._id,
          assignedTo: "unassigned",
          associateId: "",
          isClosed: false,
          leads: [
            {
              date: new Date(),
              enquiredFor: "",
              associateId: "",
              associateName: "unassigned",
              priority: "Medium",
              status: "New",
              leadType: "WhatsApp Lead",
              overAllRemarks: "Customer record created via inbound message",
            },
          ],
        });
        await resolvedLead.save().catch(() => {});

        customer.activeLeadId = resolvedLead._id;
        await customer.save();
      } catch (custCreateErr) {
        if (custCreateErr.code === 11000 || custCreateErr.message?.includes("E11000")) {
          customer = await Customer.findOne({ phone: { $in: getPhoneVariations(phone) } });
          if (!customer) customer = await Customer.findOne({ phone });
        } else {
          throw custCreateErr;
        }
      }

      // Enqueue audit activities
      try {
        await activityQueue.add(
          "log-activity",
          {
            eventType: ActivityEvents.CUSTOMER_CREATED,
            entityType: "Customer",
            entityId: customer._id.toString(),
            customerId: customer._id.toString(),
            source: ActivitySources.WEBHOOK,
            metadata: { notes: "Customer record created via inbound message" },
          },
          { jobId: `act-cust-created_${customer._id.toString()}` }
        );

        await activityQueue.add(
          "log-activity",
          {
            eventType: ActivityEvents.LEAD_CREATED,
            entityType: "Lead",
            entityId: resolvedLead._id.toString(),
            customerId: customer._id.toString(),
            leadId: resolvedLead._id.toString(),
            source: ActivitySources.WEBHOOK,
            metadata: { notes: "WhatsApp Lead created" },
          },
          { jobId: `act-lead-created_${resolvedLead._id.toString()}` }
        );

        const safeSid = (twilioSid || String(Date.now())).replace(/[:]/g, "_");
        await activityQueue.add(
          "log-activity",
          {
            eventType: ActivityEvents.MESSAGE_RECEIVED,
            entityType: "Message",
            customerId: customer._id.toString(),
            leadId: resolvedLead._id.toString(),
            source: ActivitySources.WEBHOOK,
            metadata: { notes: messageText || "" },
          },
          { jobId: `act-msg-recv_${safeSid}` }
        );
      } catch (actErr) {
        console.error("[InboundMessageService] Error enqueuing activity jobs:", actErr.message);
      }
    } else {
      // Existing Customer
      try {
        resolvedLead = await Lead.findOne({ customerId: customer._id });
        if (!resolvedLead && customer.activeLeadId) {
          resolvedLead = await Lead.findById(customer.activeLeadId);
        }
      } catch (err) {
        console.error("[InboundMessageService] Lead lookup error:", err.message);
      }

      customer.activeRouteCategory = targetCategory;
      customer.lastInteractionAt = new Date();
      customer.unreadCount = (customer.unreadCount || 0) + 1;
      customer.lastIncomingNumber = receivedOnNumber;
      if (customer.isClosed) {
        customer.isClosed = false;
      }
      if (!isValidDisplayName(customer.name, phone) && isValidDisplayName(profileName, phone)) {
        customer.name = profileName;
      }
      await customer.save();

      try {
        const safeSid = (twilioSid || String(Date.now())).replace(/[:]/g, "_");
        await activityQueue.add(
          "log-activity",
          {
            eventType: ActivityEvents.MESSAGE_RECEIVED,
            entityType: "Message",
            customerId: customer._id.toString(),
            leadId: resolvedLead?._id ? resolvedLead._id.toString() : null,
            source: ActivitySources.WEBHOOK,
            metadata: { notes: messageText || "" },
          },
          { jobId: `act-msg-recv_${safeSid}` }
        );
      } catch (actErr) {
        console.error("[InboundMessageService] Error enqueuing activity job:", actErr.message);
      }
    }

    const resolvedLeadId = resolvedLead?._id
      ? resolvedLead._id.toString()
      : customer?.activeLeadId
      ? customer.activeLeadId.toString()
      : null;

    // 6. Build Inbound Message Document(s)
    const TargetModel = getModelByCategory(targetCategory);
    const inboundMessages = buildInboundMessages({
      phone,
      messageText,
      twilioSid,
      profileName,
      body,
      numMedia,
    }).map((msg) => ({
      ...msg,
      chatType: targetCategory,
      receivedOnNumber,
      senderNumber: receivedOnNumber,
      branchId,
      twilioNumberId,
    }));

    // 7. Message-Level Database Deduplication Check
    if (twilioSid && !twilioSid.startsWith("sys_msg_")) {
      const alreadySaved = await TargetModel.findOne({ twilioSid }).lean();
      if (alreadySaved) {
        return { duplicate: true, messageId: alreadySaved._id };
      }
    }

    let savedMessages;
    try {
      savedMessages = await TargetModel.insertMany(inboundMessages);
    } catch (insertErr) {
      if (
        insertErr.code === 11000 ||
        insertErr.message?.includes("E11000") ||
        insertErr.writeErrors?.some((e) => e.code === 11000)
      ) {
        const existing = await TargetModel.findOne({ twilioSid }).lean();
        return { duplicate: true, messageId: existing?._id };
      }
      throw insertErr;
    }
    const lastSaved = savedMessages[savedMessages.length - 1];

    console.log(`[INBOUND-SERVICE] customer resolved=${customer?._id}`);
    console.log(`[INBOUND-SERVICE] lead resolved=${resolvedLeadId}`);
    console.log(`[INBOUND-SERVICE] message persisted=${lastSaved?._id} | direction=${lastSaved?.direction} | twilioSid=${lastSaved?.twilioSid}`);

    const resolvedCustomerName =
      customer?.name && isValidDisplayName(customer.name, phone)
        ? customer.name
        : isValidDisplayName(profileName, phone)
        ? profileName
        : phone;

    // 8. Socket.IO Realtime Emission (strictly AFTER MongoDB write)
    const categoryEmit = {
      customerId: customer?._id ? customer._id.toString() : undefined,
      phone: customer?.phone || phone,
      canonicalPhone: phone,
      customerName: resolvedCustomerName,
      name: resolvedCustomerName,
      message: messageText || (numMedia > 0 ? "📷 Media" : ""),
      body: messageText || (numMedia > 0 ? "📷 Media" : ""),
      lastMessage: messageText || (numMedia > 0 ? "📷 Media" : ""),
      lastMessageAt: lastSaved?.timestamp || new Date(),
      direction: "INBOUND",
      isInbound: true,
      timestamp: lastSaved?.timestamp || new Date(),
      twilioSid: lastSaved?.twilioSid || twilioSid,
      _id: lastSaved?._id ? lastSaved._id.toString() : undefined,
      messageId: lastSaved?._id ? lastSaved._id.toString() : undefined,
      chatType: targetCategory,
      activeRouteCategory: customer?.activeRouteCategory || targetCategory,
      mediaUrl: inboundMessages[0]?.mediaUrl || "",
      mediaType: inboundMessages[0]?.mediaType || "",
      isChatClosed: customer?.isClosed || false,
      isClosed: customer?.isClosed || false,
      read: "FALSE",
      unreadCount: customer?.unreadCount || 1,
      receivedOnNumber,
      branchId: customer?.branchId ? customer.branchId.toString() : branchId ? branchId.toString() : null,
      friendlyName: twilioNumberDoc?.friendlyName || "",
      leadId: resolvedLeadId,
      city: customer?.city || "",
      status: customer?.status || "New",
      priority: customer?.priority || "Medium",
      associate: customer?.assignedTo || "",
    };

    try {
      emitNewMessage(categoryEmit, branchId);
      emitCustomerUpdated(
        {
          customerId: customer?._id ? customer._id.toString() : undefined,
          phone: customer?.phone || phone,
          canonicalPhone: phone,
          name: resolvedCustomerName,
          unreadCount: customer?.unreadCount || 1,
          lastInteractionAt: customer?.lastInteractionAt || new Date(),
          activeRouteCategory: targetCategory,
        },
        branchId
      );

      // Update active handler lock timeout if active
      if (global.activeChatHandlers && global.activeChatHandlers.has(phone)) {
        const handler = global.activeChatHandlers.get(phone);
        handler.lockedUntil = Date.now() + 5 * 60 * 1000;
        emitChatLockUpdated({ phone, handler }, branchId);
      }
    } catch (socketErr) {
      console.error("[InboundMessageService] Socket emission error:", socketErr.message);
    }

    // 9. Enqueue Downstream Jobs
    const safeJobSid = (lastSaved?.twilioSid || twilioSid || String(Date.now())).replace(/[:]/g, "_");

    // A. Notification Queue Job
    try {
      await notificationQueue.add(
        "process-notification",
        {
          phone,
          customerId: customer?._id ? customer._id.toString() : null,
          customerName: customer?.name || profileName,
          messageText: messageText || (numMedia > 0 ? "📷 Media" : ""),
          branchId: branchId ? branchId.toString() : null,
          twilioSid: lastSaved?.twilioSid || twilioSid,
          isNewChat: isNewCustomer,
        },
        { jobId: `notif_${safeJobSid}` }
      );
    } catch (notifQErr) {
      console.error("[InboundMessageService] Failed to enqueue notification job:", notifQErr.message);
    }

    // B. Automation Queue Job
    try {
      await automationQueue.add(
        "process-automation",
        {
          phone,
          messageText,
          profileName,
          receivedOnNumber,
          customerId: customer?._id ? customer._id.toString() : null,
          messageSid: lastSaved?.twilioSid || twilioSid,
        },
        { jobId: `auto_${safeJobSid}` }
      );
    } catch (autoQErr) {
      console.error("[InboundMessageService] Failed to enqueue automation job:", autoQErr.message);
    }

    // 10. Redis Cache Invalidation
    if (redis && redis.status !== "disabled") {
      try {
        await redis.del("chats:all_data");
        await redis.del("chats:main_inbox_data");
      } catch {
        // Non-fatal
      }
    }

    return {
      success: true,
      customerId: customer?._id,
      leadId: resolvedLeadId,
      messageId: lastSaved?._id,
    };
  },
};

export default inboundMessageService;
