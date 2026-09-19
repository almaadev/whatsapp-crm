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
  const { data: session } = useSession();
  const {
    user,
    isAuthenticated,
    isUnauthenticated,
    checkModuleAccessStatus,
  } = useAuth();

  const selectedChat = useChatStore((s) => s.selectedChat);
  const setSelectedChat = useChatStore((s) => s.setSelectedChat);
  const messages = useChatStore((s) => s.messages);
  const searchParams = useSearchParams();

  const userRole = user?.role || session?.user?.role;
  const accessStatus = checkModuleAccessStatus("Chat Inbox");
  const isAuthorized = accessStatus === "AUTHORIZED";

  const { loading: isChatLoading, error: chatError, refreshChats } = useChat({
    isAuthenticated,
    isAuthorized,
    role: userRole,
  });

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

  // State 1 & 3: Authentication is initializing or verifying permissions
  if (accessStatus === "INITIALIZING_AUTH" || accessStatus === "CHECKING_PERMISSION") {
    return <LoadingScreen message="Loading Chat..." />;
  }

  // State 2: Explicitly unauthenticated
  if (accessStatus === "UNAUTHENTICATED" || isUnauthenticated) {
    return null;
  }

  // State 8: Unauthorized (only evaluated AFTER authentication and store resolution have fully settled)
  if (accessStatus === "UNAUTHORIZED" || !isAuthorized) {
    return (
      <AccessDenied message="You do not have permission to access the Chat Inbox." />
    );
  }

  // State 4, 5, 6, 7: Authorized -> Render Chat Workspace (InboxPage)
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
          <ChatList
            role={userRole}
            loading={isChatLoading}
            error={chatError}
            onRetry={refreshChats}
          />
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
