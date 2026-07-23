"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import InboxPage from "@/shared/components/layout/InboxPage";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import { useAuth } from "@/shared/hooks/useAuth";
import { toast } from "react-toastify";
import { chatRepository } from "@/shared/api/repositories/chatRepository";
import { chatService } from "@/features/chat/services/chatService";
import api from "@/shared/lib/axios";

import dynamic from "next/dynamic";
import { useDebounce } from "@/shared/hooks/useDebounce";

const CustomerInfoPanel = dynamic(() => import("@/features/chat/components/CustomerInfoPanel"), { ssr: false });

import { useCategoryChat } from "@/features/chat/hooks/useCategoryChat";
import { useChatPresence } from "@/features/chat/hooks/useChatPresence";

import ChatListPanel from "@/features/chat/components/ChatListPanel";
import ChatViewPanel from "@/features/chat/components/ChatViewPanel";

function CategoryInboxContent({ slug }) {
  const { data: session, status } = useSession();
  const { user, isLoading, hasModuleAccess } = useAuth();
  const searchParams = useSearchParams();
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);
  const messagesEndRef = useRef(null);

  // Twilio Senders State
  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [selectedSender, setSelectedSender] = useState("");

  // Action Modals State
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [actionNote, setActionNote] = useState("");

  const userRole = user?.role || session?.user?.role || "associate";
  const userName = user?.name || session?.user?.name || "User";
  const userEmail = user?.email || session?.user?.email;

  const { loading, sending, fetchChats, sendMessage, updateStatus, useStore, config } =
    useCategoryChat(slug);

  const selectedChat = useStore((s) => s.selectedChat);
  const setSelectedChat = useStore((s) => s.setSelectedChat);
  const messages = useStore((s) => s.messages);
  const updateChatDetails = useStore((s) => s.updateChatDetails);

  const { Icon, chatType, moduleName, leadCategory } = config;
  const isAuthorized = hasModuleAccess(moduleName);

  useChatPresence(selectedChat?.phone);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  useEffect(() => {
    api.get("/api/admin/twilio")
      .then(({ data }) => {
        if (data?.numbers && Array.isArray(data.numbers)) {
          setAvailableNumbers(data.numbers);
          if (data.numbers.length > 0) {
            setSelectedSender(data.numbers[0].phoneNumber);
          }
        }
      })
      .catch((err) => console.error("Failed to load twilio senders:", err));
  }, []);

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
          associateName: userName,
          contentVariables: variables,
        });
        fetchChats(debouncedSearch);
        setTimeout(scrollToBottom, 50);
      } catch {
        toast.error("Failed to send template.");
      }
    },
    [selectedChat, userName, fetchChats, debouncedSearch, chatType]
  );

  const lastMessage =
    selectedChat?.history?.length > 0
      ? selectedChat.history[selectedChat.history.length - 1]
      : null;
  const isChatClosed = Boolean(
    lastMessage?.isChatClosed || selectedChat?.isClosed || selectedChat?.isChatClosed
  );

  const handleToggleChatStatus = async () => {
    if (!selectedChat || isToggling) return;
    setIsToggling(true);
    const newClosedState = !isChatClosed;

    const history = selectedChat.history || [];
    const updatedHistory = [...history];
    if (updatedHistory.length > 0) {
      updatedHistory[updatedHistory.length - 1] = {
        ...updatedHistory[updatedHistory.length - 1],
        isChatClosed: newClosedState,
      };
    }
    updateChatDetails(selectedChat.phone, {
      isClosed: newClosedState,
      isChatClosed: newClosedState,
      history: updatedHistory,
    });

    try {
      await chatRepository.updateStatus({
        phone: selectedChat.phone,
        isChatClosed: newClosedState,
        chatType,
      });
      toast.success(newClosedState ? "Chat Marked as Closed" : "Chat Marked as Active");
    } catch {
      toast.error("Failed to update Chat Control Status");
      const revertedHistory = [...history];
      if (revertedHistory.length > 0) {
        revertedHistory[revertedHistory.length - 1] = {
          ...revertedHistory[revertedHistory.length - 1],
          isChatClosed: !newClosedState,
        };
      }
      updateChatDetails(selectedChat.phone, {
        isClosed: !newClosedState,
        isChatClosed: !newClosedState,
        history: revertedHistory,
      });
    } finally {
      setIsToggling(false);
    }
  };

  const submitStatusChange = async (newStatus, priority = null) => {
    if (!selectedChat) return;

    const targetPriority =
      newStatus === "Closed" ? "" : priority || selectedChat.priority;

    const optimisticUpdate = {
      status: newStatus,
      priority: targetPriority,
      isClosed: newStatus === "Closed",
      isChatClosed: newStatus === "Closed",
      currentHandler: userName,
    };

    const originalChat = { ...selectedChat };

    updateChatDetails(selectedChat.phone, optimisticUpdate);
    setShowPriorityModal(false);
    setShowClosingModal(false);
    toast.success(`Status updated to ${newStatus}`);

    try {
      await chatService.updateLeadLifecycle({
        phone: selectedChat.phone,
        status: newStatus,
        associateEmail: userEmail,
        associateName: userName,
        notes: actionNote,
        priority: targetPriority,
      });
    } catch (e) {
      toast.error("Failed to save status. Reverting...");
      updateChatDetails(selectedChat.phone, originalChat);
    }
  };

  const handleSetReminder = async ({ date, time, message }) => {
    if (!selectedChat) return;
    try {
      await chatService.setReminder({
        action: "SET",
        phone: selectedChat.phone,
        message,
        date,
        time,
      });
      toast.success("Reminder Scheduled!");
    } catch (e) {
      toast.error("Error setting reminder");
    }
  };

  const handleForwardLead = async (targetPhone, targetName, message) => {
    if (!selectedChat) return;
    try {
      await chatService.forwardLead({
        customerPhone: selectedChat.phone,
        targetPhone,
        message,
        associateName: targetName,
        role: userRole,
      });
      toast.success(`Lead forwarded to ${targetName}`);
    } catch (e) {
      toast.error("Error forwarding lead.");
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

  if (status === "loading" || isLoading) {
    return <LoadingScreen message={config.loadingLabel} />;
  }

  if (!user && !session) return null;

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
            session={user ? { user } : session}
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
            onFocus={() => {
              setTimeout(scrollToBottom, 150);
            }}
            availableNumbers={availableNumbers}
            selectedSender={selectedSender}
            onSelectSender={setSelectedSender}
            onReminder={() => setShowReminderModal(true)}
            onForward={() => setShowForwardModal(true)}
            showForwardModal={showForwardModal}
            setShowForwardModal={setShowForwardModal}
            showReminderModal={showReminderModal}
            setShowReminderModal={setShowReminderModal}
            showPriorityModal={showPriorityModal}
            setShowPriorityModal={setShowPriorityModal}
            showClosingModal={showClosingModal}
            setShowClosingModal={setShowClosingModal}
            actionNote={actionNote}
            setActionNote={setActionNote}
            submitStatusChange={submitStatusChange}
            handleSetReminder={handleSetReminder}
            handleForwardLead={handleForwardLead}
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
