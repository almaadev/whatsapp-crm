import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Media from "@/shared/models/Media";

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
    const format = searchParams.get("format") || "json"; // "json" or "csv"

    const mediaDocs = await Media.find({ status: { $ne: "DELETED" } })
      .populate({ path: "uploadedBy", select: "name email" })
      .sort({ createdAt: -1 })
      .lean();

    const exportRows = mediaDocs.map((m) => {
      const rawName = m.originalFileName || m.fileName || "";
      const isInternalId = !rawName || rawName.startsWith("whatsapp-crm/") || rawName.startsWith("file_") || rawName === "file" || rawName === "whatsapp_media" || rawName.startsWith("inbound_");
      const cleanFileName = !isInternalId ? rawName : (m.mediaType === "document" ? "Document.pdf" : m.mediaType === "video" ? "Video.mp4" : m.mediaType === "audio" ? "Audio.mp3" : "Photo.jpg");

      return {
        messageId: m.messageId ? m.messageId.toString() : "",
        fileName: cleanFileName,
        mediaType: m.mediaType || "image",
        mimeType: m.mimeType || "",
        fileSize: m.fileSize || 0,
        fileSizeFormatted: `${(m.fileSize / (1024 * 1024)).toFixed(2)} MB`,
        cloudinaryUrl: m.cloudinaryUrl || "",
        publicId: m.cloudinaryPublicId || "",
        direction: m.direction || "OUTBOUND",
        sender: m.senderPhone || (m.uploadedBy?.name ? `${m.uploadedBy.name} (${m.uploadedBy.email})` : "Customer"),
        recipient: m.recipientPhone || m.phone || "",
        status: m.status || "ACTIVE",
        uploadedDate: m.createdAt ? new Date(m.createdAt).toISOString() : "",
        expirationDate: m.expiresAt ? new Date(m.expiresAt).toISOString() : "",
      };
    });

    if (format === "csv") {
      const headers = [
        "File Name",
        "File Type",
        "MIME Type",
        "Size (MB)",
        "Cloudinary URL",
        "Public ID",
        "Direction",
        "Sender",
        "Recipient",
        "Status",
        "Message ID",
        "Uploaded Date",
        "Expiration Date",
      ];

      const csvRows = [headers.join(",")];

      exportRows.forEach((row) => {
        const values = [
          `"${(row.fileName || "").replace(/"/g, '""')}"`,
          `"${row.mediaType}"`,
          `"${row.mimeType}"`,
          `"${(row.fileSize / (1024 * 1024)).toFixed(2)}"`,
          `"${row.cloudinaryUrl}"`,
          `"${row.publicId}"`,
          `"${row.direction}"`,
          `"${(row.sender || "").replace(/"/g, '""')}"`,
          `"${(row.recipient || "").replace(/"/g, '""')}"`,
          `"${row.status}"`,
          `"${row.messageId}"`,
          `"${row.uploadedDate}"`,
          `"${row.expirationDate}"`,
        ];
        csvRows.push(values.join(","));
      });

      const csvContent = csvRows.join("\n");
      return new NextResponse(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="whatsapp_media_backup_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      total: exportRows.length,
      exportedAt: new Date().toISOString(),
      data: exportRows,
    });
  } catch (error) {
    console.error("[GET /api/admin/media/backup] Error:", error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
