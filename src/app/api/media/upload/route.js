import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import connectDB from "@/shared/lib/db/mongodb";
import Media from "@/shared/models/Media";
import cloudinaryService, {
  uploadMediaToCloudinary,
  getCloudinaryFolder,
  getCloudinaryResourceType,
  detectMediaType,
} from "@/server/services/cloudinaryService";

export const dynamic = "force-dynamic";

const ALLOWED_MIME_TYPES = {
  // Images (<= 3MB)
  "image/png": { type: "image", maxBytes: 3 * 1024 * 1024, exts: ["png"] },
  "image/jpeg": { type: "image", maxBytes: 3 * 1024 * 1024, exts: ["jpg", "jpeg"] },
  "image/jpg": { type: "image", maxBytes: 3 * 1024 * 1024, exts: ["jpg", "jpeg"] },
  "image/webp": { type: "image", maxBytes: 3 * 1024 * 1024, exts: ["webp"] },

  // Documents (<= 10MB)
  "application/pdf": { type: "document", maxBytes: 10 * 1024 * 1024, exts: ["pdf"] },

  // Videos (<= 10MB)
  "video/mp4": { type: "video", maxBytes: 10 * 1024 * 1024, exts: ["mp4"] },
  "video/quicktime": { type: "video", maxBytes: 10 * 1024 * 1024, exts: ["mov"] },
  "video/webm": { type: "video", maxBytes: 10 * 1024 * 1024, exts: ["webm"] },
  "video/3gpp": { type: "video", maxBytes: 10 * 1024 * 1024, exts: ["3gp"] },

  // Audio (<= 10MB)
  "audio/mpeg": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["mp3"] },
  "audio/mp3": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["mp3"] },
  "audio/wav": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["wav"] },
  "audio/x-wav": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["wav"] },
  "audio/m4a": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["m4a"] },
  "audio/x-m4a": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["m4a"] },
  "audio/mp4": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["m4a", "mp4"] },
  "audio/ogg": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["ogg"] },
  "audio/webm": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["webm"] },
  "audio/aac": { type: "audio", maxBytes: 10 * 1024 * 1024, exts: ["aac"] },
};

