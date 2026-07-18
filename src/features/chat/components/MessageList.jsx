import React, { memo } from "react";
import { Info, Clock, User, Share2, ToggleRight, ShieldAlert, Award } from "lucide-react";
import { parseMessageDate, getDayHeader } from "@/shared/utils/chatUtils";
import MessageBubble from "@/features/chat/components/MessageBubble";

const MessageList = memo(function MessageList({ messages, activeChat, userName, scrollRef, onScroll, onMediaClick, endRef }) {
  const isNewHandler = activeChat?.lastClosedBy && activeChat.lastClosedBy !== userName;

  const getAuditIcon = (action) => {
    switch (action) {
      case "Started": return <Clock size={12} className="text-emerald-500" />;
      case "Closed": return <ShieldAlert size={12} className="text-rose-500" />;
      case "Reopened": return <ToggleRight size={12} className="text-blue-500" />;
      case "Assigned": return <User size={12} className="text-indigo-500" />;
      case "Transferred": return <Share2 size={12} className="text-amber-500" />;
      default: return <Award size={12} className="text-slate-500" />;
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative bg-[#efeae2]" ref={scrollRef} onScroll={onScroll}>
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
            
            return (
              <div key={index} className="w-full flex flex-col items-center my-4 select-none">
                {showDateHeader && (
                  <div className="flex justify-center my-4 sticky top-2 z-10">
                    <span className="bg-white/90 backdrop-blur text-slate-500 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm border border-slate-100">{getDayHeader(currentMsgDate)}</span>
                  </div>
                )}
                
                <div className="w-full flex items-center justify-center gap-4 px-6 opacity-90">
                  <div className="flex-1 h-px bg-slate-200" />
                  <div className="flex flex-col items-center gap-1 shrink-0 text-center max-w-[70%]">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1 bg-slate-50 border border-slate-200/50 px-2.5 py-0.5 rounded-full shadow-sm">
                      {getAuditIcon(audit.action)}
                      Chat {audit.action} {audit.performedBy ? (
                        <>
                          by <span className="text-slate-800 font-black">{audit.performedBy.name}</span>
                        </>
                      ) : (
                        "System Automation"
                      )}
                      {audit.targetUser && (
                        <>
                          {" "}to <span className="text-slate-800 font-black">{audit.targetUser.name}</span>
                        </>
                      )}
                    </span>
                    <span className="text-[11px] text-slate-450 text-slate-500 font-bold leading-normal mt-0.5">
                      
                    </span>
                    {/* {audit.notes && (
                      <span className="text-[10px] text-slate-400 font-medium italic mt-0.5">"{audit.notes}"</span>
                    )} */}
                  </div>
                  <div className="flex-1 h-px bg-slate-200" />
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
