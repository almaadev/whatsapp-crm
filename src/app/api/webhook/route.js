import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Message from "@/models/Message";
import redis from "@/lib/redis";
import { determineConversationRoute, getModelByCategory } from "@/services/chatRoutingService";

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

function buildInboundMessages({ phone, messageText, twilioSid, profileName, body, numMedia }) {
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

  return [{
    ...base,
    message: messageText,
    twilioSid,
    mediaUrl: "",
    mediaType: "",
  }];
}

export async function POST(req) {
  try {
    console.log("\n💬 [WEBHOOK] Incoming WhatsApp Message...");
    await connectDB();

    const body = await parseTwilioBody(req);

    const twilioSid = body.MessageSid || body.SmsSid || body.sid || `in_${Date.now()}`;
    let phone = body.From || body.from || "";
    let messageText = (body.Body || body.body || "").replace(/\\n/g, "\n");
    let numMedia = parseInt(body.NumMedia || body.numMedia || "0", 10);
    if (isNaN(numMedia)) numMedia = 0;

    const profileName = body.ProfileName || body.profileName || phone || "Unknown";

    if (phone && !phone.startsWith("whatsapp:")) {
      phone = `whatsapp:${phone}`;
    }

    if (!phone || (!messageText && numMedia === 0)) {
      console.log("ℹ️ [WEBHOOK] Ignored — no phone or content.");
      return twilioResponse();
    }

    console.log(`📱 [WEBHOOK] Sender: ${phone} | Msg: "${messageText}" | Media: ${numMedia}`);

    let customer = await Customer.findOne({ phone });
    console.log(`👤 [WEBHOOK] Customer Found: ${!!customer}`);

    let targetCategory = "Direct Lead";
    try {
      targetCategory = await determineConversationRoute(
        phone,
        messageText,
        customer?.activeRouteCategory ?? null
      );
      console.log(`🚦 [WEBHOOK] Routing Decision: -> [${targetCategory}]`);
    } catch (routeError) {
      console.error("❌ [WEBHOOK] Routing failed, defaulting to Direct Lead:", routeError);
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
      if (customer.name === "Unknown" || customer.name === phone.replace("whatsapp:", "")) {
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
    console.log(`💾 [WEBHOOK] ${savedMessages.length} message(s) saved to ${targetCategory}.`);

    const indicationText = targetCategory !== "Direct Lead"
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

      const catLabel = targetCategory === "Product Lead"
        ? "Product Inquiry"
        : targetCategory === "MD Camp"
          ? "MD Camp"
          : targetCategory === "Therapy"
            ? "Therapy"
            : null;

      if (targetCategory === "Product Lead") global.io.emit("new_product_message", categoryEmit);
      else if (targetCategory === "MD Camp") global.io.emit("new_mdcamp_message", categoryEmit);
      else if (targetCategory === "Therapy") global.io.emit("new_therapy_message", categoryEmit);

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
