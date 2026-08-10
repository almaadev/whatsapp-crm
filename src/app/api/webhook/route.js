import { NextResponse } from "next/server";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import Message from "@/shared/models/Message";
import Lead from "@/shared/models/Lead";
import redis from "@/shared/lib/db/redis";
import twilio from "twilio";
import { processKeywordAutoReply } from "@/features/chat/services/keywordMatcher";
import { isValidDisplayName } from "@/shared/utils/customerResolver";
import { emitNewMessage, emitCategoryMessage, emitChatLockUpdated } from "@/shared/utils/socketPublisher";
import CustomerAddress from "@/shared/models/CustomerAddress";
import { activityService } from "@/server/services/activityService";
import { ActivityEvents, ActivitySources } from "@/shared/constants/activityConstants";
import { normalizePhone } from "@/shared/utils/phoneUtils";

import {
  determineConversationRoute,
  getModelByCategory,
} from "@/features/chat/services/chatRoutingService";

export const dynamic = "force-dynamic";

const TWILIO_XML =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

function twilioResponse(status = 200) {
  return new NextResponse(TWILIO_XML, {
    status,
    headers: { "Content-Type": "text/xml" },
  });
}

async function parseTwilioBody(req) {
  let body = {};
  const contentType = req.headers.get("content-type") || "";
  const rawText = await req.text();

  if (rawText) {
    if (contentType.includes("application/json")) {
      try {
        body = JSON.parse(rawText);
      } catch {
        body = Object.fromEntries(new URLSearchParams(rawText).entries());
      }
    } else {
      body = Object.fromEntries(new URLSearchParams(rawText).entries());
    }
  }

  if (Object.keys(body).length === 0) {
    const url = new URL(req.url);
    body = Object.fromEntries(url.searchParams.entries());
  }

  return body;
}

