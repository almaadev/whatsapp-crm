import React, { useEffect, useRef } from "react";
import { Image, FileText, Music, X } from "lucide-react";

export default function AttachmentMenu({
  isOpen,
  onClose,
  onSelectOption,
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items = [
    {
      id: "photos_videos",
      label: "Photos & Videos",
      subtext: "Images (<= 3MB) & Videos (<= 10MB)",
      icon: Image,
      color: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100",
      accent: "#00a884",
    },
    {
      id: "document",
      label: "Document",
      subtext: "PDF files (<= 10MB)",
      icon: FileText,
      color: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
      accent: "#2563eb",
    },
    {
      id: "audio",
      label: "Audio",
      subtext: "MP3, WAV, M4A, OGG",
      icon: Music,
      color: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100",
      accent: "#9333ea",
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Popover on Desktop / Bottom Sheet on Mobile */}
      <div
        ref={menuRef}
        className="
          fixed md:absolute bottom-0 md:bottom-[70px] left-0 md:left-4
          w-full md:w-72 bg-white rounded-t-3xl md:rounded-2xl
          shadow-2xl border border-slate-200/90 p-3.5 z-50
          animate-in slide-in-from-bottom-4 md:zoom-in-95 duration-200
        "
      >
        {/* Mobile Header / Drag handle */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 md:hidden">
          <span className="text-xs font-bold text-slate-700 tracking-wide uppercase">Attach Media</span>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectOption(item.id);
                  onClose();
                }}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 active:bg-slate-100 transition-all text-left group"
              >
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-105 shrink-0 ${item.color}`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold text-slate-800 group-hover:text-[#00a884] transition-colors">
                    {item.label}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium truncate">
                    {item.subtext}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
