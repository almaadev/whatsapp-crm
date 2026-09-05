import React, { forwardRef, useImperativeHandle, useRef } from "react";
import { toast } from "react-toastify";

const MediaPicker = forwardRef(function MediaPicker(
  { onFileSelected, disabled },
  ref
) {
  const photoVideoInputRef = useRef(null);
  const documentInputRef = useRef(null);
  const audioInputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    openPhotosVideos() {
      photoVideoInputRef.current?.click();
    },
    openDocument() {
      documentInputRef.current?.click();
    },
    openAudio() {
      audioInputRef.current?.click();
    },
  }));

  const handleInputChange = (e, expectedCategory) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const mime = (file.type || "").toLowerCase();
    const ext = file.name.split(".").pop()?.toLowerCase() || "";

    // Validate category
    if (expectedCategory === "document") {
      if (mime !== "application/pdf" && ext !== "pdf") {
        toast.error("Unsupported file format. Only PDF documents are allowed.");
        e.target.value = "";
        return;
      }
    } else if (expectedCategory === "audio") {
      const isAudio = mime.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg", "aac"].includes(ext);
      if (!isAudio) {
        toast.error("Unsupported file format. Please select an audio file (MP3, WAV, M4A, OGG, AAC).");
        e.target.value = "";
        return;
      }
    } else if (expectedCategory === "photos_videos") {
      const isImage = mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext);
      const isVideo = mime.startsWith("video/") || ["mp4", "mov", "webm", "3gp"].includes(ext);
      if (!isImage && !isVideo) {
        toast.error("Unsupported file format. Please select an image (PNG, JPG, WEBP) or video (MP4).");
        e.target.value = "";
        return;
      }
    }

    onFileSelected(file, expectedCategory);
    e.target.value = "";
  };

  return (
    <div className="hidden">
      {/* Photos & Videos */}
      <input
        type="file"
        ref={photoVideoInputRef}
        accept="image/png,image/jpeg,image/jpg,image/webp,video/mp4,video/quicktime,video/webm,video/3gpp"
        disabled={disabled}
        onChange={(e) => handleInputChange(e, "photos_videos")}
      />

      {/* Documents (PDF) */}
      <input
        type="file"
        ref={documentInputRef}
        accept="application/pdf,.pdf"
        disabled={disabled}
        onChange={(e) => handleInputChange(e, "document")}
      />

      {/* Audio */}
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/mp3,audio/mpeg,audio/wav,audio/x-wav,audio/m4a,audio/x-m4a,audio/mp4,audio/ogg,audio/webm,audio/aac,audio/*"
        disabled={disabled}
        onChange={(e) => handleInputChange(e, "audio")}
      />
    </div>
  );
});

export default MediaPicker;
