import React, { memo } from "react";
import { Info } from "lucide-react";
import { parseMessageDate, getDayHeader } from "@/shared/utils/chatUtils";
import MessageBubble from "@/features/chat/components/MessageBubble";

const MessageList = memo(function MessageList({ messages, activeChat, userName, scrollRef, onScroll, onMediaClick, endRef }) {
  const isNewHandler = activeChat?.lastClosedBy && activeChat.lastClosedBy !== userName;

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative" ref={scrollRef} onScroll={onScroll}>
      {isNewHandler && (
        <div className="flex justify-center mb-4 sticky top-0 z-10">
          <div className="bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-lg text-xs font-medium shadow-sm flex items-center gap-2">
            <Info size={14} /> This lead was previously handled by <strong>{activeChat.lastClosedBy}</strong>
          </div>
        </div>
      )}

      {messages.map((msg, index) => {
        const currentMsgDate = parseMessageDate(msg.timestamp || msg.createdAt);
        const previousMsgDate = index > 0 ? parseMessageDate(messages[index - 1].timestamp || messages[index - 1].createdAt) : null;
        const showDateHeader = index === 0 || (previousMsgDate && currentMsgDate.toDateString() !== previousMsgDate.toDateString());

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
      <div ref={endRef} />
    </div>
  );
});

export default MessageList;
