import React from "react";
import { X } from "lucide-react";

const MediaViewer = ({ media, onClose }) => (
  <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
    <button className="absolute top-4 right-4 text-white p-2" onClick={onClose}><X size={24} /></button>
    <div className="relative max-w-5xl max-h-full w-full flex justify-center" onClick={(e) => e.stopPropagation()}>
      {media.type?.includes("video") ? (
        <video src={media.url} controls autoPlay className="max-w-full max-h-[90vh] rounded shadow-2xl" />
      ) : media.type?.includes("pdf") || media.type?.includes("document") ? (
        <iframe src={media.url} className="w-[90vw] md:w-[80vw] h-[90vh] bg-white rounded shadow-2xl" />
      ) : (
        <img src={media.url} alt="Full View" className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" />
      )}
    </div>
  </div>
);

export default MediaViewer;