function buildInboundMessages({
  phone,
  messageText,
  twilioSid,
  profileName,
  body,
  numMedia,
}) {
  const base = {
    phone,
    direction: "INBOUND",
    status: "RECEIVED",
    read: "FALSE",
    isChatClosed: true,
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

export async function POST(req) {
  try {
    console.log("\n💬 [WEBHOOK] Incoming WhatsApp Message...");
    await connectDB();

    const body = await parseTwilioBody(req);

    const twilioSid = body.MessageSid || body.sid || "";

    // Extract & format recipient business number (To) and customer number (From)
    let rawTo = body.To || body.to || "";
    let receivedOnNumber = rawTo.replace("whatsapp:", "").trim();
    if (receivedOnNumber && !receivedOnNumber.startsWith("+")) receivedOnNumber = `+${receivedOnNumber}`;

    // Lookup TwilioNumber to get branch assignment
    let twilioNumberDoc = null;
    let branchId = null;
    let twilioNumberId = null;
    if (receivedOnNumber) {
      twilioNumberDoc = await import("@/shared/models/TwilioNumber").then(m => m.default.findOne({ phoneNumber: receivedOnNumber }).lean());
      if (twilioNumberDoc) {
        branchId = twilioNumberDoc.branchId || null;
        twilioNumberId = twilioNumberDoc._id || null;
      }
    }

    // Robust Phone Formatting (Strictly forces "whatsapp:+")
    const phone = normalizePhone(body.From || body.from || "");

    const rawMessage = body.Body || body.body || "";
    let messageText = rawMessage.replace(/\\n/g, "\n");

    let numMedia = parseInt(body.NumMedia || body.numMedia || "0", 10);
    if (isNaN(numMedia)) numMedia = 0;

    const profileName = body.ProfileName || body.profileName || phone || "Unknown";

    if (!phone || (!messageText && numMedia === 0)) {
      console.log("ℹ️ [WEBHOOK] Ignored — no phone or content.");
      return twilioResponse();
    }

    // 🚀 FETCH CUSTOMER EARLY TO CHECK OPT-OUT STATUS (With legacy fallback)
    let customer = await Customer.findOne({ phone });
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
      customer = await Customer.findOne({ phone: { $in: variations } });
    }
    console.log(`👤 [WEBHOOK] Customer Found: ${!!customer}`);

    // 🚀 EXACT MATCH LOGIC (Ignores sentences)
    const incomingTextUpper = messageText.trim().toUpperCase();
    const isStopCommand =
      incomingTextUpper === "STOP" || incomingTextUpper === "UNSUBSCRIBE";
    const isStartCommand = incomingTextUpper === "START";

    const STOP_MESSAGE =
      "You have successfully unsubscribed from our WhatsApp updates.\nYou will no longer receive promotional messages from us.\nIf you wish to receive updates again, simply reply *START*.\nThank you!";
    const START_MESSAGE =
      "Welcome back! \nYou have successfully subscribed to our WhatsApp updates.\nYou'll now receive our latest updates and promotional messages.\nThank you for staying connected with us!";

    let sid = "sys_msg_" + Date.now();
    const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
    const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status`
      : "https://nonarsenic-nonparous-clotilde.ngrok-free.dev/api/webhook/status";

    if (isStopCommand) {
      if (customer && customer.isOptedOut === true) {
        // Already Opted Out: Ignore twilio reply, let it pass to CRM
        console.log(
          `ℹ️ [WEBHOOK] ${phone} is already opted out. Passing "STOP" to CRM.`,
        );
      } else {
        // Perform Opt-Out
        await Customer.findOneAndUpdate(
          { phone },
          { isOptedOut: true },
          { upsert: true },
        );
        try {
          const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
          );
          const sent = await client.messages.create({
            body: STOP_MESSAGE,
            from: myTwilioNumber,
            to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
            statusCallback: callbackUrl,
          });
          sid = sent.sid;
        } catch (e) {
          console.error("Twilio Send Error:", e);
        }

        console.log(`🚫 [WEBHOOK] Opt-out registered for ${phone}`);
        return twilioResponse(); // Return so it DOES NOT go to CRM
      }
    } else if (isStartCommand) {
      // Check if already opted in (New customers are assumed false/opted-in by default)
      const alreadyOptedIn = customer ? customer.isOptedOut === false : true;

      if (alreadyOptedIn) {
        // Already Opted In: Ignore twilio reply, let it pass to CRM
        console.log(
          `ℹ️ [WEBHOOK] ${phone} is already opted in. Passing "START" to CRM.`,
        );
      } else {
        // Perform Opt-In
        await Customer.findOneAndUpdate(
          { phone },
          { isOptedOut: false },
          { upsert: true },
        );
        try {
          const client = twilio(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN,
          );
          const sent = await client.messages.create({
            body: START_MESSAGE,
            from: myTwilioNumber,
            to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
            statusCallback: callbackUrl,
          });
          sid = sent.sid;
        } catch (e) {
          console.error("Twilio Send Error:", e);
        }
        console.log(`✅ [WEBHOOK] Opt-in registered for ${phone}`);
        // NOTE: Does NOT return here, so "START" flows into the CRM as usual.
      }
    }

    console.log(
      `📱 [WEBHOOK] Sender: ${phone} | Msg: "${messageText}" | Media: ${numMedia}`,
    );

    // Continue with Routing Logic...
    let targetCategory = "Direct Lead";
    try {
      targetCategory = await determineConversationRoute(
        phone,
        messageText,
        customer?.activeRouteCategory ?? null,
      );
      console.log(`🚦 [WEBHOOK] Routing Decision: -> [${targetCategory}]`);
    } catch (routeError) {
      console.error(
        "❌ [WEBHOOK] Routing failed, defaulting to Direct Lead:",
        routeError,
      );
      targetCategory = "Direct Lead";
    }

    if (!customer) {
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
        validFrom: new Date()
      });

      customer.currentAddressId = newAddress._id;

      // Create Lead (WhatsApp Lead, Status = New)
      const lead = new Lead({
        customerId: customer._id,
        assignedTo: "unassigned",
        associateId: "",
        isClosed: false,
        leads: [{
          date: new Date(),
          enquiredFor: "",
          associateId: "",
          associateName: "unassigned",
          priority: "Medium",
          status: "New",
          leadType: "WhatsApp Lead",
          overAllRemarks: "Customer record created via inbound message"
        }]
      });
      await lead.save();

      customer.activeLeadId = lead._id;
      await customer.save();

      // Register activities: Customer Created, Lead Created, Message Received
      await activityService.log({
        eventType: ActivityEvents.CUSTOMER_CREATED,
        entityType: "Customer",
        entityId: customer._id,
        customerId: customer._id,
        source: ActivitySources.WEBHOOK,
        metadata: {
          notes: "Customer record created via inbound message"
        }
      });

      await activityService.log({
        eventType: ActivityEvents.LEAD_CREATED,
        entityType: "Lead",
        entityId: lead._id,
        customerId: customer._id,
        leadId: lead._id,
        source: ActivitySources.WEBHOOK,
        metadata: {
          notes: "WhatsApp Lead created"
        }
      });

      await activityService.log({
        eventType: ActivityEvents.MESSAGE_RECEIVED,
        entityType: "Message",
        customerId: customer._id,
        leadId: lead._id,
        source: ActivitySources.WEBHOOK,
        metadata: {
          notes: messageText || ""
        }
      });
    } else {
      // Reopen conversation automatically if it was closed
      if (customer.isClosed) {
        const hasPreviousChat = await Activity.exists({
          customerId: customer._id,
          eventType: { $in: [ActivityEvents.CHAT_STARTED, ActivityEvents.CHAT_CLOSED, ActivityEvents.CHAT_REOPENED] }
        });

        customer.isClosed = false;

        let lead = await Lead.findOne({ customerId: customer._id });
        if (lead) {
          lead.isClosed = false;
          // Transition Lead status by pushing follow-up history entry
          lead.leads.push({
            date: new Date(),
            enquiredFor: lead.leads && lead.leads.length > 0 ? lead.leads[lead.leads.length - 1].enquiredFor : "",
            associateId: lead.associateId || "",
            associateName: lead.assignedTo || "unassigned",
            priority: lead.leads && lead.leads.length > 0 ? lead.leads[lead.leads.length - 1].priority : "Medium",
            status: "Follow Up",
            leadType: lead.leads && lead.leads.length > 0 ? lead.leads[lead.leads.length - 1].leadType : "WhatsApp Lead",
            overAllRemarks: "Lead automatically updated via inbound WhatsApp reply"
          });
          await lead.save();
        }

        if (hasPreviousChat) {
          // Register Chat Reopened
          await activityService.log({
            eventType: ActivityEvents.CHAT_REOPENED,
            entityType: "Chat",
            entityId: lead?._id || customer._id,
            customerId: customer._id,
            leadId: lead?._id || null,
            source: ActivitySources.WEBHOOK,
            metadata: {
              notes: "Automatically reopened via inbound message"
            }
          });
        }
      }

      customer.activeRouteCategory = targetCategory;
      customer.lastInteractionAt = new Date();
      customer.unreadCount = (customer.unreadCount || 0) + 1;
      customer.lastIncomingNumber = receivedOnNumber;
      if (!isValidDisplayName(customer.name, phone) && isValidDisplayName(profileName, phone)) {
        customer.name = profileName;
      }
      await customer.save();

      // Find active lead to log Message Received
      const lead = await Lead.findOne({ customerId: customer._id });
      await activityService.log({
        eventType: ActivityEvents.MESSAGE_RECEIVED,
        entityType: "Message",
        customerId: customer._id,
        leadId: lead?._id,
        source: ActivitySources.WEBHOOK,
        metadata: {
          notes: messageText || ""
        }
      });
    }

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

    const TargetModel = getModelByCategory(targetCategory);
    const savedMessages = await TargetModel.insertMany(inboundMessages);
    console.log(
      `💾 [WEBHOOK] ${savedMessages.length} message(s) saved to ${targetCategory}.`,
    );

    const lastSaved = savedMessages[savedMessages.length - 1];
    console.log(`💾 [Webhook] Message Saved | SID: ${lastSaved?.twilioSid || twilioSid}`);

    const categoryEmit = {
      phone,
      name: profileName,
      message: messageText || (numMedia > 0 ? "📷 Media" : ""),
      direction: "INBOUND",
      timestamp: lastSaved?.timestamp || new Date(),
      twilioSid: lastSaved?.twilioSid || twilioSid,
      _id: lastSaved?._id ? lastSaved._id.toString() : undefined,
      chatType: targetCategory,
      mediaUrl: inboundMessages[0]?.mediaUrl || "",
      mediaType: inboundMessages[0]?.mediaType || "",
      isChatClosed: customer.isClosed,
      isClosed: customer.isClosed,
      read: "FALSE",
      receivedOnNumber,
      branchId,
      friendlyName: twilioNumberDoc?.friendlyName || "",
    };

    emitNewMessage(categoryEmit, branchId);
    console.log(`⚡ [Socket] Event Emitted | Event: new_message | Phone: ${phone}`);

    const { emitCustomerUpdated } = await import("@/shared/utils/socketPublisher");
    emitCustomerUpdated({
      phone,
      name: profileName,
      unreadCount: customer?.unreadCount || 1,
      lastInteractionAt: customer?.lastInteractionAt || new Date(),
      activeRouteCategory: targetCategory
    }, branchId);

    // Update lock if chat is being handled
    if (global.activeChatHandlers && global.activeChatHandlers.has(phone)) {
      const handler = global.activeChatHandlers.get(phone);
      handler.lockedUntil = Date.now() + 5 * 60 * 1000; // 5 minutes timeout
      emitChatLockUpdated({ phone, handler }, branchId);
      console.log(`🔒 [WEBHOOK] Lock timeout started for ${phone}`);
    }

    console.log("⚡ [WEBHOOK] Socket events emitted.");

    // 🚀 KEYWORD AUTO-REPLY MIDDLEWARE (Uses incoming business number)
    try {
      await processKeywordAutoReply(phone, messageText, profileName, receivedOnNumber);
    } catch (autoReplyErr) {
      console.error("❌ [WEBHOOK] Auto-reply failed silently to not impact webhook flow:", autoReplyErr);
    }
    // ----------------------------------------------

    if (redis && redis.status !== "disabled") {
      try {
        await redis.del("chats:all_data");
        await redis.del("chats:main_inbox_data");
      } catch {
        // non-fatal
      }
    }

    console.log("✅ [WEBHOOK] Processing Complete.\n");
    return twilioResponse();
  } catch (error) {
    console.error("❌ [WEBHOOK] FATAL ERROR:", error);
    return twilioResponse(500);
  }
}
