"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import InboxPage from "@/shared/components/layout/InboxPage";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import { hasModuleAccess } from "@/shared/utils/auth";
import { toast } from "react-toastify";
import { chatRepository } from "@/shared/api/repositories/chatRepository";
import { User, Search, Lock } from "lucide-react";
import dynamic from "next/dynamic";
import { useDebounce } from "@/shared/hooks/useDebounce";

const CustomerInfoPanel = dynamic(() => import("@/components/features/chat/CustomerInfoPanel"), { ssr: false });
import ChatHeader from "@/components/features/chat/ChatHeader";
import MessageList from "@/components/features/chat/MessageList";
import ChatInput from "@/components/features/chat/ChatInput";
import { useCategoryChat } from "@/features/chat/hooks/useCategoryChat";
import { useChatPresence } from "@/features/chat/hooks/useChatPresence";
import { formatSafeTime, getDisplayMessage } from "@/shared/utils/chatDisplay";
import ChatListPanel from "@/features/chat/components/ChatListPanel";
import ChatViewPanel from "@/features/chat/components/ChatViewPanel";

function CategoryInboxContent({ slug }) {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const messagesEndRef = useRef(null);

  const { loading, sending, fetchChats, sendMessage, updateStatus, useStore, config } =
    useCategoryChat(slug);

  const selectedChat = useStore((s) => s.selectedChat);
  const setSelectedChat = useStore((s) => s.setSelectedChat);
  const messages = useStore((s) => s.messages);
  const updateChatDetails = useStore((s) => s.updateChatDetails);

  const { Icon, chatType, moduleName, leadCategory } = config;
  const isAuthorized = hasModuleAccess(session, moduleName);

  useChatPresence(selectedChat?.phone);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    scrollToBottom();
  }, [selectedChat?.history]);

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
        await chatRepository.sendTemplate({
          phone: selectedChat.phone,
          templateSid: template.sid,
          chatType,
          associateName: session?.user?.name,
          contentVariables: variables,
        });
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
      const res = await chatRepository.updateStatus({
        phone: selectedChat.phone,
        isChatClosed: newClosedState,
        chatType,
      });
      toast.success(newClosedState ? "Chat Marked as Closed" : "Chat Marked as Active");
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

  return (
    <InboxPage
      listPanel={
        <ChatListPanel
          config={config}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          loading={loading}
          useStore={useStore}
        />
      }
      chatPanel={
        <>
          <ChatViewPanel
            useStore={useStore}
            session={session}
            isChatClosed={isChatClosed}
            isToggling={isToggling}
            handleToggleChatStatus={handleToggleChatStatus}
            handleStatusChange={handleStatusChange}
            setIsInfoOpen={setIsInfoOpen}
            config={config}
            handleSend={handleSend}
            handleSendTemplate={handleSendTemplate}
            sending={sending}
            messagesEndRef={messagesEndRef}
          />
          {selectedChat && (
            <CustomerInfoPanel
              isOpen={isInfoOpen}
              onClose={() => setIsInfoOpen(false)}
              leadCategory={leadCategory}
              activeChat={selectedChat}
            />
          )}
        </>
      }
    />
  );
}

export default function CategoryInboxPage({ slug }) {
  return (
    <Suspense fallback={<LoadingScreen message="Loading CRM..." />}>
      <CategoryInboxContent slug={slug} />
    </Suspense>
  );
}
