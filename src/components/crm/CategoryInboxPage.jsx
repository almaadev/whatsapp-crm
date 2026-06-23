"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import InboxPage from "@/components/layout/InboxPage";
import LoadingScreen from "@/components/ui/LoadingScreen";
import AccessDenied from "@/components/ui/AccessDenied";
import { hasModuleAccess } from "@/utils/auth";
import { toast } from "react-toastify";
import { User, Search, Lock } from "lucide-react";
import CustomerInfoPanel from "@/components/features/chat/CustomerInfoPanel";
import ChatHeader from "@/components/features/chat/ChatHeader";
import MessageList from "@/components/features/chat/MessageList";
import ChatInput from "@/components/features/chat/ChatInput";
import { useCategoryChat } from "@/hooks/useCategoryChat";
import { formatSafeTime, getDisplayMessage } from "@/utils/chatDisplay";

function CategoryInboxContent({ slug }) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const messagesEndRef = useRef(null);

  const { loading, sending, fetchChats, sendMessage, updateStatus, useStore, config } =
    useCategoryChat(slug);

  const selectedChat = useStore((s) => s.selectedChat);
  const setSelectedChat = useStore((s) => s.setSelectedChat);
  const messages = useStore((s) => s.messages);
  const updateChatDetails = useStore((s) => s.updateChatDetails);

  const { Icon, chatType, moduleName, leadCategory } = config;
  const isAuthorized = hasModuleAccess(session, moduleName);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.history]);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (isAuthorized) fetchChats(debouncedSearch);
  }, [debouncedSearch, isAuthorized, fetchChats]);

  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam && messages?.length > 0 && !selectedChat) {
      const targetChat = messages.find(
        (c) => c?.phone?.includes(phoneParam) || c?.phone === phoneParam
      );
      if (targetChat) setSelectedChat(targetChat);
    }
  }, [searchParams, messages, selectedChat, setSelectedChat]);

  const handleSendTemplate = useCallback(
    async (template, variables) => {
      if (!selectedChat) return;
      try {
        const res = await fetch("/api/send-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: selectedChat.phone,
            templateSid: template.sid,
            chatType,
            associateName: session?.user?.name,
            contentVariables: variables,
          }),
        });
        if (!res.ok) throw new Error("Template failed");
        fetchChats(debouncedSearch);
        setTimeout(scrollToBottom, 50);
      } catch {
        toast.error("Failed to send template.");
      }
    },
    [selectedChat, session, fetchChats, debouncedSearch, chatType]
  );

  const lastMessage =
    selectedChat?.history?.length > 0
      ? selectedChat.history[selectedChat.history.length - 1]
      : null;
  const isChatClosed = lastMessage ? !!lastMessage.isChatClosed : false;

  const handleToggleChatStatus = async () => {
    if (!selectedChat || isToggling || !selectedChat.history?.length) return;
    setIsToggling(true);
    const newClosedState = !isChatClosed;

    const updatedHistory = [...selectedChat.history];
    updatedHistory[updatedHistory.length - 1] = { ...lastMessage, isChatClosed: newClosedState };
    updateChatDetails(selectedChat.phone, { history: updatedHistory });

    try {
      const res = await fetch("/api/chats/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedChat.phone,
          isChatClosed: newClosedState,
          chatType,
        }),
      });
      if (res.ok) {
        toast.success(newClosedState ? "Chat Marked as Closed" : "Chat Marked as Active");
      } else {
        throw new Error("Failed to sync toggle");
      }
    } catch {
      toast.error("Failed to update Chat Control Status");
      const revertedHistory = [...selectedChat.history];
      revertedHistory[revertedHistory.length - 1] = {
        ...lastMessage,
        isChatClosed: !newClosedState,
      };
      updateChatDetails(selectedChat.phone, { history: revertedHistory });
    } finally {
      setIsToggling(false);
    }
  };

  const handleSend = async (msgText) => {
    if (!msgText?.trim() || !selectedChat) return;
    const success = await sendMessage(selectedChat.phone, msgText);
    if (success) setTimeout(scrollToBottom, 50);
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedChat) return;
    await updateStatus(selectedChat.phone, newStatus);
  };

  if (status === "loading") {
    return <LoadingScreen message={config.loadingLabel} />;
  }

  if (!session) return null;

  if (!isAuthorized) {
    return (
      <AccessDenied message={`You do not have permission to access ${config.title}.`} />
    );
  }

  const listPanel = (
    <div
      className={`flex flex-col bg-white border-r border-slate-200 h-full z-10 ${
        selectedChat ? "hidden md:flex" : "flex w-full"
      } md:w-[400px] lg:w-[450px] flex-shrink-0 transition-all`}
    >
      <div className="bg-[#f0f2f5] px-4 py-3 flex items-center justify-between border-b border-slate-200 h-[60px] shrink-0">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 ${config.headerIconBg} rounded-full flex items-center justify-center text-white shadow-sm shrink-0`}
          >
            <Icon size={20} />
          </div>
          <h2 className="font-bold text-[#111b21] text-[16px]">{config.title}</h2>
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto bg-white custom-scrollbar">
        {loading ? (
          <p className="text-center text-slate-400 mt-10 text-sm">Loading chats...</p>
        ) : (
          messages?.map((chat) => {
            if (!chat) return null;
            const displayMsg = getDisplayMessage(chat, config.emptyFallback);
            const lastHistoryMsg =
              chat.history?.length > 0 ? chat.history[chat.history.length - 1] : null;
            const displayTime =
              chat.lastSeenAt ||
              lastHistoryMsg?.createdAt ||
              lastHistoryMsg?.timestamp ||
              chat.createdAt;

            return (
              <div
                key={chat.phone}
                onClick={() => setSelectedChat(chat)}
                className={`flex items-center px-3 py-2.5 cursor-pointer hover:bg-[#f5f6f6] transition-colors ${
                  selectedChat?.phone === chat.phone ? "bg-[#f0f2f5]" : ""
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
                    <span className="text-[12px] text-[#667781]">
                      {formatSafeTime(displayTime)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[13px] text-[#667781] line-clamp-1 pr-2">{displayMsg}</p>
                    {chat.status && (
                      <span className="bg-blue-100 text-blue-800 text-[10px] px-2 py-0.5 rounded-md font-bold shrink-0">
                        {chat.status}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  const chatPanel = (
    <>
      <div
        className={`flex flex-col bg-[var(--chat-wallpaper)] h-full transition-all ${
          selectedChat
            ? "fixed inset-0 z-50 md:static md:z-auto flex w-full"
            : "hidden md:flex flex-1"
        }`}
      >
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none z-0"
          style={{
            backgroundImage:
              "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
            backgroundSize: "400px",
          }}
        />

        <div className="relative z-10 h-full flex flex-col">
          {selectedChat ? (
            <>
              <ChatHeader
                activeChat={selectedChat}
                userName={session?.user?.name}
                isChatClosed={isChatClosed}
                isToggling={isToggling}
                onToggle={handleToggleChatStatus}
                onStatusChange={handleStatusChange}
                onBack={() => setSelectedChat(null)}
                onInfo={() => setIsInfoOpen(true)}
                onReminder={() => {}}
                onForward={() => {}}
                themeGradient={config.themeGradient}
                themeBadgeClasses={config.themeBadgeClasses}
                themeIconHoverClasses={config.themeIconHoverClasses}
              />
              <MessageList
                messages={selectedChat?.history || []}
                activeChat={selectedChat}
                userName={session?.user?.name}
                scrollRef={null}
                onScroll={() => {}}
                onMediaClick={() => {}}
                endRef={messagesEndRef}
              />
              <ChatInput
                onSendMessage={handleSend}
                onSendTemplate={handleSendTemplate}
                sending={sending}
              />
            </>
          ) : (
            <div
              className={`flex-1 flex flex-col items-center justify-center border-b-[6px] ${config.borderAccent}`}
            >
              <div
                className={`w-24 h-24 bg-white shadow-sm rounded-full flex items-center justify-center mb-6 ${config.accentText}`}
              >
                <Icon size={40} />
              </div>
              <h2 className="text-3xl font-light text-slate-700 mb-4">{config.emptyTitle}</h2>
              <p className="text-slate-500 text-sm text-center max-w-[400px]">
                Select a customer from the left to start messaging.
              </p>
              <div className="mt-10 flex items-center gap-1.5 text-xs text-slate-400 font-medium bg-white px-4 py-2 rounded-full shadow-sm">
                <Lock size={12} /> End-to-end encrypted CRM integration
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedChat && (
        <CustomerInfoPanel
          isOpen={isInfoOpen}
          onClose={() => setIsInfoOpen(false)}
          leadCategory={leadCategory}
          activeChat={selectedChat}
        />
      )}
    </>
  );

  return <InboxPage listPanel={listPanel} chatPanel={chatPanel} />;
}

export default function CategoryInboxPage({ slug }) {
  return (
    <Suspense fallback={<LoadingScreen message="Loading CRM..." />}>
      <CategoryInboxContent slug={slug} />
    </Suspense>
  );
}
