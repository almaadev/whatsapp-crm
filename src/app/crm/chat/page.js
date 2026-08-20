"use client";

import { useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChat } from "@/features/chat/hooks/useChat";
import { useChatPresence } from "@/features/chat/hooks/useChatPresence";
import { useAuth } from "@/shared/hooks/useAuth";
import InboxPage from "@/shared/components/layout/InboxPage";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import ChatList from "@/features/chat/components/ChatList";
import ChatArea from "@/features/chat/components/ChatArea";

function ChatPageContent() {
  const { data: session, status } = useSession();
  const { user, isLoading, hasModuleAccess } = useAuth();
  const selectedChat = useChatStore((s) => s.selectedChat);
  const setSelectedChat = useChatStore((s) => s.setSelectedChat);
  const messages = useChatStore((s) => s.messages);
  const searchParams = useSearchParams();

  const userRole = user?.role || session?.user?.role;
  const isAuthorized = hasModuleAccess("Chat Inbox");
  const { loading } = useChat(userRole);

  useChatPresence(selectedChat?.phone);

  useEffect(() => {
    const phoneParam = searchParams.get("phone");
    if (phoneParam && messages.length > 0 && !selectedChat) {
      const targetChat = messages.find(
        (c) => c.phone.includes(phoneParam) || c.phone === phoneParam,
      );
      if (targetChat) setSelectedChat(targetChat);
    }
  }, [searchParams, messages, selectedChat, setSelectedChat]);

  if (status === "loading" || isLoading) {
    return <LoadingScreen message="Loading Chat..." />;
  }

  if (!user && !session) return null;

  if (!isAuthorized) {
    return (
      <AccessDenied message="You do not have permission to access the Chat Inbox." />
    );
  }

  return (
    <InboxPage
      listPanel={
        <div
          className={`flex flex-col bg-white border-r border-slate-200 h-full z-10 min-w-0 shrink-0 transition-all ${
            selectedChat
              ? "hidden lg:flex lg:w-[320px] xl:w-[340px] 2xl:w-[380px]"
              : "flex w-full lg:w-[320px] xl:w-[340px] 2xl:w-[380px]"
          }`}
        >
          <ChatList role={userRole} loading={loading} />
        </div>
      }
      chatPanel={
        <div
          className={`flex flex-col bg-white h-full transition-all flex-1 min-w-0 ${
            selectedChat ? "flex w-full" : "hidden lg:flex"
          }`}
        >
          <ChatArea />
        </div>
      }
    />
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading CRM..." />}>
      <ChatPageContent />
    </Suspense>
  );
}
