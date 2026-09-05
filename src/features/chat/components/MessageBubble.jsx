import React, { memo } from "react";
import { Layers, Bot } from "lucide-react";
import { MessageStatusIcon, formatBubbleTime } from "@/shared/utils/chatUtils";

import ImageMessage from "@/features/chat/components/media/ImageMessage";
import VideoMessage from "@/features/chat/components/media/VideoMessage";
import AudioMessage from "@/features/chat/components/media/AudioMessage";
import DocumentMessage from "@/features/chat/components/media/DocumentMessage";

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

  const isAutomated =
    msg.isAutomated === true ||
    msg.senderName === "System Automation" ||
    (msg.message && msg.message.includes("Automated Template:"));

  const hasMedia = Boolean(msg.mediaUrl || msg.media?.url || msg.messageType === "image" || msg.messageType === "video" || msg.messageType === "audio" || msg.messageType === "document");
  const rawMediaType = (msg.messageType || msg.mediaType || msg.media?.mimeType || "").toLowerCase();

  const isVideo = rawMediaType.includes("video");
  const isAudio = rawMediaType.includes("audio");
  const isDoc = rawMediaType.includes("pdf") || rawMediaType.includes("document");
  const isImage = hasMedia && !isVideo && !isAudio && !isDoc;

  return (
    <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"} group mb-2 min-w-0`}>
      <div
        className={`relative px-4 py-2.5 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] min-w-0 break-words rounded-2xl shadow-sm text-sm leading-relaxed border transition-all duration-200
          ${isMe 
            ? "bg-emerald-50/70 text-slate-800 rounded-tr-none border-emerald-200/50" 
            : "bg-white text-slate-800 rounded-tl-none border-slate-100"
          }
        `}
      >
        {/* Template & Automation Tags */}
        {(isTemplateMessage || (isMe && isAutomated)) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {isTemplateMessage && (
              <div className="flex items-center gap-1 text-[9px] font-extrabold text-[#00a884] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shadow-sm select-none uppercase tracking-wide">
                <Layers size={9} /> Template
              </div>
            )}

            {isMe && isAutomated && (
              <div className="flex items-center gap-1 text-[9px] font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 shadow-sm select-none uppercase tracking-wide">
                <Bot size={11} /> Automated
              </div>
            )}
          </div>
        )}

        {/* Media Attachments */}
        {hasMedia && (
          <div className="mb-1">
            {isImage && (
              <ImageMessage
                msg={msg}
                currentMsgDate={currentMsgDate}
                isMe={isMe}
                onClick={onMediaClick}
              />
            )}
            {isVideo && (
              <VideoMessage
                msg={msg}
                currentMsgDate={currentMsgDate}
                isMe={isMe}
                onClick={onMediaClick}
              />
            )}
            {isAudio && (
              <AudioMessage
                msg={msg}
                currentMsgDate={currentMsgDate}
                isMe={isMe}
              />
            )}
            {isDoc && (
              <DocumentMessage
                msg={msg}
                currentMsgDate={currentMsgDate}
                isMe={isMe}
                onClick={onMediaClick}
              />
            )}
          </div>
        )}

        {/* Regular Text Message (when no media is attached) */}
        {!hasMedia && msg.message && (
          <div
            className="whitespace-pre-wrap text-left"
            style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
          >
            <span className="text-[13.5px] text-slate-750 font-medium">{msg.message}</span>
            <span className="inline-flex items-center gap-1.5 float-right mt-2.5 ml-4">
              <span className="text-[9px] text-slate-400 font-semibold font-mono tracking-tight select-none uppercase">
                {formatBubbleTime(currentMsgDate)}
              </span>
              {isMe && (
                <span className="scale-[0.85] opacity-80 shrink-0">
                  <MessageStatusIcon status={msg.messageStatus || msg.status} />
                </span>
              )}
            </span>
          </div>
        )}

        {/* Fallback empty message time ticker */}
        {!hasMedia && !msg.message && (
          <div className="flex justify-end items-center gap-1 mt-1.5">
            <span className="text-[9px] text-slate-400 font-semibold font-mono tracking-tight select-none uppercase">
              {formatBubbleTime(currentMsgDate)}
            </span>
            {isMe && (
              <span className="scale-[0.85] opacity-80 shrink-0">
                <MessageStatusIcon status={msg.messageStatus || msg.status} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default MessageBubble;
