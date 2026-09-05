import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Media from "@/shared/models/Media";
import Message from "@/shared/models/Message";
import cloudinaryService from "@/server/services/cloudinaryService";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch (authErr) {}

    if (!session && process.env.NODE_ENV !== "test" && process.env.TWILIO_VALIDATE_SIGNATURE !== "false") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const type = searchParams.get("type") || "all";
    const direction = searchParams.get("direction") || "all";
    const expiration = searchParams.get("expiration") || "all";
    const sortBy = searchParams.get("sortBy") || "date"; // date, size, type, expires
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const filter = {};

    // 1. Search Query
    if (search.trim()) {
      const searchRegex = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { originalFileName: searchRegex },
        { phone: searchRegex },
        { senderPhone: searchRegex },
        { recipientPhone: searchRegex },
        { cloudinaryPublicId: searchRegex },
      ];
    }

    // 2. Type Filter
    if (type && type !== "all") {
      filter.mediaType = type.toLowerCase();
    }

    // 3. Direction Filter
    if (direction && direction !== "all") {
      filter.direction = direction.toUpperCase();
    }

    // 4. Date Range Filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    // 5. Expiration Filter
    const now = new Date();
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (expiration === "active") {
      filter.status = "ACTIVE";
      filter.expiresAt = { $gt: now };
    } else if (expiration === "expiringSoon") {
      filter.status = "ACTIVE";
      filter.expiresAt = { $gt: now, $lte: sevenDaysFromNow };
    } else if (expiration === "expired") {
      filter.$or = [{ status: "EXPIRED" }, { expiresAt: { $lte: now } }];
    } else {
      // Default: exclude explicitly DELETED status unless specified
      filter.status = { $ne: "DELETED" };
    }

    // Sort definition
    const sortFieldMap = {
      date: "createdAt",
      size: "fileSize",
      type: "mediaType",
      expires: "expiresAt",
    };
    const sort = { [sortFieldMap[sortBy] || "createdAt"]: sortOrder };

    const total = await Media.countDocuments(filter);
    const skip = (page - 1) * limit;

    const mediaList = await Media.find(filter)
      .populate({ path: "uploadedBy", select: "name email role" })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    // Summary Statistics calculation
    const [stats] = await Media.aggregate([
      {
        $match: { status: { $ne: "DELETED" } },
      },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalBytes: { $sum: "$fileSize" },
          imagesCount: {
            $sum: { $cond: [{ $eq: ["$mediaType", "image"] }, 1, 0] },
          },
          videosCount: {
            $sum: { $cond: [{ $eq: ["$mediaType", "video"] }, 1, 0] },
          },
          documentsCount: {
            $sum: { $cond: [{ $eq: ["$mediaType", "document"] }, 1, 0] },
          },
          audioCount: {
            $sum: { $cond: [{ $eq: ["$mediaType", "audio"] }, 1, 0] },
          },
          expiringSoonCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$expiresAt", now] },
                    { $lte: ["$expiresAt", sevenDaysFromNow] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]) || [];

    const summaryStats = {
      totalFiles: stats?.totalFiles || 0,
      totalBytes: stats?.totalBytes || 0,
      imagesCount: stats?.imagesCount || 0,
      videosCount: stats?.videosCount || 0,
      documentsCount: stats?.documentsCount || 0,
      audioCount: stats?.audioCount || 0,
      expiringSoonCount: stats?.expiringSoonCount || 0,
    };

    return NextResponse.json({
      success: true,
      data: mediaList,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
      stats: summaryStats,
    });
  } catch (error) {
    console.error("[GET /api/admin/media] Error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch (authErr) {}

    if (!session && process.env.NODE_ENV !== "test" && process.env.TWILIO_VALIDATE_SIGNATURE !== "false") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ success: false, message: "No media IDs provided" }, { status: 400 });
    }

    await connectDB();
    const docs = await Media.find({ _id: { $in: ids } });

    let deletedCount = 0;
    for (const doc of docs) {
      if (doc.cloudinaryPublicId) {
        await cloudinaryService.deleteResource(doc.cloudinaryPublicId, doc.resourceType || "image").catch(() => {});
      }
      doc.status = "DELETED";
      await doc.save();

      if (doc.messageId) {
        await Message.findByIdAndUpdate(doc.messageId, {
          $set: { "media.status": "DELETED", "media.url": null },
        }).catch(() => {});
      }
      deletedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deletedCount} media file(s).`,
      deletedCount,
    });
  } catch (error) {
    console.error("[DELETE /api/admin/media] Error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
