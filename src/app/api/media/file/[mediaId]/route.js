import { NextResponse } from "next/server";
import axios from "axios";
import connectDB from "@/shared/lib/db/mongodb";
import Media from "@/shared/models/Media";
import Message from "@/shared/models/Message";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const { mediaId } = await params;
    if (!mediaId) {
      return new NextResponse("Media ID is required", { status: 400 });
    }

    await connectDB();

    let mediaDoc = await Media.findById(mediaId).lean();
    let originalFilename = mediaDoc?.originalFilename || mediaDoc?.originalFileName || mediaDoc?.filename || "document.pdf";
    let targetUrl = mediaDoc?.cloudinaryUrl || mediaDoc?.secureUrl;
    let mimeType = mediaDoc?.mimeType || "application/pdf";

    if (!targetUrl) {
      // Fallback: look in Message model by ID
      const msgDoc = await Message.findById(mediaId).lean();
      if (msgDoc && (msgDoc.mediaUrl || msgDoc.media?.url)) {
        targetUrl = msgDoc.media?.url || msgDoc.mediaUrl;
        originalFilename = msgDoc.media?.originalFilename || msgDoc.media?.originalFileName || msgDoc.media?.fileName || "document.pdf";
        mimeType = msgDoc.media?.mimeType || "application/pdf";
      }
    }

    if (!targetUrl) {
      return new NextResponse("Media document not found", { status: 404 });
    }

    // Fetch the asset from Cloudinary
    const response = await axios.get(targetUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
    });

    const buffer = Buffer.from(response.data);
    const cleanName = (originalFilename || "document.pdf").replace(/[/\\?%*:|"<>]/g, "_");

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType || "application/pdf",
        "Content-Disposition": `inline; filename="${cleanName}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
      },
    });
  } catch (error) {
    console.error("[GET /api/media/file/[mediaId]] Error:", error.message);
    return new NextResponse("Failed to retrieve media file", { status: 500 });
  }
}
