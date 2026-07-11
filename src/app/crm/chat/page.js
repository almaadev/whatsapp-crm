"use client";

import { useState, useEffect, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { useChat } from "@/features/chat/hooks/useChat";
import { useChatPresence } from "@/features/chat/hooks/useChatPresence";
import { hasModuleAccess } from "@/shared/utils/auth";
import InboxPage from "@/shared/components/layout/InboxPage";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import ChatList from "@/components/features/chat/ChatList";
import ChatArea from "@/components/features/chat/ChatArea";

function ChatPageContent() {
  const { data: session, status } = useSession();
  const selectedChat = useChatStore((s) => s.selectedChat);
  const setSelectedChat = useChatStore((s) => s.setSelectedChat);
  const messages = useChatStore((s) => s.messages);
  const searchParams = useSearchParams();

  const userRole = session?.user?.role;
  const isAuthorized = hasModuleAccess(session, "Chat Inbox");
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

  if (status === "loading") {
    return <LoadingScreen message="Loading Chat..." />;
  }

  if (!session) return null;

  if (!isAuthorized) {
    return (
      <AccessDenied message="You do not have permission to access the Chat Inbox." />
    );
  }

  return (
    <InboxPage
      listPanel={
        <div
          className={`flex flex-col bg-white border-r border-slate-200 h-full z-10 ${
            selectedChat ? "hidden md:flex" : "flex w-full"
          } md:w-[400px] lg:w-[450px] flex-shrink-0 transition-all`}
        >
          <ChatList role={userRole} loading={loading} />
        </div>
      }
      chatPanel={
        <div
          className={`flex flex-col bg-[var(--chat-wallpaper)] h-full transition-all ${
            selectedChat
              ? "fixed inset-0 z-50 md:static md:z-auto flex w-full"
              : "hidden md:flex flex-1"
          }`}
        >
          <div
            className="absolute inset-0 opacity-50 pointer-events-none z-0"
            style={{
              backgroundImage:
                "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
              backgroundSize: "500px",
            }}
          />
          <div className="relative z-10 h-full flex flex-col">
            <ChatArea />
          </div>
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
