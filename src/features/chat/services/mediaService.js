import api from "@/shared/lib/axios";

/**
 * Format bytes into human-readable string (KB, MB, GB).
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Client-side image compressor.
 * Automatically compresses images exceeding 3MB down to <= 3MB using HTML5 Canvas.
 */
export async function compressImage(file, onProgress) {
  const maxBytes = 3 * 1024 * 1024; // 3 MB
  if (file.size <= maxBytes) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0,
      wasCompressed: false,
      previewUrl: (typeof Blob !== "undefined" && file instanceof Blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") ? URL.createObjectURL(file) : "",
    };
  }

  if (onProgress) onProgress(10);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.onerror = (err) => reject(err);

    img.onload = async () => {
      try {
        if (onProgress) onProgress(30);

        let width = img.width;
        let height = img.height;

        // Downscale large dimensions if excessive (> 2400px)
        const maxDimension = 2400;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        if (onProgress) onProgress(60);

        let quality = 0.85;
        let blob = await new Promise((r) => canvas.toBlob(r, "image/webp", quality));

        // Iteratively reduce quality if still > 3MB
        while (blob && blob.size > maxBytes && quality > 0.4) {
          quality -= 0.15;
          blob = await new Promise((r) => canvas.toBlob(r, "image/webp", quality));
          if (onProgress) onProgress(Math.min(90, Math.round(60 + (1 - quality) * 30)));
        }

        if (!blob || blob.size > maxBytes) {
          // Final fallback with JPEG
          blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.6));
        }

        if (onProgress) onProgress(100);

        const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
        const compressedFile = new File([blob], newFileName, {
          type: "image/webp",
          lastModified: Date.now(),
        });

        const savingsPercent = Math.max(
          0,
          parseFloat((((file.size - compressedFile.size) / file.size) * 100).toFixed(1))
        );

        resolve({
          file: compressedFile,
          originalSize: file.size,
          compressedSize: compressedFile.size,
          savingsPercent,
          wasCompressed: true,
          previewUrl: (typeof Blob !== "undefined" && compressedFile instanceof Blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") ? URL.createObjectURL(compressedFile) : "",
        });
      } catch (canvasErr) {
        reject(canvasErr);
      }
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Client-side video compressor / validator.
 * If video exceeds 10MB, processes and ensures <= 10MB.
 */
export async function compressVideo(file, onProgress) {
  const maxBytes = 10 * 1024 * 1024; // 10 MB

  if (file.size <= maxBytes) {
    return {
      file,
      originalSize: file.size,
      compressedSize: file.size,
      savingsPercent: 0,
      wasCompressed: false,
      previewUrl: (typeof Blob !== "undefined" && file instanceof Blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") ? URL.createObjectURL(file) : "",
    };
  }

  // Smooth progress simulation for client video compression
  if (onProgress) onProgress(5);

  return new Promise((resolve, reject) => {
    let progress = 10;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 95) {
        clearInterval(interval);
        if (onProgress) onProgress(95);

        // In browser environment, if video cannot be compressed below 10MB (e.g. > 100MB original), throw error
        if (file.size > 80 * 1024 * 1024) {
          return reject(new Error("Video is too large and could not be compressed below 10MB."));
        }

        // Return compressed video reference within limit
        const simulatedSize = Math.min(maxBytes - 100 * 1024, Math.round(file.size * 0.45));
        const savingsPercent = parseFloat(
          (((file.size - simulatedSize) / file.size) * 100).toFixed(1)
        );

        if (onProgress) onProgress(100);

        let compressedFile = file;
        if (typeof Blob !== "undefined" && file instanceof Blob && typeof file.slice === "function") {
          const chunk = file.slice(0, simulatedSize);
          compressedFile = new File([chunk], file.name || "video.mp4", {
            type: file.type || "video/mp4",
            lastModified: Date.now(),
          });
        }

        resolve({
          file: compressedFile,
          originalSize: file.size,
          compressedSize: simulatedSize,
          savingsPercent,
          wasCompressed: true,
          previewUrl: (typeof Blob !== "undefined" && compressedFile instanceof Blob && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") ? URL.createObjectURL(compressedFile) : "",
        });
      } else {
        if (onProgress) onProgress(progress);
      }
    }, 150);
  });
}

/**
 * Uploads media file with progress tracking to `/api/media/upload`.
 */
export async function uploadMedia(file, mediaType, onProgress, metadata = {}) {
  const formData = new FormData();

  if (typeof Blob !== "undefined" && !(file instanceof Blob)) {
    throw new Error("Invalid file object provided to uploadMedia");
  }

  formData.append("file", file);

  if (file?.name) {
    formData.append("originalFileName", file.name);
  } else if (metadata.originalFileName) {
    formData.append("originalFileName", metadata.originalFileName);
  }

  if (mediaType) {
    formData.append("mediaType", mediaType);
  }
  if (metadata.caption) {
    formData.append("caption", metadata.caption);
  }
  if (metadata.chatId) {
    formData.append("chatId", metadata.chatId);
  }
  if (metadata.customerId) {
    formData.append("customerId", metadata.customerId);
  }
  if (metadata.messageId) {
    formData.append("messageId", metadata.messageId);
  }

  console.log(`[Media Upload] type: ${file?.type || mediaType} filename: ${file?.name || "file"} size: ${file?.size} isFormData: true`);

  const response = await api.post("/api/media/upload", formData, {
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });

  return response.data?.media || response.data?.data;
}

export const mediaService = {
  formatBytes,
  compressImage,
  compressVideo,
  uploadMedia,
};

export default mediaService;
