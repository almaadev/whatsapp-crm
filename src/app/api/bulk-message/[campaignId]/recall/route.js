import { NextResponse } from "next/server.js";
import connectDB from "@/shared/lib/db/mongodb";
import BulkMessage from "@/shared/models/BulkMessage";
import CampaignRecipient from "@/shared/models/CampaignRecipient";
import mongoose from "mongoose";

export async function GET(req, context) {
  try {
    await connectDB();

    const { params } = context;
    const { campaignId } = await params;

    if (!campaignId || !mongoose.Types.ObjectId.isValid(campaignId)) {
      return NextResponse.json(
        { error: "Valid Campaign ID is required" },
        { status: 400 }
      );
    }

    const campaign = await BulkMessage.findById(campaignId).lean();
    if (!campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    const objId = new mongoose.Types.ObjectId(campaignId);

    // Fetch successful recipients: SENT, DELIVERED, READ
    const successfulRecipients = await CampaignRecipient.find({
      campaignId: objId,
      status: { $in: ["SENT", "DELIVERED", "READ"] },
    })
      .select("phone normalizedPhone status")
      .lean();

    const failedRecipients = await CampaignRecipient.countDocuments({
      campaignId: objId,
      status: { $in: ["FAILED", "UNDELIVERED"] },
    });

    const skippedRecipients = await CampaignRecipient.countDocuments({
      campaignId: objId,
      status: "SKIPPED",
    });

    const successfulNumbers = [
      ...new Set(
        successfulRecipients.map((r) =>
          r.normalizedPhone.replace("whatsapp:", "").replace("+91", "").trim()
        )
      ),
    ];

    return NextResponse.json({
      success: true,
      sourceCampaignId: campaign._id,
      sourceCampaignName: campaign.campaignName,
      templateId: campaign.templateId,
      senderNumber: campaign.senderNumber,
      successfulNumbers,
      counts: {
        successful: successfulNumbers.length,
        failed: failedRecipients,
        skipped: skippedRecipients,
        total: campaign.totalRecipients || (successfulNumbers.length + failedRecipients + skippedRecipients),
      },
    });
  } catch (error) {
    console.error("Recall Campaign Error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve recall recipients" },
      { status: 500 }
    );
  }
}
