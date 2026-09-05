import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Media from "@/shared/models/Media";
import Message from "@/shared/models/Message";
import cloudinaryService from "@/server/services/cloudinaryService";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { id, publicId, ids } = body;

    const mediaIds = Array.isArray(ids) ? ids : [id].filter(Boolean);

    await connectDB();

    const query = mediaIds.length > 0
      ? { _id: { $in: mediaIds } }
      : publicId
      ? { cloudinaryPublicId: publicId }
      : null;

    if (!query) {
      return NextResponse.json({ success: false, message: "No media IDs or public ID provided" }, { status: 400 });
    }

    const docs = await Media.find(query);

    for (const doc of docs) {
      if (doc.cloudinaryPublicId) {
        await cloudinaryService.deleteResource(doc.cloudinaryPublicId, doc.resourceType || "image").catch(() => {});
      }
      doc.status = "DELETED";
      await doc.save();

      // Clear from Message
      if (doc.messageId) {
        await Message.findByIdAndUpdate(doc.messageId, {
          $set: { "media.status": "DELETED", "media.url": null },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${docs.length} media file(s).`,
      deletedCount: docs.length,
    });
  } catch (error) {
    console.error("[POST /api/media/delete] Error:", error.message);
    return NextResponse.json({ success: false, message: "Deletion failed: " + error.message }, { status: 500 });
  }
}
