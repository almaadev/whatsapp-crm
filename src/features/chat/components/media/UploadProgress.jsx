import React from "react";
import { Loader2 } from "lucide-react";

export default function UploadProgress({ stageText = "Uploading...", percent = 0 }) {
  if (!stageText && percent === 0) return null;

  return (
    <div className="w-full bg-emerald-50/90 border border-emerald-200/80 rounded-xl px-3.5 py-2 text-xs text-emerald-900 shadow-xs flex items-center justify-between gap-3 animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-2 font-semibold">
        <Loader2 size={14} className="animate-spin text-[#00a884]" />
        <span className="truncate">{stageText}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-24 bg-emerald-200/60 rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#00a884] h-2 rounded-full transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="font-mono font-bold text-[11px] text-emerald-800">{percent}%</span>
      </div>
    </div>
  );
}
