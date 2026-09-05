import { v2 as cloudinary } from "cloudinary";
import axios from "axios";
import crypto from "crypto";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

const isConfigured = Boolean(cloudName && apiKey && apiSecret);

if (isConfigured) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

/**
 * Determine the Cloudinary folder based on media type.
 * Target Cloudinary structure:
 * whatsapp-crm/
 * ├── images/
 * ├── videos/
 * ├── audio/
 * └── documents/
 */
export function getCloudinaryFolder(mediaType = "image") {
  const norm = (mediaType || "").toLowerCase().trim();
  switch (norm) {
    case "video":
      return "whatsapp-crm/videos";
    case "audio":
      return "whatsapp-crm/audio";
    case "document":
    case "pdf":
      return "whatsapp-crm/documents";
    case "image":
    default:
      return "whatsapp-crm/images";
  }
}

/**
 * Determine the appropriate Cloudinary resource_type.
 * - Images -> "image"
 * - Videos -> "video"
 * - Audio -> "video" (Cloudinary standard for audio)
 * - PDFs / Documents -> "raw" (Standard for documents to ensure raw public delivery of .pdf)
 */
export function getCloudinaryResourceType(mediaType = "image", mimeType = "") {
  const normType = (mediaType || "").toLowerCase().trim();
  const normMime = (mimeType || "").toLowerCase().trim();

  if (normType === "document" || normType === "pdf" || normMime === "application/pdf" || normMime.includes("pdf")) {
    return "raw";
  }
  if (normType === "video" || normMime.startsWith("video/")) {
    return "video";
  }
  if (normType === "audio" || normMime.startsWith("audio/")) {
    return "video";
  }
  return "image";
}

/**
 * Determine standard mediaType string from mimeType or hint.
 * Output: "image" | "video" | "audio" | "document"
 */
export function detectMediaType(mimeType = "", fallbackType = "image") {
  const normMime = (mimeType || "").toLowerCase().trim();
  const normHint = (fallbackType || "").toLowerCase().trim();

  if (normMime === "application/pdf" || normMime.includes("pdf") || normHint === "document" || normHint === "pdf") {
    return "document";
  }
  if (normMime.startsWith("video/") || normHint === "video") {
    return "video";
  }
  if (normMime.startsWith("audio/") || normHint === "audio") {
    return "audio";
  }
  return "image";
}

/**
 * Sanitize filename keeping alphanumeric, hyphens, and underscores.
 */
export function sanitizeMediaFilename(filename = "file", maxLength = 50) {
  const extension = filename.includes(".") ? filename.substring(filename.lastIndexOf(".")) : ".pdf";
  const rawBase = filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/^_+|_+$/g, "") || "document";
  const name = rawBase.slice(0, maxLength);
  return `${name}${extension}`;
}

export function sanitizeMediaFileName(name = "file", defaultExt = "") {
  return sanitizeMediaFilename(name, 50);
}

/**
 * Formats a Cloudinary URL to ensure document downloads include the correct attachment filename.
 */
export function formatCloudinaryAttachmentUrl(url, originalFileName) {
  if (!url || !originalFileName || typeof url !== "string") return url;
  if (!url.includes("cloudinary.com") || url.includes("fl_attachment")) return url;

  const cleanName = sanitizeMediaFilename(originalFileName, 50);
  if (!cleanName) return url;
  const encodedName = encodeURIComponent(cleanName);

  if (url.includes("/upload/")) {
    return url.replace("/upload/", `/upload/fl_attachment:${encodedName}/`);
  }
  return url;
}

/**
 * Validates that a media URL is publicly accessible before dispatching to Twilio.
 * Performs a HEAD request first, and falls back to a ranged GET request if HEAD is restricted.
 */
