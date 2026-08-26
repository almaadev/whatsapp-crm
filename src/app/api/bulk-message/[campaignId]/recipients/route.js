import { NextResponse } from "next/server.js";
import connectDB from "@/shared/lib/db/mongodb";
import CampaignRecipient from "@/shared/models/CampaignRecipient";
import BulkMessage from "@/shared/models/BulkMessage";
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

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "50", 10)));
    const statusFilter = (searchParams.get("status") || "ALL").toUpperCase();
    const search = (searchParams.get("search") || "").trim();

    const objId = new mongoose.Types.ObjectId(campaignId);

    // Compute status counts across all recipients in this campaign
    const grouped = await CampaignRecipient.aggregate([
      { $match: { campaignId: objId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const countsMap = {
      QUEUED: 0,
      ACCEPTED: 0,
      SENDING: 0,
      SENT: 0,
      DELIVERED: 0,
      READ: 0,
      FAILED: 0,
      UNDELIVERED: 0,
      SKIPPED: 0,
    };

    let totalRecipients = 0;
    for (const item of grouped) {
      if (countsMap[item._id] !== undefined) {
        countsMap[item._id] = item.count;
      }
      totalRecipients += item.count;
    }

    const successfulCount = countsMap.SENT + countsMap.DELIVERED + countsMap.READ;
    const failedCount = countsMap.FAILED + countsMap.UNDELIVERED;
    const processingCount = countsMap.QUEUED + countsMap.ACCEPTED + countsMap.SENDING;

    // Build query filter
    const query = { campaignId: objId };

    if (statusFilter === "SUCCESSFUL") {
      query.status = { $in: ["SENT", "DELIVERED", "READ"] };
    } else if (statusFilter === "FAILED") {
      query.status = { $in: ["FAILED", "UNDELIVERED"] };
    } else if (statusFilter === "PROCESSING") {
      query.status = { $in: ["QUEUED", "ACCEPTED", "SENDING"] };
    } else if (statusFilter === "SKIPPED") {
      query.status = "SKIPPED";
    } else if (statusFilter === "DELIVERED") {
      query.status = "DELIVERED";
    } else if (statusFilter === "READ") {
      query.status = "READ";
    } else if (statusFilter === "SENT") {
      query.status = "SENT";
    } else if (statusFilter !== "ALL" && countsMap[statusFilter] !== undefined) {
      query.status = statusFilter;
    }

    if (search) {
      query.$or = [
        { phone: { $regex: search, $options: "i" } },
        { normalizedPhone: { $regex: search, $options: "i" } },
        { twilioMessageSid: { $regex: search, $options: "i" } },
      ];
    }

    const totalFiltered = await CampaignRecipient.countDocuments(query);
    const recipients = await CampaignRecipient.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    return NextResponse.json({
      success: true,
      recipients,
      pagination: {
        page,
        limit,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / limit) || 1,
      },
      counts: {
        all: totalRecipients,
        successful: successfulCount,
        failed: failedCount,
        delivered: countsMap.DELIVERED,
        read: countsMap.READ,
        sent: countsMap.SENT,
        undelivered: countsMap.UNDELIVERED,
        processing: processingCount,
        skipped: countsMap.SKIPPED,
      },
    });
  } catch (error) {
    console.error("Fetch Recipients Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch recipients" },
      { status: 500 }
    );
  }
}
