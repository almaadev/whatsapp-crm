import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Customer from "@/models/Customer";
import Message from "@/models/Message";
import ProductMessage from "@/models/ProductMessage";
import MDCampMessage from "@/models/MDCampMessage";
import TherapyMessage from "@/models/TherapyMessage";
import Lead from "@/models/Lead";
import redis from "@/lib/redis";

export async function POST(req) {
  try {
    await connectDB();

    let body = {};
    const contentType = req.headers.get("content-type") || "";
    const rawText = await req.text();

    if (rawText) {
      if (contentType.includes("application/json")) {
        try { body = JSON.parse(rawText); } catch (e) { }
      } else {
        body = Object.fromEntries(new URLSearchParams(rawText).entries());
      }
    }

    if (Object.keys(body).length === 0) {
      const url = new URL(req.url);
      body = Object.fromEntries(url.searchParams.entries());
    }

    const twilioSID = body.MessageSid || body.SmsSid || body.sid || body.Sid || "";
    const messageStatus = body.MessageStatus || body.SmsStatus || body.status || "";

    if (messageStatus && ['sent', 'delivered', 'read', 'failed'].includes(messageStatus.toLowerCase())) {
      const formattedStatus = messageStatus.toUpperCase();
      if (global.io) global.io.emit("message_status_update", { sid: twilioSID, status: formattedStatus });

      await Promise.all([
        Message.findOneAndUpdate({ twilioSid: twilioSID }, { status: formattedStatus }),
        ProductMessage.findOneAndUpdate({ twilioSid: twilioSID }, { status: formattedStatus }),
        MDCampMessage.findOneAndUpdate({ twilioSid: twilioSID }, { status: formattedStatus }),
        TherapyMessage.findOneAndUpdate({ twilioSid: twilioSID }, { status: formattedStatus })
      ]);
      return NextResponse.json({ success: true });
    }

    let phone = body.From || body.from || "";
    let messageText = body.Body || body.body || "";
    let numMedia = parseInt(body.NumMedia || body.numMedia || "0");
    if (isNaN(numMedia)) numMedia = 0;
    const profileName = body.ProfileName || body.profileName || phone;

    if (phone && !phone.startsWith("whatsapp:")) phone = `whatsapp:${phone}`;

    if (!phone || (!messageText && numMedia === 0)) return NextResponse.json({ success: true, ignored: true });

    messageText = messageText.replace(/\\n/g, "\n");

    const productKw = ["support", "product", "inquiry", "buy", "order", "price", "details", "medicine", "almaa product", "cost", "purchase"];
    const mdCampKw = ["camp", "medical camp", "free checkup", "doctor camp", "md camp", "mdcamp"];
    const therapyKw = ["therapy", "massage", "pain relief", "treatment", "varma", "siddha", "clinic"];

    let targetType = "Direct Lead";
    let matchedKw = "";
    const lowerMsg = messageText.toLowerCase();

    const isProduct = productKw.some(kw => lowerMsg.includes(kw));
    const isMdCamp = mdCampKw.some(kw => lowerMsg.includes(kw));
    const isTherapy = therapyKw.some(kw => lowerMsg.includes(kw));

    const existingLead = await Lead.findOne({ phone });

    // 👇 Strict Keyword Routing logic
    if (isProduct) { 
        targetType = "Product Lead"; 
        matchedKw = productKw.find(k => lowerMsg.includes(k)); 
    }
    else if (isMdCamp) { 
        targetType = "MD Camp"; 
        matchedKw = mdCampKw.find(k => lowerMsg.includes(k)); 
    }
    else if (isTherapy) { 
        targetType = "Therapy"; 
        matchedKw = therapyKw.find(k => lowerMsg.includes(k)); 
    }
    else if (existingLead && existingLead.leadType) {
        targetType = existingLead.leadType;
    }

    const finalKeyword = matchedKw || existingLead?.lastKeyword || "existing";

    await Lead.findOneAndUpdate(
      { phone },
      {
        $setOnInsert: { name: profileName, status: "New", assignedTo: "unassigned", associate: "unassigned" },
        $set: { leadType: targetType, lastKeyword: finalKeyword },
        $inc: { unreadCount: 1 }
      },
      { upsert: true, new: true }
    );

    // 👇 Correctly assign message to specific targeted collection
    const MsgModel = targetType === "Product Lead" ? ProductMessage :
                     targetType === "MD Camp" ? MDCampMessage :
                     targetType === "Therapy" ? TherapyMessage : Message;

    const newMessages = [];
    if (numMedia > 0) {
      for (let i = 0; i < numMedia; i++) {
        newMessages.push({ phone, message: messageText, direction: "INBOUND", status: "RECEIVED", read: "FALSE", twilioSid: twilioSID, mediaUrl: body[`MediaUrl${i}`], mediaType: body[`MediaContentType${i}`], senderName: profileName });
      }
    } else {
      newMessages.push({ phone, message: messageText, direction: "INBOUND", status: "RECEIVED", read: "FALSE", twilioSid: twilioSID, senderName: profileName });
    }
    if (newMessages.length > 0) await MsgModel.insertMany(newMessages);

    await Customer.findOneAndUpdate({ phone }, { $setOnInsert: { name: profileName } }, { upsert: true });

    if (global.io) {
      const hasProdMsgs = await ProductMessage.exists({ phone });
      const hasMdMsgs = await MDCampMessage.exists({ phone });
      const hasTherMsgs = await TherapyMessage.exists({ phone });

      if (hasProdMsgs || targetType === "Product Lead") global.io.emit("new_product_message", { phone, message: messageText });
      if (hasMdMsgs || targetType === "MD Camp") global.io.emit("new_mdcamp_message", { phone, message: messageText });
      if (hasTherMsgs || targetType === "Therapy") global.io.emit("new_therapy_message", { phone, message: messageText });

      let indicationText = messageText;
      let catLabel = null;

      if (targetType === "Product Lead") {
        indicationText = `[PRODUCT INFO]: User inquired about "${finalKeyword}". Please check the respective page.`;
        catLabel = "Product Inquiry";
      } else if (targetType === "MD Camp") {
        indicationText = `[MD CAMP INFO]: User inquired about "${finalKeyword}". Please check the respective page.`;
        catLabel = "MD Camp";
      } else if (targetType === "Therapy") {
        indicationText = `[THERAPY INFO]: User inquired about "${finalKeyword}". Please check the respective page.`;
        catLabel = "Therapy";
      }

      global.io.emit("new_message", {
        phone,
        message: indicationText,
        direction: "INBOUND",
        categoryLabel: catLabel,
        timestamp: new Date().toISOString()
      });
    }

    if (redis && redis.status !== 'disabled') { try { await redis.del("chats:all_data"); } catch (e) { } }
    return NextResponse.json({ success: true, routedTo: targetType });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}