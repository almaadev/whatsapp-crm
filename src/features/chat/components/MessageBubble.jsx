import React, { memo } from "react";
import { Layers, FileText, Bot } from "lucide-react";
import { MessageStatusIcon, formatBubbleTime } from "@/shared/utils/chatUtils";

const MessageBubble = memo(function MessageBubble({
  msg,
  currentMsgDate,
  onMediaClick,
}) {
  const isMe = msg.direction?.toUpperCase() === "OUTBOUND";

  const isTemplateMessage =
    msg.isTemplate ||
    (msg.message &&
      (msg.message.startsWith("Template:") ||
        msg.message.startsWith("Template Sent (SID:")));

  // 🚀 Added check for automated messages
  const isAutomated =
    msg.isAutomated === true ||
    msg.senderName === "System Automation" ||
    (msg.message && msg.message.includes("Automated Template:"));

  return (
    <div
      className={`flex w-full ${isMe ? "justify-end" : "justify-start"} group mb-1 min-w-0`}
    >
      <div
        className={`relative px-3 py-1.5 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] min-w-0 break-words rounded-lg shadow-sm text-sm leading-relaxed ${isMe ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none"}`}
      >
        {/* 🚀 Grouped Badges for Templates and Automation */}
        {(isTemplateMessage || (isMe && isAutomated)) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            {isTemplateMessage && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#00a884] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 shadow-sm w-max select-none">
                <Layers size={10} /> Template
              </div>
            )}

            {isMe && isAutomated && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 shadow-sm w-max uppercase tracking-wider select-none">
                <Bot size={12} /> System Automation
              </div>
            )}
          </div>
        )}

        {msg.mediaUrl && msg.mediaUrl.startsWith("http") && (
          <div
            className="mb-1 rounded overflow-hidden cursor-pointer"
            onClick={() =>
              onMediaClick({ url: msg.mediaUrl, type: msg.mediaType })
            }
          >
            {msg.mediaType?.includes("video") ? (
              <video
                src={msg.mediaUrl}
                className="w-full max-w-[300px] h-auto rounded pointer-events-none"
              />
            ) : msg.mediaType?.includes("audio") ? (
              <audio
                src={msg.mediaUrl}
                controls
                className="w-full max-w-[240px] h-10 mt-1"
                onClick={(e) => e.stopPropagation()}
              />
            ) : msg.mediaType?.includes("pdf") ||
              msg.mediaType?.includes("document") ? (
              <div className="flex items-center gap-3 p-3 bg-white/60 border border-slate-200 rounded-lg hover:bg-white/90 transition-colors">
                <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                  <FileText size={20} />
                </div>
                <span className="text-xs font-bold text-slate-700">
                  View Document
                </span>
              </div>
            ) : (
              <img
                src={msg.mediaUrl}
                alt="Attachment"
                className="w-full max-w-[300px] h-auto object-cover rounded"
              />
            )}
          </div>
        )}

        {msg.message ? (
          <div
            className="whitespace-pre-wrap text-left"
            style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
          >
            <span>{msg.message}</span>
            <span className="inline-flex items-center gap-1 float-right mt-2 ml-3">
              <span className="text-[10px] text-slate-500 whitespace-nowrap select-none">
                {formatBubbleTime(currentMsgDate)}
              </span>
              {/* 🚀 FIX: Fallback to messageStatus for refreshed page data */}
              {isMe && (
                <MessageStatusIcon status={msg.messageStatus || msg.status} />
              )}
            </span>
          </div>
        ) : (
          <div className="flex justify-end items-center gap-1 mt-1">
            <span className="text-[10px] text-slate-500 whitespace-nowrap select-none">
              {formatBubbleTime(currentMsgDate)}
            </span>
            {/* 🚀 FIX: Fallback to messageStatus for refreshed page data */}
            {isMe && (
              <MessageStatusIcon status={msg.messageStatus || msg.status} />
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
