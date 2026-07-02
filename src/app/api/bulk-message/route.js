import { NextResponse } from "next/server";
import twilio from "twilio";

import connectDB from "@/lib/db/mongodb";
import Customer from "@/models/Customer";
import BulkMessage from "@/models/BulkMessage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);

// Existing formatWhatsAppNumber function...
const formatWhatsAppNumber = (rawNumber) => {
  let cleanNumber = rawNumber.replace(/[^\d+]/g, "");
  if (cleanNumber.startsWith("whatsapp:"))
    cleanNumber = cleanNumber.replace("whatsapp:", "");
  if (cleanNumber.length === 10) cleanNumber = `+91${cleanNumber}`;
  else if (cleanNumber.length === 12 && cleanNumber.startsWith("91"))
    cleanNumber = `+${cleanNumber}`;
  else if (cleanNumber.length === 11 && cleanNumber.startsWith("0"))
    cleanNumber = `+91${cleanNumber.substring(1)}`;
  else if (!cleanNumber.startsWith("+")) cleanNumber = `+${cleanNumber}`;
  return `whatsapp:${cleanNumber}`;
};

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    // 🚀 Accept campaignName and campaignId (for batching)
    const { campaignName, campaignId, numbers, templateId, contentVariables } =
      await req.json();

    if (!campaignName)
      return NextResponse.json(
        { error: "Campaign Name is required." },
        { status: 400 },
      );
    if (!numbers || !Array.isArray(numbers) || numbers.length === 0)
      return NextResponse.json(
        { error: "Invalid phone numbers." },
        { status: 400 },
      );
    if (!templateId)
      return NextResponse.json(
        { error: "Template ID is required." },
        { status: 400 },
      );

    const twilioPhoneNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER;
    const formattedFrom = twilioPhoneNumber.startsWith("whatsapp:")
      ? twilioPhoneNumber
      : `whatsapp:${twilioPhoneNumber}`;

    // 1. Clean & Format
    const validFormattedNumbers = [
      ...new Set(
        numbers
          .filter((n) => typeof n === "string" && n.trim() !== "")
          .map(formatWhatsAppNumber),
      ),
    ];

    // 2. Fetch existing to check Opt-Outs
    const existingCustomers = await Customer.find({
      phone: { $in: validFormattedNumbers },
    }).lean();
    const optedOutPhones = new Set(
      existingCustomers.filter((c) => c.isOptedOut).map((c) => c.phone),
    );

    // 3. Filter Opt-Outs
    const finalRecipients = validFormattedNumbers.filter(
      (phone) => !optedOutPhones.has(phone),
    );
    const skippedCount = validFormattedNumbers.length - finalRecipients.length;

    if (finalRecipients.length === 0) {
      return NextResponse.json(
        {
          success: true,
          successCount: 0,
          failedCount: 0,
          skippedCount,
          total: validFormattedNumbers.length,
          message: "All recipients opted out.",
        },
        { status: 200 },
      );
    }

    // 4. Upsert unknown customers
    const existingPhonesSet = new Set(existingCustomers.map((c) => c.phone));
    const missingNumbers = finalRecipients.filter(
      (phone) => !existingPhonesSet.has(phone),
    );

    if (missingNumbers.length > 0) {
      const newCustomers = missingNumbers.map((phone) => ({
        phone,
        name: "Unknown",
        source: "Bulk Campaign",
        status: "New",
        activeRouteCategory: "Direct Lead",
        lastInteractionAt: new Date(),
      }));
      await Customer.insertMany(newCustomers);
    }

    // 5. Create or Find BulkMessage Campaign Record
    let bulkRecord;
    if (campaignId) {
      bulkRecord = await BulkMessage.findById(campaignId);
      bulkRecord.recipients.push(...finalRecipients);
    } else {
      bulkRecord = await BulkMessage.create({
        campaignName,
        templateId,
        recipients: finalRecipients,
        status: "processing",
        sentBy: session?.user?.name || "System",
      });
    }

    let successCount = 0;
    let failedCount = 0;

    // 6. Send via Twilio
    for (const formattedTo of finalRecipients) {
      const messagePayload = {
        contentSid: templateId,
        from: formattedFrom,
        to: formattedTo,
      };
      if (contentVariables && Object.keys(contentVariables).length > 0)
        messagePayload.contentVariables = JSON.stringify(contentVariables);
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

    return NextResponse.json(
      {
        success: true,
        campaignId: bulkRecord._id,
        successCount,
        failedCount,
        skippedCount,
        total: validFormattedNumbers.length,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Bulk Send Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    await connectDB();
    const campaigns = await BulkMessage.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 },
    );
  }
}

export async function DELETE(req) {
  try {
    // 🔒 SECURITY: Verify the user is a superAdmin on the server side
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "superAdmin") {
      return NextResponse.json(
        { error: "Unauthorized. Super Admin access required to delete." },
        { status: 403 },
      );
    }

    await connectDB();

    // Extract the ID from the URL search params (e.g., ?id=...)
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 },
      );
    }

    // Delete the record from the database
    await BulkMessage.findByIdAndDelete(id);

    return NextResponse.json(
      { success: true, message: "Campaign deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Delete Campaign Error:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 },
    );
  }
}
