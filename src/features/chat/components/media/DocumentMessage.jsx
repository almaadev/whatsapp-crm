import React from "react";
import { FileText, Download, ExternalLink } from "lucide-react";
import { MessageStatusIcon, formatBubbleTime } from "@/shared/utils/chatUtils";
import { formatBytes } from "@/features/chat/services/mediaService";

export default function DocumentMessage({
  msg,
  currentMsgDate,
  isMe,
  onClick,
}) {
  const mediaUrl = msg.media?.url || msg.mediaUrl;
  const isExpired = msg.media?.status === "EXPIRED" || (!mediaUrl && msg.expiresAt && new Date(msg.expiresAt) <= new Date());

  // Priority hierarchy: originalFilename -> originalFileName -> fileName -> filename -> name -> safe fallback
  const rawFileName =
    msg.media?.originalFilename ||
    msg.media?.originalFileName ||
    msg.media?.fileName ||
    msg.media?.filename ||
    msg.media?.name ||
    msg.originalFilename ||
    msg.originalFileName ||
    msg.fileName ||
    msg.filename ||
    "";

  // Prevent exposing internal Cloudinary IDs or raw identifiers to users
  const isInternalId =
    !rawFileName ||
    rawFileName.startsWith("whatsapp-crm/") ||
    rawFileName.startsWith("file_") ||
    rawFileName === "file" ||
    rawFileName === "whatsapp_media" ||
    rawFileName.startsWith("inbound_");

  const fileName = !isInternalId ? rawFileName : "Document.pdf";
  const fileSize = msg.media?.fileSize ? formatBytes(msg.media.fileSize) : "";

  if (isExpired) {
    return (
      <div className="p-3 bg-slate-100 border border-slate-200/80 rounded-xl text-slate-500 text-xs">
        <p className="font-bold text-slate-700">📄 Document no longer available</p>
        <p className="text-[11px] text-slate-400 mt-0.5">This media expired after the 60-day retention period.</p>
        <div className="flex justify-end items-center gap-1 mt-1.5">
          <span className="text-[9px] text-slate-400 font-mono">
            {formatBubbleTime(currentMsgDate)}
          </span>
          {isMe && <MessageStatusIcon status={msg.messageStatus || msg.status} />}
        </div>
      </div>
    );
  }

  const handleDownload = (e) => {
    e.stopPropagation();
    if (!mediaUrl) return;
    const a = document.createElement("a");
    a.href = mediaUrl;
    a.download = fileName;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex flex-col min-w-[240px] max-w-[320px]">
      <div className="p-3 bg-white/90 border border-slate-200/80 rounded-xl flex items-center gap-3 shadow-xs">
        <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 text-rose-500 flex items-center justify-center shrink-0">
          <FileText size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-800 truncate" title={fileName}>
            {fileName}
          </h4>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            {fileSize ? `${fileSize} • ` : ""}PDF Document
          </p>
        </div>
      </div>

      {/* Action Buttons: [Open] [Download] */}
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => onClick && onClick({ url: mediaUrl, type: "pdf", name: fileName })}
          className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <ExternalLink size={13} /> Open
        </button>
        <button
          type="button"
          onClick={handleDownload}
          className="flex-1 py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <Download size={13} /> Download
        </button>
      </div>

      {/* Caption if present */}
      {msg.message && !msg.message.startsWith("[Attachment") && (
        <p className="text-[12.5px] text-slate-800 font-medium mt-2 leading-relaxed break-words px-0.5">
          {msg.message}
        </p>
      )}

      <div className="flex justify-end items-center gap-1 mt-1 px-0.5">
        <span className="text-[9px] text-slate-400 font-semibold font-mono tracking-tight select-none uppercase">
          {formatBubbleTime(currentMsgDate)}
        </span>
        {isMe && (
          <span className="scale-[0.85] opacity-80 shrink-0">
            <MessageStatusIcon status={msg.messageStatus || msg.status} />
          </span>
        )}
      </div>
    </div>
  );
}
