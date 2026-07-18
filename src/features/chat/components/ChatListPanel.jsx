import React, { memo, useCallback } from "react";
import { Search, User } from "lucide-react";
import { formatSafeTime, getDisplayMessage, getChatMessagePreview } from "@/shared/utils/chatDisplay";
import { usePresenceStore } from "@/features/chat/stores/presenceStore";
import { useSession } from "next-auth/react";


const ChatListItem = memo(function ChatListItem({ chat, isSelected, onClick, emptyFallback }) {
  if (!chat) return null;
  const lastHistoryMsg = chat.history?.length > 0 ? chat.history[chat.history.length - 1] : null;
  const displayTime = chat.lastSeenAt || lastHistoryMsg?.createdAt || lastHistoryMsg?.timestamp || chat.createdAt;

  const activeHandlers = usePresenceStore((s) => s.activeHandlers);
  const { data: session } = useSession();
  const displayMsg = getChatMessagePreview(chat, session?.user, emptyFallback);
  const handler = activeHandlers[chat.phone];
  const isBeingHandledByOther = handler && handler.userId !== (session?.user?.id || session?.user?.email) && (!handler.lockedUntil || handler.lockedUntil > Date.now());

  const handleClick = (e) => {
    onClick(chat);
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-center px-3 py-2.5 cursor-pointer hover:bg-[#f5f6f6] transition-colors ${
        isSelected ? "bg-[#f0f2f5]" : ""
      }`}
    >
      <div className="w-12 h-12 bg-slate-300 rounded-full flex items-center justify-center text-white shrink-0 overflow-hidden mr-3">
        <User size={28} className="mt-2 opacity-80" />
      </div>
      <div className="flex-1 min-w-0 border-b border-slate-100 pb-3 pt-1">
        <div className="flex justify-between items-center mb-0.5">
          <h3 className="font-semibold text-[#111b21] text-[16px] leading-tight line-clamp-1">
            {chat.name || chat.phone}
          </h3>
          <span className="text-[12px] text-[#667781]">{formatSafeTime(displayTime)}</span>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-[13px] text-[#667781] line-clamp-1 pr-2">{displayMsg}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            {isBeingHandledByOther && (
              <span className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-red-50 text-red-600 border border-red-100">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                Locked by {handler.name}
              </span>
            )}
            {chat.status && (
              <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0">
                {chat.status}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

/**
 * Renders the list of chats for the selected category.
 *
 * @param {Object} props
 * @param {Object} props.config - Configuration object for the category (icons, titles, colors).
 * @param {string} props.searchTerm - Current search input.
 * @param {Function} props.setSearchTerm - State setter for search input.
 * @param {boolean} props.loading - Loading state for chats.
 * @param {Function} props.useStore - Zustand store hook for the specific category.
 */
export default function ChatListPanel({
  config,
  searchTerm,
  setSearchTerm,
  loading,
  useStore,
}) {
  const { Icon, title, headerIconBg, emptyFallback } = config;

  const messages = useStore((s) => s.messages);
  const selectedChat = useStore((s) => s.selectedChat);
  const setSelectedChat = useStore((s) => s.setSelectedChat);

  const handleChatSelect = useCallback((chat) => {
    setSelectedChat(chat);
  }, [setSelectedChat]);

  return (
    <div
      className={`flex flex-col bg-white border-r border-slate-200 h-full z-10 ${
        selectedChat ? "hidden md:flex" : "flex w-full"
      } md:w-[400px] lg:w-[450px] flex-shrink-0 transition-all`}
    >
      {/* Header */}
      <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between border-b border-slate-200 h-[60px] shrink-0">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 ${headerIconBg} rounded-full flex items-center justify-center text-white shadow-sm shrink-0`}
          >
            <Icon size={20} />
          </div>
          <h2 className="font-bold text-[#111b21] text-[16px]">{title}</h2>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-slate-200 bg-white">
        <div className="bg-[#f0f2f5] rounded-lg flex items-center px-3 py-1.5 gap-3">
          <Search size={18} className="text-[#54656f]" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full py-1 text-[#111b21] placeholder:text-[#54656f]"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
        {loading ? (
          <p className="text-center text-slate-400 mt-10 text-sm">Loading chats...</p>
        ) : (
          messages?.map((chat) => (
            <ChatListItem 
              key={chat?.phone || Math.random()} 
              chat={chat} 
              isSelected={selectedChat?.phone === chat?.phone} 
              onClick={handleChatSelect} 
              emptyFallback={emptyFallback} 
            />
          ))
        )}
      </div>
    </div>
  );
}
