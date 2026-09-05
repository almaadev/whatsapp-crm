import React from "react";
import { MessageStatusIcon, formatBubbleTime } from "@/shared/utils/chatUtils";

export default function ImageMessage({
  msg,
  currentMsgDate,
  isMe,
  onClick,
}) {
  const mediaUrl = msg.media?.url || msg.mediaUrl;
  const isExpired = msg.media?.status === "EXPIRED" || (!mediaUrl && msg.expiresAt && new Date(msg.expiresAt) <= new Date());

  if (isExpired) {
    return (
      <div className="p-3 bg-slate-100 border border-slate-200/80 rounded-xl text-slate-500 text-xs">
        <p className="font-bold text-slate-700">🖼️ Image no longer available</p>
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

  return (
    <div className="flex flex-col min-w-0">
      <div
        onClick={() => onClick && onClick({ url: mediaUrl, type: "image", name: msg.media?.originalFileName || "photo.jpg" })}
        className="relative max-w-[280px] sm:max-w-[320px] rounded-xl overflow-hidden cursor-pointer shadow-xs group bg-slate-900/5 hover:opacity-95 transition-all"
      >
        <img
          src={mediaUrl}
          alt={msg.media?.originalFileName || "Attachment"}
          className="w-full h-auto object-cover max-h-[360px] rounded-xl transition-transform duration-200 group-hover:scale-[1.01]"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
      </div>

      {/* Caption if present */}
      {msg.message && !msg.message.startsWith("[Attachment") && (
        <p className="text-[13px] text-slate-800 font-medium mt-1.5 leading-relaxed break-words px-0.5">
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
