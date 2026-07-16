"use client";

import { useState, useRef, useEffect, memo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/features/chat/stores/chatStore";
<<<<<<< HEAD
import { usePresenceStore } from "@/features/chat/stores/presenceStore";
=======
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
import { chatService } from "@/features/chat/services/chatService";
import dynamic from "next/dynamic";

const CustomerInfoPanel = dynamic(() => import("@/components/features/chat/CustomerInfoPanel"), { ssr: false });
const ForwardLeadModal = dynamic(() => import("@/shared/components/modals/ForwardLeadModal"), { ssr: false });
const ReminderModal = dynamic(() => import("@/shared/components/modals/ReminderModal"), { ssr: false });
const PriorityModal = dynamic(() => import("@/shared/components/modals/PriorityModal"), { ssr: false });
<<<<<<< HEAD

import {mutateLastMessage} from "@/shared/utils/chatUtils";

=======

import {
  parseMessageDate,
  getDayHeader,
  formatBubbleTime,
  mutateLastMessage,
  MessageStatusIcon,
} from "@/shared/utils/chatUtils";
import { getStatusColor } from "@/shared/utils/colorUtils";
>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32
import { toast } from "react-toastify";

import {
  MessageSquare,
  ArrowDown,
  Lock,
} from "lucide-react";

import ChatInput from "@/components/features/chat/ChatInput";
import ChatHeader from "@/components/features/chat/ChatHeader";
import MessageList from "@/components/features/chat/MessageList";
import ClosingModal from "@/shared/components/modals/ClosingModal";
import MediaViewer from "@/components/features/chat/MediaViewer";

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN CHAT AREA ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatArea({
  customRole = "associate",
  customService = null,
}) {
  const { data: session } = useSession();
  const userRole = customRole || session?.user?.role || "associate";
  const userName = session?.user?.name || "User";
  const userEmail = session?.user?.email;

  const {
    selectedChat,
    messages: allMessages,
    addMessage,
    setSelectedChat,
    updateChatDetails,
    updateMessageStatus,
  } = useChatStore();

  const [sending, setSending] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);

  const [showPriorityModal, setShowPriorityModal] = useState(false);
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [actionNote, setActionNote] = useState("");

  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // --- Derived Data ---
  const activeChat =
    allMessages.find((c) => c.phone === selectedChat?.phone) || selectedChat;
  const messages = activeChat?.history || [];
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;
  const isChatClosed = lastMessage?.isChatClosed || false;

  const activeHandlers = usePresenceStore((s) => s.activeHandlers);
  const handler = activeChat ? activeHandlers[activeChat.phone] : null;
  const isLockedByOther = handler && handler.userId !== (session?.user?.id || session?.user?.email) && (!handler.lockedUntil || handler.lockedUntil > Date.now());

  // --- Scroll Handling ---
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop =
        scrollContainerRef.current.scrollHeight;
    }
  }, [messages.length, activeChat?.phone]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
  };

  // --- Business Logic ---
  const handleSetReminder = async ({ date, time, message }) => {
    try {
      await chatService.setReminder({
        action: "SET",
        phone: activeChat.phone,
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
    try {
      await chatService.forwardLead({
        customerPhone: activeChat.phone,
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

  const handleToggleChatStatus = async () => {
    if (!activeChat || isToggling || messages.length === 0) return;
    setIsToggling(true);
    const newClosedState = !isChatClosed;

    const updatedHistory = mutateLastMessage(messages, {
      isChatClosed: newClosedState,
    });
    updateChatDetails(activeChat.phone, { history: updatedHistory });

    try {
      await chatService.updateChatControlStatus(
        activeChat.phone,
        newClosedState,
        activeChat.leadType || "Direct Lead",
      );
      toast.success(
        newClosedState ? "Chat Marked as Closed" : "Chat Marked as Active",
      );
    } catch (error) {
      toast.error("Failed to update Chat Control Status");
      const revertedHistory = mutateLastMessage(messages, {
        isChatClosed: !newClosedState,
      });
      updateChatDetails(activeChat.phone, { history: revertedHistory });
    } finally {
      setIsToggling(false);
    }
  };

  const submitStatusChange = async (newStatus, priority = null) => {
    if (!activeChat) return;

    // 🚀 FIX: If closing the chat, wipe priority. Otherwise, keep the new one (or the old one).
    const targetPriority =
      newStatus === "Closed" ? "" : priority || activeChat.priority;

    const optimisticUpdate = {
      status: newStatus,
      priority: targetPriority,
      isChatClosed: newStatus === "Closed",
      currentHandler: userName,
    };

    const originalChat = { ...activeChat };

    updateChatDetails(activeChat.phone, optimisticUpdate);
    setShowPriorityModal(false);
    setShowClosingModal(false);
    toast.success(`Status updated to ${newStatus}`);

    try {
      await chatService.updateLeadLifecycle({
        phone: activeChat.phone,
        status: newStatus,
        associateEmail: userEmail,
        associateName: userName,
        notes: actionNote,
        priority: targetPriority, // Ensure backend gets the correct priority
      });
    } catch (e) {
      toast.error("Failed to save status. Reverting...");
      updateChatDetails(activeChat.phone, originalChat);
    }
  };

  const handleSend = async (text) => {
    if (!text.trim() || !activeChat) return;
    const tempId = Date.now().toString();
    const newMessage = {
      phone: activeChat.phone,
      message: text,
      direction: "OUTBOUND",
      timestamp: new Date().toISOString(),
      name: activeChat.name,
      status: "Sending",
      role: userRole,
      tempId: tempId,
      isChatClosed: false,
    };

    addMessage(newMessage);
    setSending(true);
    setTimeout(scrollToBottom, 100);

    try {
      const res = await chatService.sendMessage(newMessage);
      updateMessageStatus(activeChat.phone, tempId, "SENT", res?.twilioSid);
    } catch (error) {
      updateMessageStatus(activeChat.phone, tempId, "FAILED");
      toast.error("Message failed to send.");
    } finally {
      setSending(false);
    }
  };

  // 1. handleSendTemplate function-a ChatArea component ulla mathunga:
  const handleSendTemplate = useCallback(
    async (template, variables) => {
      if (!activeChat) return;

      const tempId = Date.now().toString();
      const newMessage = {
        phone: activeChat.phone,
        message: `Template: ${template.name}`,
        direction: "OUTBOUND",
        timestamp: new Date().toISOString(),
        name: activeChat.name,
        status: "Sending",
        role: userRole,
        tempId: tempId,
        isChatClosed: false,
        isTemplate: true,
        templateSid: template.sid,
      };

      addMessage(newMessage);
      setTimeout(scrollToBottom, 100);

      try {
        const res = await chatService.sendTemplateMessage({
          phone: activeChat.phone,
          templateSid: template.sid,
          chatType: activeChat.leadType || "Direct Lead",
          associateName: userName,
          contentVariables: variables, // 🚨 Send variables to API
        });
        updateMessageStatus(activeChat.phone, tempId, "SENT", res?.messageSid);
      } catch (error) {
        updateMessageStatus(activeChat.phone, tempId, "FAILED");
        toast.error("Template failed to send.");
      }
    },
    [activeChat, userName, userRole, addMessage, updateMessageStatus],
  );

  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-full text-slate-300">
        <MessageSquare size={40} className="mb-4" />
        <h1 className="text-2xl font-light">Select a conversation</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full relative bg-[#e5ddd5]/30">
      {/* Modals & Drawers */}
      <CustomerInfoPanel
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />
      <ForwardLeadModal
        isOpen={showForwardModal}
        onClose={() => setShowForwardModal(false)}
        customer={activeChat}
        onConfirm={handleForwardLead}
      />
      <ReminderModal
        isOpen={showReminderModal}
        onClose={() => setShowReminderModal(false)}
        onSet={handleSetReminder}
        initialPhone={activeChat.phone}
      />

      {showPriorityModal && (
        <PriorityModal
          note={actionNote}
          setNote={setActionNote}
          onClose={() => setShowPriorityModal(false)}
          onSubmit={submitStatusChange}
        />
      )}
      {showClosingModal && (
        <ClosingModal
          note={actionNote}
          setNote={setActionNote}
          onClose={() => setShowClosingModal(false)}
          onSubmit={submitStatusChange}
        />
      )}
      {selectedMedia && (
        <MediaViewer
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
        />
      )}

      <ChatHeader
        activeChat={activeChat}
        userName={userName}
        isChatClosed={isChatClosed}
        isToggling={isToggling}
        onToggle={handleToggleChatStatus}
        onStatusChange={(st) => {
          setActionNote("");
          if (st === "Follow Up") setShowPriorityModal(true);
          else if (st === "Closed") setShowClosingModal(true);
          else submitStatusChange(st);
        }}
        onBack={() => setSelectedChat(null)}
        onInfo={() => setIsInfoOpen(true)}
        onReminder={() => setShowReminderModal(true)}
        onForward={() => setShowForwardModal(true)}
      />

      <MessageList
        messages={messages}
        activeChat={activeChat}
        userName={userName}
        scrollRef={scrollContainerRef}
        onScroll={handleScroll}
        onMediaClick={setSelectedMedia}
        endRef={messagesEndRef}
      />

      {showScrollButton && (
        <button
          onClick={scrollToBottom}
          className="fixed bottom-24 right-5 bg-slate-700 text-white p-2 rounded-full shadow-lg z-30"
        >
          <ArrowDown size={20} />
        </button>
      )}

      {isLockedByOther && (
        <div className="absolute inset-0 top-[65px] z-40 bg-white/30 backdrop-blur-[3px] flex flex-col items-center justify-center">
             <div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-red-100 flex items-center gap-3">
                <Lock size={20} className="text-red-500" />
                <span className="font-semibold text-sm">This conversation is locked by {handler.name}</span>
             </div>
        </div>
      )}

      <ChatInput
        onSendMessage={handleSend}
        onSendTemplate={handleSendTemplate}
        sending={sending}
        disabled={isLockedByOther}
      />
    </div>
  );
}
