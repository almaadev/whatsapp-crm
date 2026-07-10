import twilio from "twilio";
import { findAllCustomers, insertManyCustomers } from "../repositories/customerRepository";
import { getBulkMessages, createBulkMessage, findBulkMessageById, deleteBulkMessage } from "../repositories/bulkMessageRepository";
import { normalizePhone } from "../utils/phoneUtils";

export const bulkMessageService = {
  async sendBulkMessage(body, session) {
    const { campaignName, campaignId, numbers, templateId, contentVariables } = body;
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const twilioPhoneNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
    const formattedFrom = normalizePhone(twilioPhoneNumber);

    const validFormattedNumbers = [...new Set(numbers.filter((n) => typeof n === "string" && n.trim() !== "").map(normalizePhone))];
    const existingCustomers = await findAllCustomers({ phone: { $in: validFormattedNumbers } });
    const optedOutPhones = new Set(existingCustomers.filter((c) => c.isOptedOut).map((c) => c.phone));

    const finalRecipients = validFormattedNumbers.filter((phone) => !optedOutPhones.has(phone));
    const skippedCount = validFormattedNumbers.length - finalRecipients.length;

    if (finalRecipients.length === 0) {
      return { success: true, successCount: 0, failedCount: 0, skippedCount, total: validFormattedNumbers.length, message: "All recipients opted out." };
    }

    const existingPhonesSet = new Set(existingCustomers.map((c) => c.phone));
    const missingNumbers = finalRecipients.filter((phone) => !existingPhonesSet.has(phone));

    if (missingNumbers.length > 0) {
      const newCustomers = missingNumbers.map((phone) => ({
        phone, name: "Unknown", source: "Bulk Campaign", status: "New",
        activeRouteCategory: "Direct Lead", lastInteractionAt: new Date(),
      }));
      await insertManyCustomers(newCustomers);
    }

    let bulkRecord;
    if (campaignId) {
      bulkRecord = await findBulkMessageById(campaignId);
      bulkRecord.recipients.push(...finalRecipients);
    } else {
      bulkRecord = await createBulkMessage({
        campaignName, templateId, recipients: finalRecipients, status: "processing", sentBy: session?.user?.name || "System"
      });
    }

    let successCount = 0, failedCount = 0;

    for (const formattedTo of finalRecipients) {
      const messagePayload = { contentSid: templateId, from: formattedFrom, to: formattedTo };
      if (contentVariables && Object.keys(contentVariables).length > 0) messagePayload.contentVariables = JSON.stringify(contentVariables);
      try {
        await client.messages.create(messagePayload);
        successCount++;
      } catch (err) {
        console.error(`Twilio Error sending to ${formattedTo}:`, err.message);
        failedCount++;
      }
    }

    bulkRecord.successfulSends += successCount;
    bulkRecord.failedSends += failedCount;
    bulkRecord.status = "COMPLETED";
    await bulkRecord.save();

    return { success: true, campaignId: bulkRecord._id, successCount, failedCount, skippedCount, total: validFormattedNumbers.length };
  },

  async getCampaigns() {
    return await getBulkMessages({}, 50);
  },

  async deleteCampaign(id) {
    await deleteBulkMessage(id);
    return { success: true, message: "Campaign deleted successfully" };
  }
};
