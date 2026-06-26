import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Message from "@/models/Message";
import redis from "@/lib/redis";
import twilio from "twilio";

import {
  determineConversationRoute,
  getModelByCategory,
} from "@/services/chatRoutingService";

export const dynamic = "force-dynamic";

const TWILIO_XML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

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

export async function POST(req) {
  try {
    console.log("\n💬 [WEBHOOK] Incoming WhatsApp Message...");
    await connectDB();

    const body = await parseTwilioBody(req);
    
    const twilioSid = body.sid;
    let phone = body.from || "";
    let messageText = body.body.replace(/\\n/g, "\n");
    let numMedia = parseInt(body.numMedia || "0", 10);
    if (isNaN(numMedia)) numMedia = 0;

    const profileName = phone || "Unknown";

    if (phone && !phone.startsWith("whatsapp:")) {
      phone = `whatsapp:${phone}`;
    }

    if (!phone || (!messageText && numMedia === 0)) {
      console.log("ℹ️ [WEBHOOK] Ignored — no phone or content.");
      return twilioResponse();
    }

    // 🚀 FETCH CUSTOMER EARLY TO CHECK OPT-OUT STATUS
    let customer = await Customer.findOne({ phone });
    console.log(`👤 [WEBHOOK] Customer Found: ${!!customer}`);

    // 🚀 EXACT MATCH LOGIC (Ignores sentences)
    const incomingTextUpper = messageText.trim().toUpperCase();
    const isStopCommand = incomingTextUpper === "STOP" || incomingTextUpper === "UNSUBSCRIBE";
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
        name: profileName,
        status: "New",
        activeRouteCategory: targetCategory,
        lastInteractionAt: new Date(),
        unreadCount: 1,
        source: "Whatsapp",
      });
    } else {
      customer.activeRouteCategory = targetCategory;
      customer.lastInteractionAt = new Date();
      customer.unreadCount = (customer.unreadCount || 0) + 1;
      if (
        customer.name === "Unknown" ||
        customer.name === phone.replace("whatsapp:", "")
      ) {
        customer.name = profileName;
      }
      await customer.save();
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
    }));

    const TargetModel = getModelByCategory(targetCategory);
    const savedMessages = await TargetModel.insertMany(inboundMessages);
    console.log(
      `💾 [WEBHOOK] ${savedMessages.length} message(s) saved to ${targetCategory}.`,
    );

    const indicationText =
      targetCategory !== "Direct Lead"
        ? `🔄 [ROUTED TO ${targetCategory.toUpperCase()}]\n\nCustomer said: ${messageText || "(media)"}`
        : messageText;

    if (targetCategory !== "Direct Lead") {
      const mirrorMessages = inboundMessages.map((msg, i) => ({
        ...msg,
        message: indicationText,
        twilioSid: `${msg.twilioSid}_mirror`,
      }));
      await Message.insertMany(mirrorMessages);
      console.log("💾 [WEBHOOK] Mirror saved to Global Inbox.");
    }

    if (global.io) {
      const lastSaved = savedMessages[savedMessages.length - 1];
      const categoryEmit = {
        phone,
        name: profileName,
        message: messageText || (numMedia > 0 ? "📷 Media" : ""),
        direction: "INBOUND",
        timestamp: lastSaved.timestamp || new Date(),
        chatType: targetCategory,
        mediaUrl: inboundMessages[0]?.mediaUrl || "",
        mediaType: inboundMessages[0]?.mediaType || "",
        isChatClosed: false,
        read: "FALSE",
      };

      const catLabel =
        targetCategory === "Product Lead"
          ? "Product Inquiry"
          : targetCategory === "MD Camp"
            ? "MD Camp"
            : targetCategory === "Therapy"
              ? "Therapy"
              : null;

      if (targetCategory === "Product Lead")
        global.io.emit("new_product_message", categoryEmit);
      else if (targetCategory === "MD Camp")
        global.io.emit("new_mdcamp_message", categoryEmit);
      else if (targetCategory === "Therapy")
        global.io.emit("new_therapy_message", categoryEmit);

      global.io.emit("new_message", {
        ...categoryEmit,
        message: indicationText || categoryEmit.message,
        categoryLabel: catLabel,
      });

      console.log("⚡ [WEBHOOK] Socket events emitted.");
    }

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
