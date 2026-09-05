import React, { useState, useEffect, useCallback } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw, Download, ExternalLink } from "lucide-react";

export default function MediaViewer({ media, onClose }) {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom((prev) => Math.min(3, prev + 0.25));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.5, prev - 0.25));
  const handleResetZoom = () => setZoom(1);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") handleZoomIn();
      else if (e.key === "-") handleZoomOut();
      else if (e.key === "0") handleResetZoom();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!media || !media.url) return null;

  const isVideo = media.type?.includes("video");
  const isPdf = media.type?.includes("pdf") || media.type?.includes("document");
  const rawName = media.name || media.originalFileName || media.fileName || "";
  const isInternalId = !rawName || rawName.startsWith("whatsapp-crm/") || rawName.startsWith("file_") || rawName === "file" || rawName === "whatsapp_media" || rawName.startsWith("inbound_");
  const fileName = !isInternalId ? rawName : (isVideo ? "video.mp4" : isPdf ? "document.pdf" : "image.jpg");

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = media.url;
    a.download = fileName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    window.open(media.url, "_blank");
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 select-none animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Top Action Bar */}
      <div
        className="w-full flex items-center justify-between z-10 p-2 text-white/90"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-xs font-semibold font-mono truncate max-w-[240px] text-white/70">
          {fileName}
        </span>

        <div className="flex items-center gap-2">
          {/* Zoom controls for Images */}
          {!isVideo && !isPdf && (
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-xl p-1 border border-white/10 mr-2">
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
                title="Zoom In (+)"
              >
                <ZoomIn size={18} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
                title="Zoom Out (-)"
              >
                <ZoomOut size={18} />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white"
                title="Reset Zoom (0)"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleOpenNewTab}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white"
            title="Open in new tab"
          >
            <ExternalLink size={18} />
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors text-white"
            title="Download"
          >
            <Download size={18} />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-rose-500 rounded-xl transition-colors text-white ml-2"
            title="Close (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div
        className="flex-1 w-full max-h-[85vh] flex items-center justify-center overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={media.url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl"
          />
        ) : isPdf ? (
          <iframe
            src={media.url}
            title="PDF Document"
            className="w-[92vw] md:w-[80vw] h-[82vh] bg-white rounded-2xl shadow-2xl border-none"
          />
        ) : (
          <div className="overflow-auto max-w-full max-h-[85vh] flex items-center justify-center p-2 custom-scrollbar">
            <img
              src={media.url}
              alt="Media Full View"
              style={{ transform: `scale(${zoom})`, transition: "transform 0.15s ease-out" }}
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl select-none"
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* Bottom Hint */}
      <div className="text-[11px] text-white/40 font-mono py-1 select-none">
        Press ESC to close {!isVideo && !isPdf ? "• Press + / - to zoom" : ""}
      </div>
    </div>
  );
}
