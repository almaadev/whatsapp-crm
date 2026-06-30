import twilio from "twilio";
import KeywordAutomation from "@/models/KeywordAutomation";
import connectDB from "@/lib/mongodb";

export async function processKeywordAutoReply(phone, messageText) {
  if (!messageText) return false;

  try {
    await connectDB();
    
    // Fetch only active keywords
    const activeKeywords = await KeywordAutomation.find({ isActive: true }).lean();
    if (!activeKeywords.length) return false;

    const lowerText = messageText.toLowerCase();

    // Find the first matching keyword (partial match)
    const matchedKeyword = activeKeywords.find((k) => lowerText.includes(k.key));

    if (matchedKeyword) {
      console.log(`🤖 [AUTO-REPLY] Match found for keyword: "${matchedKeyword.key}"`);

      const client = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
      
      const myTwilioNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;

      // Send the template using Twilio Content API
      await client.messages.create({
        contentSid: matchedKeyword.templateSid,
        contentVariables: "{}", // Required if template expects variables, empty JSON string defaults it
        from: myTwilioNumber,
        to: phone.startsWith("whatsapp:") ? phone : `whatsapp:${phone}`,
      });

      console.log(`✅ [AUTO-REPLY] Sent Template ${matchedKeyword.templateSid} to ${phone}`);
      return true; // Match found and replied
    }
  } catch (error) {
    console.error("❌ [AUTO-REPLY] Error processing keyword match:", error);
  }

  return false;
}