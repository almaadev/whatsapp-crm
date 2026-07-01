import twilio from "twilio";
import KeywordAutomation from "@/models/KeywordAutomation";
import Template from "@/models/Template";
import Customer from "@/models/Customer";
import Message from "@/models/Message";
import connectDB from "@/lib/mongodb";
import { getModelByCategory, determineConversationRoute } from "@/services/chatRoutingService";

export async function processKeywordAutoReply(phone, messageText) {
  if (!messageText) return false;

  try {
    await connectDB();
    
    // Fetch only active keywords
    const activeKeywords = await KeywordAutomation.find({ isActive: true }).lean();
    if (!activeKeywords.length) return false;

    const cleanText = messageText.toLowerCase().trim();

    // Find the first matching keyword (partial match)
    const matchedKeyword = activeKeywords.find((k) => k.key === cleanText);

    if (matchedKeyword) {
      console.log(`🤖 [AUTO-REPLY] Match found for keyword: "${matchedKeyword.key}"`);

      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
      const callbackUrl = process.env.NEXT_PUBLIC_BASE_URL
        ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhook/status`
        : "https://nonarsenic-nonparous-clotilde.ngrok-free.dev/api/webhook/status"; // Keep consistent with your main webhook

      
// 1. Send the template using Twilio Content API
      const sentMessage = await client.messages.create({
        contentSid: matchedKeyword.templateSid,
        contentVariables: "{}", 
        from: myTwilioNumber,
        to: phone, 
        statusCallback: callbackUrl 
      });

      console.log(`✅ [AUTO-REPLY] Sent Template ${matchedKeyword.templateSid} to ${phone}`);

      // 2. Fetch the Template to get the actual text for the UI
      const template = await Template.findOne({ sid: matchedKeyword.templateSid }).lean();
      const messageBody = template ? template.body : `Automated Template: ${matchedKeyword.templateSid}`;

      // 3. Determine the customer's chat routing category
      // 🚀 FIX: Stop stripping "whatsapp:". Pass `phone` exactly to match the existing chat!
      let customer = await Customer.findOne({ phone: phone });
      let targetCategory = customer?.activeRouteCategory || "Direct Lead";
      if (!customer) {
        targetCategory = await determineConversationRoute(phone, messageText, null);
      }

      // 4. Build the message payload to save
      const msgPayload = {
        phone: phone, // 
        message: messageBody,
        direction: "OUTBOUND",
        status: sentMessage.status || "queued",
        twilioSid: sentMessage.sid, 
        senderName: "System Automation",
        isAutomated: true,
        templateSid: matchedKeyword.templateSid,
        source: "Keyword Automation",
        chatType: targetCategory,
        timestamp: new Date(),
        read: "TRUE",
        isChatClosed: false,
        mediaUrl: "",
        mediaType: ""
      };

      // 5. Save exactly like a normal agent message
      const TargetModel = getModelByCategory(targetCategory);
      const savedMsg = await TargetModel.create(msgPayload);
      
      // Mirror to Global Inbox if necessary
      if (targetCategory !== "Direct Lead") {
        await Message.create({ ...msgPayload, twilioSid: `${sentMessage.sid}_mirror` });
      }

      // 6. Emit Socket Event to update UI in real-time
      if (global.io) {
        const socketEmitObj = {
          ...msgPayload,
          _id: savedMsg._id,
        };

        if (targetCategory === "Product Lead") global.io.emit("new_product_message", socketEmitObj);
        else if (targetCategory === "MD Camp") global.io.emit("new_mdcamp_message", socketEmitObj);
        else if (targetCategory === "Therapy") global.io.emit("new_therapy_message", socketEmitObj);

        global.io.emit("new_message", { 
          ...socketEmitObj,
          categoryLabel: targetCategory
        });
      }

      return true; // Match found and replied
    }
  } catch (error) {
    console.error("❌ [AUTO-REPLY] Error processing keyword match:", error);
  }

  return false;
}