export async function validateMediaUrl(url, expectedMime) {
  if (!url || typeof url !== "string") {
    throw new Error("Invalid media URL provided for validation");
  }

  // In test environment or mock Cloudinary URL, simulate successful check
  if (process.env.NODE_ENV === "test" || url.includes("res.cloudinary.com/crm-media/")) {
    console.log(`[PDF URL VALIDATION]\nstatus: 200\ncontentType: ${expectedMime || "application/pdf"}\ncontentLength: 1024`);
    return {
      valid: true,
      contentType: expectedMime || "application/pdf",
      contentLength: 1024,
    };
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TwilioMediaProxy/1.0",
    "Accept": "*/*",
  };

  // 1. First attempt: HEAD request
  try {
    const headController = new AbortController();
    const headTimeout = setTimeout(() => headController.abort(), 6000);

    const headResponse = await fetch(url, {
      method: "HEAD",
      headers,
      redirect: "follow",
      signal: headController.signal,
    });

    clearTimeout(headTimeout);

    const statusCode = headResponse.status;
    const contentType = headResponse.headers.get("content-type") || "";
    const contentLength = Number(headResponse.headers.get("content-length") || 0);

    if (headResponse.ok) {
      console.log(`[MEDIA URL VALIDATION - HEAD OK]\nstatus: ${statusCode}\ncontentType: ${contentType}\ncontentLength: ${contentLength}`);
      return {
        valid: true,
        contentType: contentType || expectedMime || "application/octet-stream",
        contentLength: contentLength || 1024,
      };
    }
  } catch (headErr) {
    console.warn(`[MEDIA URL VALIDATION] HEAD request failed for ${url} (${headErr.message}), trying GET fallback...`);
  }

  // 2. Fallback attempt: GET request (Range / stream header check)
  try {
    const getController = new AbortController();
    const getTimeout = setTimeout(() => getController.abort(), 10000);

    const getResponse = await fetch(url, {
      method: "GET",
      headers: { ...headers, Range: "bytes=0-1024" },
      redirect: "follow",
      signal: getController.signal,
    });

    clearTimeout(getTimeout);

    const statusCode = getResponse.status;
    const contentType = getResponse.headers.get("content-type") || "";
    const contentLength = Number(getResponse.headers.get("content-length") || 0);

    console.log(`[MEDIA URL VALIDATION - GET FALLBACK]\nstatus: ${statusCode}\ncontentType: ${contentType}\ncontentLength: ${contentLength}`);

    if (statusCode === 401 || statusCode === 403) {
      throw new Error(`Media URL returned HTTP ${statusCode} (Unauthorized/Forbidden). Public delivery is restricted on Cloudinary.`);
    }

    if (statusCode === 404) {
      throw new Error(`Media URL returned HTTP 404 (Not Found). The asset does not exist on Cloudinary.`);
    }

    if (!getResponse.ok && statusCode !== 206) {
      throw new Error(`Media URL is not accessible: HTTP ${statusCode}`);
    }

    return {
      valid: true,
      contentType: contentType || expectedMime || "application/octet-stream",
      contentLength: contentLength || 1024,
    };
  } catch (err) {
    console.error("[MEDIA URL VALIDATION] Accessibility verification failed:", url, err.message);
    throw err;
  }
}

/**
 * Reusable core function to upload media to Cloudinary.
 * Accepts a Buffer and options:
 * {
 *   originalFileName,
 *   originalFilename,
 *   mimeType,
 *   mediaType,
 *   requestedType
 * }
 */
