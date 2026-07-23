import React, { memo } from "react";
import { Info } from "lucide-react";
import { parseMessageDate, getDayHeader, formatEventDateTime, getSystemEventDetails } from "@/shared/utils/chatUtils";
import MessageBubble from "@/features/chat/components/MessageBubble";

const MessageList = memo(function MessageList({ messages, activeChat, userName, scrollRef, onScroll, onMediaClick, endRef }) {
  const isNewHandler = activeChat?.lastClosedBy && activeChat.lastClosedBy !== userName;

  return (
    <div className="flex-1 h-full min-h-0 w-full overflow-y-auto p-4 space-y-2 custom-scrollbar relative bg-[#efeae2]" ref={scrollRef} onScroll={onScroll}>
      <div
        className="absolute inset-0 opacity-[0.06] pointer-events-none z-0 bg-repeat bg-[size:400px]"
        style={{
          backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
        }}
      />
      <div className="relative z-10 w-full flex flex-col space-y-2">
        {isNewHandler && (
          <div className="flex justify-center mb-4 sticky top-0 z-10">
            <div className="bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-lg text-xs font-medium shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
              <Info size={14} /> This lead was previously handled by <strong>{activeChat.lastClosedBy}</strong>
            </div>
          </div>
        )}

        {messages.map((item, index) => {
          // ── Normalize item format ───────────────────────────────────────────
          // History items can be in two shapes:
          //   1. Wrapped:  { type: "message"|"audit", data: {...}, timestamp }
          //      → produced by ChatArea's chronologicalTimeline builder
          //   2. Flat raw: { direction, message, phone, timestamp, ... }
          //      → pushed directly by categoryChatStore.addMessage
          const isWrapped = item && (item.type === "audit" || item.type === "message" || item.data !== undefined);
          const normalizedItem = isWrapped
            ? item
            : { type: "message", data: item, timestamp: item?.timestamp || item?.createdAt };

          const currentMsgDate = parseMessageDate(normalizedItem.timestamp || normalizedItem.data?.timestamp);
          const prevItem = index > 0 ? messages[index - 1] : null;
          const prevNormalized = prevItem && (prevItem.type === "audit" || prevItem.type === "message" || prevItem.data !== undefined)
            ? prevItem
            : prevItem ? { type: "message", data: prevItem, timestamp: prevItem?.timestamp || prevItem?.createdAt } : null;
          const previousMsgDate = prevNormalized ? parseMessageDate(prevNormalized.timestamp || prevNormalized.data?.timestamp) : null;
          const showDateHeader = index === 0 || (previousMsgDate && currentMsgDate.toDateString() !== previousMsgDate.toDateString());

          if (normalizedItem.type === "audit") {
            const audit = normalizedItem.data;
            const eventDetails = getSystemEventDetails(audit);
            const formattedDateTime = formatEventDateTime(audit?.performedAt || audit?.timestamp || normalizedItem.timestamp);
            
            return (
              <div key={index} className="w-full flex flex-col items-center my-3 select-none">
                {showDateHeader && (
                  <div className="flex justify-center mb-3 sticky top-2 z-10">
                    <span className="bg-white/90 backdrop-blur text-slate-500 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm border border-slate-100">{getDayHeader(currentMsgDate)}</span>
                  </div>
                )}
                
                <div className="w-full flex items-center justify-center px-4">
                  <div className=" flex flex-row items-center justify-center gap-1 backdrop-blur-md border border-slate-200/80 shadow-xs px-4 py-2  rounded-xl  text-center transition-all">
                    {/* First Line: Event Title (bold) with Lucide icon */}
                    <div className="flex items-center justify-center gap-1.5 font-bold text-slate-800 text-xs sm:text-[13px] leading-tight">
                      {eventDetails.icon}
                      <span>{eventDetails.title}</span>
                    </div>

                    {/* Second Line: "by {User Name} • {Date & Time}" */}
                    <div className="flex items-center justify-center gap-1 text-[11px] sm:text-xs  leading-tight flex-wrap text-center">
                      <span className="text-slate-700 font-medium">
                        by {eventDetails.performedBy}
                      </span>
                      <span className="text-slate-400 font-normal mx-0.5">•</span>
                      <span className="text-slate-500 font-normal">
                        {formattedDateTime}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          const msg = normalizedItem.data;
          // Safety guard: skip rendering if msg is still undefined (corrupt data)
          if (!msg) return null;
          return (
            <div key={index} className="w-full flex flex-col">
              {showDateHeader && (
                <div className="flex justify-center my-4 sticky top-2 z-10">
                  <span className="bg-white/90 backdrop-blur text-slate-500 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">{getDayHeader(currentMsgDate)}</span>
                </div>
              )}
              <MessageBubble msg={msg} currentMsgDate={currentMsgDate} onMediaClick={onMediaClick} />
            </div>
          );
        })}
      </div>
      <div ref={endRef} />
    </div>
  );
});

export default MessageList;
