import { NextResponse } from "next/server.js";
import connectDB from "@/shared/lib/db/mongodb";
import Customer from "@/shared/models/Customer";
import BulkMessage from "@/shared/models/BulkMessage";
import CampaignRecipient from "@/shared/models/CampaignRecipient";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { getTemplateDetail, validateTemplatePayload } from "@/features/admin/services/twilioService";
import { normalizePhone } from "@/shared/utils/phoneUtils";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();

    const {
      campaignName,
      campaignId,
      numbers,
      templateId,
      contentVariables,
      senderNumber,
      sourceCampaignId = null,
      sourceCampaignName = null,
      recallType = null,
    } = await req.json();

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

    // Fast Pre-Validation: Fetch and validate template once before queuing
    const template = await getTemplateDetail(templateId);
    if (!template) {
      return NextResponse.json(
        { error: `Validation Failed: Template with SID ${templateId} not found.` },
        { status: 400 },
      );
    }
    const validation = validateTemplatePayload(template, contentVariables);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: `Validation Failed: ${validation.reason}` },
        { status: 400 },
      );
    }

    const { resolveSenderNumber, formatWhatsAppAddress } = await import("@/features/admin/services/twilioService");
    const resolvedSender = await resolveSenderNumber(session.user, senderNumber);
    const formattedFrom = formatWhatsAppAddress(resolvedSender);

    // 1. Clean & Normalize phone numbers
    const validFormattedNumbers = [
      ...new Set(
        numbers
          .map((n) => normalizePhone(n))
          .filter((n) => Boolean(n) && n.length > 5)
      ),
    ];

    if (validFormattedNumbers.length === 0) {
      return NextResponse.json(
        { error: "No valid phone numbers provided." },
        { status: 400 }
      );
    }

    // 2. Fetch existing customers to identify Opt-Outs
    const existingCustomers = await Customer.find({
      phone: { $in: validFormattedNumbers },
    }).lean();
    const optedOutPhones = new Set(
      existingCustomers.filter((c) => c.isOptedOut).map((c) => c.phone)
    );

    // 3. Separate eligible vs opted-out recipients
    const eligibleRecipients = validFormattedNumbers.filter(
      (phone) => !optedOutPhones.has(phone)
    );
    const optOutRecipients = validFormattedNumbers.filter(
      (phone) => optedOutPhones.has(phone)
    );
    const skippedCount = optOutRecipients.length;

    // 4. Upsert unknown customers for new numbers
    const existingPhonesSet = new Set(existingCustomers.map((c) => c.phone));
    const missingNumbers = eligibleRecipients.filter(
      (phone) => !existingPhonesSet.has(phone)
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
      await Customer.insertMany(newCustomers).catch(() => {});
    }

    // 5. Create or Find BulkMessage Record
    let bulkRecord;
    if (campaignId) {
      bulkRecord = await BulkMessage.findById(campaignId);
      bulkRecord.recipients.push(...validFormattedNumbers);
      if (resolvedSender) bulkRecord.senderNumber = resolvedSender;
      await bulkRecord.save();
    } else {
      bulkRecord = await BulkMessage.create({
        campaignName,
        templateId,
        recipients: validFormattedNumbers,
        status: eligibleRecipients.length === 0 ? "COMPLETED" : "processing",
        senderNumber: resolvedSender,
        sentBy: session?.user?.name || "System",
        sourceCampaignId: sourceCampaignId || null,
        sourceCampaignName: sourceCampaignName || null,
        recallType: recallType || null,
        totalRecipients: validFormattedNumbers.length,
        skippedCount,
      });
    }

    // 6. Create CampaignRecipient records for every recipient
    const recipientOperations = validFormattedNumbers.map((phone) => {
      const isOptedOut = optedOutPhones.has(phone);
      return {
        updateOne: {
          filter: { campaignId: bulkRecord._id, normalizedPhone: phone },
          update: {
            $setOnInsert: {
              campaignId: bulkRecord._id,
              phone,
              normalizedPhone: phone,
              status: isOptedOut ? "SKIPPED" : "QUEUED",
              errorMessage: isOptedOut ? "Customer opted out" : null,
            },
          },
          upsert: true,
        },
      };
    });

    if (recipientOperations.length > 0) {
      await CampaignRecipient.bulkWrite(recipientOperations);
    }

    // 7. Enqueue to BullMQ if eligible recipients exist
    if (eligibleRecipients.length > 0) {
      const { campaignQueue } = await import("@/server/queues/queueManager");
      const safeJobId = `campaign_${bulkRecord._id.toString()}_${Date.now()}`;

      await campaignQueue.add(
        "process-campaign",
        {
          campaignId: bulkRecord._id.toString(),
          campaignName,
          templateId,
          recipients: eligibleRecipients,
          validation,
          formattedFrom,
          resolvedSender,
          sentBy: session?.user?.name || "System",
          userId: session?.user?.id || null,
        },
        {
          jobId: safeJobId,
        }
      );
    } else {
      // All opted out
      const { syncCampaignCounts } = await import("@/server/services/campaignService");
      await syncCampaignCounts(bulkRecord._id);
    }

    return NextResponse.json(
      {
        success: true,
        queued: eligibleRecipients.length > 0,
        campaignId: bulkRecord._id,
        total: validFormattedNumbers.length,
        recipientCount: eligibleRecipients.length,
        eligibleCount: eligibleRecipients.length,
        skippedCount,
        message: eligibleRecipients.length > 0
          ? "Campaign queued for asynchronous delivery."
          : "All recipients were opted out.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Bulk Send Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await connectDB();
    const campaigns = await BulkMessage.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return NextResponse.json({ success: true, campaigns });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "superAdmin") {
      return NextResponse.json(
        { error: "Unauthorized. Super Admin access required to delete." },
        { status: 403 }
      );
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Campaign ID is required" },
        { status: 400 }
      );
    }

    await BulkMessage.findByIdAndDelete(id);
    await CampaignRecipient.deleteMany({ campaignId: id });

    return NextResponse.json(
      { success: true, message: "Campaign and recipients deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete Campaign Error:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
