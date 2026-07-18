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

  const isAutomated =
    msg.isAutomated === true ||
    msg.senderName === "System Automation" ||
    (msg.message && msg.message.includes("Automated Template:"));

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
        {msg.mediaUrl && msg.mediaUrl.startsWith("http") && (
          <div
            className="mb-2 rounded-xl overflow-hidden cursor-pointer border border-slate-100/60 shadow-sm max-w-[300px]"
            onClick={() =>
              onMediaClick({ url: msg.mediaUrl, type: msg.mediaType })
            }
          >
            {msg.mediaType?.includes("video") ? (
              <video
                src={msg.mediaUrl}
                className="w-full h-auto rounded-xl pointer-events-none"
              />
            ) : msg.mediaType?.includes("audio") ? (
              <audio
                src={msg.mediaUrl}
                controls
                className="w-full h-10 mt-1 scale-95"
                onClick={(e) => e.stopPropagation()}
              />
            ) : msg.mediaType?.includes("pdf") ||
              msg.mediaType?.includes("document") ? (
              <div className="flex items-center gap-3 p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl hover:bg-slate-100 transition-colors">
                <div className="p-2.5 bg-rose-50 text-rose-500 rounded-lg border border-rose-100">
                  <FileText size={18} />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-700">Document File</span>
                  <span className="text-[10px] text-slate-400 font-semibold font-mono uppercase">PDF</span>
                </div>
              </div>
            ) : (
              <img
                src={msg.mediaUrl}
                alt="Attachment"
                className="w-full h-auto object-cover rounded-xl transition-transform hover:scale-[1.01]"
              />
            )}
          </div>
        )}

        {/* Message Text */}
        {msg.message ? (
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
        ) : (
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
