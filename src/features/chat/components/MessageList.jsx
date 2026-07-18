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
    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative" ref={scrollRef} onScroll={onScroll}>
      {isNewHandler && (
        <div className="flex justify-center mb-4 sticky top-0 z-10">
          <div className="bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-lg text-xs font-medium shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
            <Info size={14} /> This lead was previously handled by <strong>{activeChat.lastClosedBy}</strong>
          </div>
        </div>
      )}

      {messages.map((item, index) => {
        const currentMsgDate = parseMessageDate(item.timestamp);
        const previousMsgDate = index > 0 ? parseMessageDate(messages[index - 1].timestamp) : null;
        const showDateHeader = index === 0 || (previousMsgDate && currentMsgDate.toDateString() !== previousMsgDate.toDateString());

        if (item.type === "audit") {
          const audit = item.data;
          
          return (
            <div key={item.key} className="w-full flex flex-col items-center my-3 select-none">
              {showDateHeader && (
                <div className="flex justify-center my-4 sticky top-2 z-10">
                  <span className="bg-white/90 backdrop-blur text-slate-500 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">{getDayHeader(currentMsgDate)}</span>
                </div>
              )}
              
              <div className="bg-[#f8fafc]/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl px-5 py-3 max-w-[85%] shadow-sm text-center flex flex-col gap-1 items-center animate-in fade-in zoom-in-95 duration-200">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200/50">
                  {getAuditIcon(audit.action)}
                  Chat {audit.action}
                </span>
                
                <p className="text-[13px] text-slate-700 font-medium mt-1">
                  {audit.performedBy ? (
                    <>
                      <strong>{audit.performedBy.name}</strong> <span className="text-slate-400 text-xs font-semibold">({audit.performedBy.role})</span>
                    </>
                  ) : (
                    <strong>System</strong>
                  )}
                  {audit.targetUser && (
                    <>
                      {" "}to <strong>{audit.targetUser.name}</strong> <span className="text-slate-400 text-xs font-semibold">({audit.targetUser.role})</span>
                    </>
                  )}
                </p>

                {audit.notes && (
                  <p className="text-xs text-slate-500 italic mt-0.5">"{audit.notes}"</p>
                )}

                <span className="text-[9px] text-slate-400 font-mono mt-1 font-bold">
                  {new Date(audit.timestamp).toLocaleString("en-IN", {
                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true
                  }).toUpperCase()}
                </span>
              </div>
            </div>
          );
        }

        const msg = item.data;
        return (
          <div key={item.key} className="w-full flex flex-col">
            {showDateHeader && (
              <div className="flex justify-center my-4 sticky top-2 z-10">
                <span className="bg-white/90 backdrop-blur text-slate-500 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">{getDayHeader(currentMsgDate)}</span>
              </div>
            )}
            <MessageBubble msg={msg} currentMsgDate={currentMsgDate} onMediaClick={onMediaClick} />
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );
});

export default MessageList;