export async function POST(req) {
  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch (authErr) {}

    if (!session && process.env.NODE_ENV !== "test" && process.env.TWILIO_VALIDATE_SIGNATURE !== "false") {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let formData;
    try {
      formData = await req.formData();
    } catch (fdErr) {
      console.error("[POST /api/media/upload] FormData parse error:", fdErr.message);
      return NextResponse.json(
        { success: false, message: "Failed to parse body as FormData. Please ensure the request is multipart/form-data." },
        { status: 400 }
      );
    }

    const file = formData.get("file");
    const requestedType = formData.get("mediaType") || formData.get("type");
    const passedFileName = formData.get("originalFileName") || formData.get("originalFilename");
    const phone = formData.get("phone") || formData.get("to") || "";
    const customerId = formData.get("customerId") || null;
    const leadId = formData.get("leadId") || null;

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { success: false, message: "No valid file provided" },
        { status: 400 }
      );
    }

    const mimeType = (file.type || "").toLowerCase().trim();
    const rawFileName = passedFileName || file.name || "file";
    const sanitizedName = rawFileName.replace(/[^a-zA-Z0-9._-]/g, "_").trim() || "document.pdf";
    const ext = sanitizedName.split(".").pop()?.toLowerCase() || "";

    // 1. Validate MIME Type & Extension
    let typeConfig = ALLOWED_MIME_TYPES[mimeType];

    // Fallback detection by extension if browser passed generic binary MIME
    if (!typeConfig && ext) {
      for (const [mime, config] of Object.entries(ALLOWED_MIME_TYPES)) {
        if (config.exts.includes(ext)) {
          typeConfig = config;
          break;
        }
      }
    }

    if (!typeConfig) {
      return NextResponse.json(
        { success: false, message: "Unsupported file format. Please upload an image (PNG, JPG, WEBP), video (MP4), audio (MP3, WAV, M4A, OGG), or PDF document." },
        { status: 400 }
      );
    }

    const mediaType = detectMediaType(mimeType || typeConfig.exts[0], requestedType || typeConfig.type);
    const isPdfDoc = mediaType === "document" || mimeType === "application/pdf" || ext === "pdf";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileSize = buffer.length;

    // 2. Validate File Size limits
    if (fileSize > typeConfig.maxBytes) {
      const maxMb = Math.round(typeConfig.maxBytes / (1024 * 1024));
      return NextResponse.json(
        {
          success: false,
          message: `${mediaType === "image" ? "Image" : mediaType === "video" ? "Video" : "File"} exceeds the maximum allowed size of ${maxMb}MB.`,
        },
        { status: 400 }
      );
    }

    // 3. Upload to Cloudinary using reusable single function
    const uploadResult = await uploadMediaToCloudinary(buffer, {
      originalFilename: sanitizedName,
      mimeType: mimeType || (isPdfDoc ? "application/pdf" : typeConfig.exts[0]),
      mediaType,
      requestedType,
    });

    const secureUrl = uploadResult.secureUrl || uploadResult.url;
    const finalPublicId = uploadResult.publicId || uploadResult.cloudinaryPublicId;
    const finalResourceType = uploadResult.resourceType || (isPdfDoc ? "raw" : "image");
    const finalFolder = uploadResult.folder || getCloudinaryFolder(mediaType);

    if (isPdfDoc) {
      console.log(`[CLOUDINARY PDF UPLOAD]\noriginalFilename: ${sanitizedName}\nmimeType: application/pdf\nsize: ${fileSize}\nresourceType: raw\npublicId: ${finalPublicId}\nsecureUrl: ${secureUrl}`);
    } else {
      console.log(`[CLOUDINARY MEDIA UPLOAD]\noriginalFilename: ${sanitizedName}\nmediaType: ${mediaType}\nresourceType: ${finalResourceType}\nfolder: ${finalFolder}\nsecureUrl: ${secureUrl}`);
    }

    // 4. Create MongoDB Media Document with Rollback on Error
    const sixtyDaysFromNow = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    let mediaDoc = null;

    try {
      await connectDB();
      const mongoose = (await import("mongoose")).default;
      const rawUserId = session?.user?.id || session?.user?._id || null;
      const userId = (rawUserId && mongoose.Types.ObjectId.isValid(String(rawUserId))) ? String(rawUserId) : null;
      const validCustomerId = (customerId && mongoose.Types.ObjectId.isValid(String(customerId))) ? String(customerId) : null;
      const validLeadId = (leadId && mongoose.Types.ObjectId.isValid(String(leadId))) ? String(leadId) : null;

      mediaDoc = await Media.create({
        customerId: validCustomerId,
        leadId: validLeadId,
        phone: phone || "unknown",
        uploadedBy: userId,
        createdBy: userId,
        direction: "OUTBOUND",
        mediaType: isPdfDoc ? "document" : mediaType,
        fileType: isPdfDoc ? "document" : mediaType,
        mimeType: isPdfDoc ? "application/pdf" : (mimeType || "application/octet-stream"),
        extension: isPdfDoc ? ".pdf" : `.${ext}`,
        originalFilename: sanitizedName,
        originalFileName: sanitizedName,
        filename: sanitizedName,
        cloudinaryUrl: secureUrl,
        secureUrl: secureUrl,
        cloudinaryPublicId: finalPublicId,
        publicId: finalPublicId,
        cloudinaryResourceType: finalResourceType,
        resourceType: finalResourceType,
        folder: finalFolder,
        format: isPdfDoc ? "pdf" : (uploadResult.format || ext),
        size: fileSize,
        fileSize: fileSize,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        duration: uploadResult.duration || null,
        status: "ACTIVE",
        createdAt: new Date(),
        expiresAt: sixtyDaysFromNow,
      });

      console.log(`[MONGODB MEDIA CREATED] id: ${mediaDoc._id} publicId: ${mediaDoc.cloudinaryPublicId} folder: ${mediaDoc.folder}`);
    } catch (dbErr) {
      console.error("❌ [POST /api/media/upload] MongoDB Media creation failed, triggering rollback:", dbErr.message);

      // Rollback: Destroy uploaded Cloudinary asset so no orphaned files remain
      try {
        await cloudinaryService.deleteResource(finalPublicId, finalResourceType);
        console.log(`[ROLLBACK SUCCESS] Deleted orphaned Cloudinary asset ${finalPublicId}`);
      } catch (delErr) {
        console.error(`[ROLLBACK ERROR] Failed to delete orphaned Cloudinary asset ${finalPublicId}:`, delErr.message);
      }

      return NextResponse.json(
        { success: false, message: "Database persistence failed for media record: " + dbErr.message },
        { status: 500 }
      );
    }

    const responsePayload = {
      id: mediaDoc._id.toString(),
      _id: mediaDoc._id.toString(),
      originalFilename: mediaDoc.originalFilename,
      originalFileName: mediaDoc.originalFileName,
      filename: mediaDoc.filename,
      mimeType: mediaDoc.mimeType,
      size: mediaDoc.size,
      fileSize: mediaDoc.fileSize,
      mediaType: mediaDoc.mediaType,
      fileType: mediaDoc.fileType,
      cloudinaryPublicId: mediaDoc.cloudinaryPublicId,
      publicId: mediaDoc.publicId,
      cloudinaryResourceType: mediaDoc.cloudinaryResourceType,
      resourceType: mediaDoc.resourceType,
      cloudinaryUrl: mediaDoc.cloudinaryUrl,
      secureUrl: mediaDoc.secureUrl,
      url: mediaDoc.secureUrl,
      folder: mediaDoc.folder,
      format: mediaDoc.format,
      extension: mediaDoc.extension,
      width: mediaDoc.width,
      height: mediaDoc.height,
      duration: mediaDoc.duration,
      expiresAt: mediaDoc.expiresAt.toISOString(),
      createdAt: mediaDoc.createdAt.toISOString(),
    };

    return NextResponse.json({
      success: true,
      media: responsePayload,
      data: responsePayload, // Backward compatibility
    });
  } catch (error) {
    console.error("[POST /api/media/upload] Upload error:", error.message, error.stack);
    return NextResponse.json(
      { success: false, message: "Upload failed: " + error.message },
      { status: 500 }
    );
  }
}
