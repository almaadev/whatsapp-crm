import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Media from "@/shared/models/Media";
import Message from "@/shared/models/Message";
import cloudinaryService from "@/server/services/cloudinaryService";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const mediaDoc = await Media.findById(id).lean();
    if (!mediaDoc) {
      return NextResponse.json({ success: false, message: "Media not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: mediaDoc });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    await connectDB();

    const mediaDoc = await Media.findById(id);
    if (!mediaDoc) {
      return NextResponse.json({ success: false, message: "Media not found" }, { status: 404 });
    }

    if (mediaDoc.cloudinaryPublicId) {
      await cloudinaryService.deleteResource(mediaDoc.cloudinaryPublicId, mediaDoc.resourceType || "image").catch(() => {});
    }

    mediaDoc.status = "DELETED";
    await mediaDoc.save();

    if (mediaDoc.messageId) {
      await Message.findByIdAndUpdate(mediaDoc.messageId, {
        $set: { "media.status": "DELETED", "media.url": null },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, message: "Media deleted successfully" });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