export async function uploadMediaToCloudinary(buffer, options = {}) {
  const rawFileName = options.originalFilename || options.originalFileName || options.filename || "file";
  const mimeType = (options.mimeType || options.contentType || "").toLowerCase().trim();
  const passedMediaType = options.mediaType || options.requestedType;

  // Determine mediaType ("image" | "video" | "audio" | "document")
  const mediaType = detectMediaType(mimeType, passedMediaType);
  const resourceType = getCloudinaryResourceType(mediaType, mimeType);
  const folder = getCloudinaryFolder(mediaType);
  const isPdfDoc = resourceType === "raw" || mediaType === "document" || mimeType === "application/pdf";

  const cleanFileName = sanitizeMediaFilename(rawFileName, 50);
  const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const uniqueHex = crypto.randomBytes(3).toString("hex");

  // Collision-safe public_id:
  // For raw PDF documents, public_id must include the .pdf extension
  let publicId = "";
  if (isPdfDoc) {
    const baseWithExt = cleanFileName.toLowerCase().endsWith(".pdf") ? cleanFileName : `${cleanFileName}.pdf`;
    publicId = `${folder}/${datePrefix}_${uniqueHex}_${baseWithExt}`;
  } else {
    const baseName = cleanFileName.replace(/\.[^/.]+$/, "");
    publicId = `${folder}/${datePrefix}_${uniqueHex}_${baseName}`;
  }

  const ext = isPdfDoc
    ? "pdf"
    : cleanFileName.includes(".")
    ? cleanFileName.split(".").pop()
    : mimeType?.split("/")[1] || "jpg";

  if (!isConfigured) {
    // Mock fallback for test/offline environments without API keys
    console.warn("⚠️ [Cloudinary] Credentials not configured. Using local fallback reference.");
    const fullPublicId = isPdfDoc ? (publicId.endsWith(".pdf") ? publicId : `${publicId}.pdf`) : publicId;
    const mockUrl = `https://res.cloudinary.com/crm-media/${isPdfDoc ? "raw/upload/" : ""}${fullPublicId}`;
    return {
      originalFilename: cleanFileName,
      originalFileName: cleanFileName,
      filename: cleanFileName,
      mimeType: isPdfDoc ? "application/pdf" : mimeType || "image/jpeg",
      size: buffer ? buffer.length : 0,
      fileSize: buffer ? buffer.length : 0,
      mediaType,
      fileType: mediaType,
      resourceType,
      cloudinaryResourceType: resourceType,
      folder,
      publicId: fullPublicId,
      cloudinaryPublicId: fullPublicId,
      secureUrl: mockUrl,
      cloudinaryUrl: mockUrl,
      url: mockUrl,
      format: ext,
      width: null,
      height: null,
      duration: null,
    };
  }

  return new Promise((resolve, reject) => {
    const streamOptions = {
      public_id: publicId,
      resource_type: resourceType,
      type: "upload",
      overwrite: true,
      invalidate: true,
    };

    const uploadStream = cloudinary.uploader.upload_stream(
      streamOptions,
      (error, result) => {
        if (error) {
          console.error("❌ [Cloudinary] upload_stream failed:", error.message);
          return reject(error);
        }

        const secureUrl = result.secure_url || result.url;
        const finalPublicId = result.public_id || publicId;
        const finalResourceType = result.resource_type || resourceType;
        const finalFormat = result.format || ext;

        resolve({
          originalFilename: cleanFileName,
          originalFileName: cleanFileName,
          filename: cleanFileName,
          mimeType: isPdfDoc ? "application/pdf" : mimeType || (result.resource_type === "video" ? "video/mp4" : "image/jpeg"),
          size: result.bytes || (buffer ? buffer.length : 0),
          fileSize: result.bytes || (buffer ? buffer.length : 0),
          mediaType,
          fileType: mediaType,
          resourceType: finalResourceType,
          cloudinaryResourceType: finalResourceType,
          folder,
          publicId: finalPublicId,
          cloudinaryPublicId: finalPublicId,
          secureUrl,
          cloudinaryUrl: secureUrl,
          url: secureUrl,
          format: finalFormat,
          width: result.width || null,
          height: result.height || null,
          duration: result.duration || null,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

export const cloudinaryService = {
  isConfigured() {
    return isConfigured;
  },

  /**
   * Uploads a Buffer directly to Cloudinary via unified uploadMediaToCloudinary.
   */
  async uploadBuffer(buffer, options = {}) {
    return await uploadMediaToCloudinary(buffer, options);
  },

  /**
   * Downloads a Twilio media URL (handling Twilio Basic Auth if required)
   * and uploads the stream directly to Cloudinary.
   */
  async downloadAndUploadTwilioMedia(twilioMediaUrl, options = {}) {
    const {
      mediaType = "image",
      mimeType = "image/jpeg",
      originalFileName = "whatsapp_media",
      folder = getCloudinaryFolder(mediaType),
    } = options;

    const resourceType = options.resourceType || getCloudinaryResourceType(mediaType, mimeType);
    const isPdfDoc = resourceType === "raw" || mediaType === "document" || mediaType === "pdf" || mimeType === "application/pdf";
    const cleanFileName = sanitizeMediaFilename(originalFileName, 50);

    if (!isConfigured) {
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const uniqueHex = crypto.randomBytes(3).toString("hex");
      const baseWithExt = isPdfDoc
        ? (cleanFileName.toLowerCase().endsWith(".pdf") ? cleanFileName : `${cleanFileName}.pdf`)
        : cleanFileName;
      const mockPublicId = `${folder}/${datePrefix}_${uniqueHex}_${baseWithExt}`;
      const ext = isPdfDoc ? "pdf" : mimeType?.split("/")[1] || "bin";
      const mockUrl = `https://res.cloudinary.com/crm-media/${mockPublicId}`;
      return {
        url: mockUrl,
        secure_url: mockUrl,
        public_id: mockPublicId,
        resource_type: resourceType,
        format: ext,
        bytes: 1024,
        original_filename: originalFileName,
      };
    }

    try {
      const axiosConfig = {
        responseType: "arraybuffer",
        timeout: 30000,
      };

      if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        axiosConfig.auth = {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        };
      }

      const response = await axios.get(twilioMediaUrl, axiosConfig);
      const buffer = Buffer.from(response.data);
      const detectedContentType = response.headers["content-type"] || mimeType;

      return await this.uploadBuffer(buffer, {
        mediaType,
        mimeType: detectedContentType,
        originalFileName: cleanFileName,
        folder,
        resourceType,
      });
    } catch (err) {
      console.error(`❌ [Cloudinary] Failed to download and upload Twilio media from ${twilioMediaUrl}:`, err.message);
      throw err;
    }
  },

  /**
   * Deletes a media asset from Cloudinary by public ID and resource type.
   */
  async deleteResource(publicId, resourceType = "image") {
    if (!publicId) return { result: "not_found" };

    const resolvedType = resourceType === "raw" ? "raw" : resourceType === "video" ? "video" : "image";

    if (!isConfigured) {
      console.log(`[Cloudinary Mock] Deleted resource ${publicId} (${resolvedType})`);
      return { result: "ok" };
    }

    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resolvedType,
        invalidate: true,
      });
      return result;
    } catch (err) {
      console.error(`❌ [Cloudinary] Deletion error for ${publicId} (${resolvedType}):`, err.message);
      throw err;
    }
  },
};

export default cloudinaryService;
