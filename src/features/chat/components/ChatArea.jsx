"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import api from "@/shared/lib/axios";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useChatStore, isSameConversation } from "@/features/chat/stores/chatStore";
import { usePresenceStore } from "@/features/chat/stores/presenceStore";
import { chatService } from "@/features/chat/services/chatService";
import dynamic from "next/dynamic";

const CustomerInfoPanel = dynamic(() => import("@/features/chat/components/CustomerInfoPanel"), { ssr: false });
const ForwardLeadModal = dynamic(() => import("@/shared/components/modals/ForwardLeadModal"), { ssr: false });
const ReminderModal = dynamic(() => import("@/shared/components/modals/ReminderModal"), { ssr: false });
const PriorityModal = dynamic(() => import("@/shared/components/modals/PriorityModal"), { ssr: false });

import {mutateLastMessage} from "@/shared/utils/chatUtils";

import { toast } from "react-toastify";

import {
  MessageSquare,
  ArrowDown,
} from "lucide-react";

import ChatLockOverlay from "@/features/chat/components/ChatLockOverlay";
import ChatInput from "@/features/chat/components/ChatInput";
import ChatHeader from "@/features/chat/components/ChatHeader";
import MessageList from "@/features/chat/components/MessageList";
import ClosingModal from "@/shared/components/modals/ClosingModal";
import MediaViewer from "@/features/chat/components/media/MediaViewer";

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN CHAT AREA ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatArea({
  customRole = "associate",
  customService = null,
}) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
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
  const isNearBottomRef = useRef(true);
  const prevChatPhoneRef = useRef(null);

  // --- Derived Data ---
  const activeChat =
    allMessages.find((c) => isSameConversation(c, selectedChat)) || selectedChat;
  const messages = activeChat?.history || [];
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;
  const isChatClosed = activeChat?.isClosed ?? true;
  
  const availableNumbers = useChatStore((s) => s.availableNumbers);
  const selectedSender = useChatStore((s) => s.selectedSender);

  const { data: detailedCustomer, isLoading: detailsLoading } = useQuery({
    queryKey: ["detailed-customer", activeChat?.phone],
    queryFn: async () => {
      if (!activeChat?.phone) return null;
      const cleanPhone = activeChat.phone.replace("whatsapp:", "");
      const { data } = await api.get(`/api/leads/${encodeURIComponent(cleanPhone)}?scope=chat`);
      return data && !data.error ? data : null;
    },
    enabled: !!activeChat?.phone,
    staleTime: 0,
  });

  const chronologicalTimeline = useMemo(() => {
    const list = [];
    
    // Add messages
    messages.forEach((msg, idx) => {
      list.push({
        type: "message",
        timestamp: new Date(msg.timestamp || msg.createdAt || 0),
        data: msg,
        key: `msg-${idx}-${msg.timestamp}`
      });
    });

    // Add chatHistory audit entries
    if (detailedCustomer?.chatHistory) {
      detailedCustomer.chatHistory.forEach((audit, idx) => {
        list.push({
          type: "audit",
          timestamp: new Date(audit.timestamp),
          data: audit,
          key: `audit-${idx}-${audit.timestamp}`
        });
      });
    }

    // Sort chronologically
    return list.sort((a, b) => a.timestamp - b.timestamp);
  }, [messages, detailedCustomer?.chatHistory]);

  const activeHandlers = usePresenceStore((s) => s.activeHandlers);
  const handler = activeChat ? activeHandlers[activeChat.phone] : null;
  const isLockedByOther = handler && handler.userId !== (session?.user?.id || session?.user?.email) && (!handler.lockedUntil || handler.lockedUntil > Date.now());

  // --- Scroll Handling ---

  // Helper: check if user is near the bottom of the scroll container
  const checkIfNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const threshold = 150; // px from bottom
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  // Force-scroll to bottom instantly (no animation) — used on conversation switch
  const forceScrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  // Smooth-scroll to bottom — used for new messages & user-triggered scroll
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  // On conversation switch: always force-scroll to bottom instantly
  // Uses staggered attempts to handle async DOM rendering (images, templates, etc.)
  useEffect(() => {
    const currentPhone = activeChat?.phone;
    if (currentPhone !== prevChatPhoneRef.current) {
      prevChatPhoneRef.current = currentPhone;
      isNearBottomRef.current = true;
      // Staggered scroll attempts to catch late-rendering content
      const timers = [
        setTimeout(forceScrollToBottom, 0),
        setTimeout(forceScrollToBottom, 100),
        setTimeout(forceScrollToBottom, 300),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [activeChat?.phone, forceScrollToBottom]);

  // On timeline changes (new messages OR async audit entries loading):
  // auto-scroll only if user was already near the bottom
  useEffect(() => {
    if (chronologicalTimeline.length === 0) return;
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        setTimeout(forceScrollToBottom, 0);
      });
    }
  }, [chronologicalTimeline.length, forceScrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const nearBottom = checkIfNearBottom();
    isNearBottomRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
  }, [checkIfNearBottom]);

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
      queryClient.invalidateQueries({ queryKey: ["detailed-customer", activeChat.phone] });
    } catch (e) {
      toast.error("Error forwarding lead.");
    }
  };

  const handleToggleChatStatus = async () => {
    if (!activeChat || isToggling) return;
    setIsToggling(true);
    const newClosedState = !isChatClosed;

    if (messages.length > 0) {
      const updatedHistory = mutateLastMessage(messages, {
        isChatClosed: newClosedState,
      });
      updateChatDetails(activeChat.phone, { history: updatedHistory, isClosed: newClosedState, isChatClosed: newClosedState });
    } else {
      updateChatDetails(activeChat.phone, { isClosed: newClosedState, isChatClosed: newClosedState });
    }

    try {
      await chatService.updateChatControlStatus(
        activeChat.phone,
        newClosedState,
        activeChat.leadType || "Direct Lead",
      );
      toast.success(
        newClosedState ? "Chat Marked as Closed" : "Chat Marked as Active",
      );
      queryClient.invalidateQueries({ queryKey: ["detailed-customer", activeChat.phone] });
    } catch (error) {
      toast.error("Failed to update Chat Control Status");
      if (messages.length > 0) {
        const revertedHistory = mutateLastMessage(messages, {
          isChatClosed: !newClosedState,
        });
        updateChatDetails(activeChat.phone, { history: revertedHistory, isClosed: !newClosedState, isChatClosed: !newClosedState });
      } else {
        updateChatDetails(activeChat.phone, { isClosed: !newClosedState, isChatClosed: !newClosedState });
      }
    } finally {
      setIsToggling(false);
    }
  };

  const submitStatusChange = async (newStatus, priority = null) => {
    if (!activeChat) return;

    // If closing the lead, wipe priority. Otherwise, keep the new one (or the old one).
    const targetPriority =
      (newStatus === "Closed" || newStatus === "Not Interested") ? "" : priority || activeChat.priority;

    setShowPriorityModal(false);
    setShowClosingModal(false);

    try {
      const res = await chatService.updateLeadLifecycle({
        phone: activeChat.phone,
        leadId: detailedCustomer?.leadId,
        customerId: detailedCustomer?.customerId,
        status: newStatus,
        associateEmail: userEmail,
        associateName: userName,
        notes: actionNote,
        priority: targetPriority,
      });

      const confirmedStatus = res?.status || newStatus;
      const confirmedPriority = res?.lead?.priority || targetPriority;

      // Update the local state with the server-confirmed values
      updateChatDetails(activeChat.phone, {
        status: confirmedStatus,
        priority: confirmedPriority,
        currentHandler: userName,
      });

      toast.success(`Status updated to ${confirmedStatus}`);

      // Invalidate queries to fetch fresh status and activities
      queryClient.invalidateQueries({ queryKey: ["detailed-customer", activeChat.phone] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    } catch (e) {
      console.error("[LeadStatus UI] Failed to save status:", e);
      toast.error(e.response?.data?.error || e.message || "Failed to save status.");
    }
  };

  const handleSend = async (text, mediaPayload = null) => {
    if ((!text?.trim() && !mediaPayload) || !activeChat) return;
    const tempId = Date.now().toString();
    const newMessage = {
      customerId: activeChat.customerId,
      phone: activeChat.phone,
      canonicalPhone: activeChat.canonicalPhone,
      message: text || "",
      direction: "OUTBOUND",
      timestamp: new Date().toISOString(),
      name: activeChat.name,
      status: "Sending",
      role: userRole,
      tempId: tempId,
      senderNumber: selectedSender,
      isChatClosed: false,
      mediaId: mediaPayload?.mediaId || mediaPayload?.media?.id || mediaPayload?.media?._id || "",
      mediaUrl: mediaPayload?.mediaUrl || "",
      mediaType: mediaPayload?.mediaType || "",
      media: mediaPayload?.media || null,
      messageType: mediaPayload?.messageType || (mediaPayload?.mediaUrl ? "image" : "text"),
      sendBy: {
        _id: session?.user?.id || session?.user?._id,
        name: session?.user?.name || userName,
      },
    };

    addMessage(newMessage);
    setSending(true);
    setTimeout(scrollToBottom, 100);

    try {
      const res = await chatService.sendMessage(newMessage);
      // API returns { success, message, data: { twilioSid, ... } }
      const twilioSid = res?.data?.twilioSid || res?.twilioSid;
      updateMessageStatus(activeChat.phone, tempId, "SENT", twilioSid);
      return res;
    } catch (error) {
      updateMessageStatus(activeChat.phone, tempId, "FAILED");
      const errMsg = error?.response?.data?.message || error?.message || "Message failed to send.";
      toast.error(errMsg);
      throw error;
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
        sendBy: {
          _id: session?.user?.id || session?.user?._id,
          name: session?.user?.name || userName,
        },
      };

      addMessage(newMessage);
      setTimeout(scrollToBottom, 100);

      try {
        const res = await chatService.sendTemplateMessage({
          phone: activeChat.phone,
          templateSid: template.sid,
          chatType: activeChat.leadType || "Direct Lead",
          associateName: userName,
          contentVariables: variables,
          senderNumber: selectedSender,
        });
        updateMessageStatus(activeChat.phone, tempId, "SENT", res?.messageSid);
        queryClient.invalidateQueries({ queryKey: ["detailed-customer", activeChat.phone] });
      } catch (error) {
        updateMessageStatus(activeChat.phone, tempId, "FAILED");
        toast.error("Template failed to send.");
      }
    },
    [activeChat, userName, userRole, addMessage, updateMessageStatus, selectedSender],
  );

  const handleSendCRMTemplate = useCallback(
    async (crmTemplate, resolvedPreview) => {
      if (!activeChat || sending) return;

      const tempId = Date.now().toString();
      const initialMessageText = (resolvedPreview && resolvedPreview.trim()) || `CRM Template: ${crmTemplate.name}`;
      const newMessage = {
        customerId: activeChat.customerId,
        phone: activeChat.phone,
        canonicalPhone: activeChat.canonicalPhone,
        message: initialMessageText,
        direction: "OUTBOUND",
        timestamp: new Date().toISOString(),
        name: activeChat.name,
        status: "Sending",
        role: userRole,
        tempId: tempId,
        senderNumber: selectedSender,
        isChatClosed: false,
        isTemplate: true,
        templateMetadata: {
          type: "crm",
          templateId: crmTemplate._id,
          templateName: crmTemplate.name,
          version: crmTemplate.version || 1,
          source: "manual",
        },
        sendBy: {
          _id: session?.user?.id || session?.user?._id,
          name: session?.user?.name || userName,
        },
      };

      addMessage(newMessage);
      setSending(true);
      setTimeout(scrollToBottom, 100);

      try {
        const { crmTemplateRepository } = await import("@/shared/api/repositories/crmTemplateRepository");
        const res = await crmTemplateRepository.sendCRMTemplate({
          phone: activeChat.phone,
          templateId: crmTemplate._id,
          senderNumber: selectedSender,
          chatType: activeChat.leadType || "Direct Lead",
        });

        const twilioSid = res?.data?.data?.twilioSid || res?.data?.twilioSid;
        const resolvedText = res?.data?.data?.resolvedText || res?.data?.resolvedText;
        if (resolvedText) {
          newMessage.message = resolvedText;
        }
        updateMessageStatus(activeChat.phone, tempId, "SENT", twilioSid);
        toast.success("CRM Template sent successfully!");
      } catch (error) {
        updateMessageStatus(activeChat.phone, tempId, "FAILED");
        const errMsg = error.response?.data?.error || error.message || "Failed to send CRM template.";
        toast.error(errMsg);
      } finally {
        setSending(false);
      }
    },
    [activeChat, userName, userRole, addMessage, updateMessageStatus, selectedSender, session, sending]
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
    <div className="flex flex-row h-full w-full relative overflow-hidden bg-slate-50">
      {/* Modals & Overlay Drawers */}
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

      {/* Main Messaging View Column */}
      <div className="flex-1 flex flex-col h-full min-w-[65%] lg:min-w-[70%] relative">
        <ChatHeader
          activeChat={activeChat}
          detailedCustomer={detailedCustomer}
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
          onInfo={() => setIsInfoOpen(!isInfoOpen)}
          onReminder={() => setShowReminderModal(true)}
          onForward={() => setShowForwardModal(true)}
        />

        <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
          <MessageList
            messages={chronologicalTimeline}
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
              className="absolute bottom-6 right-5 bg-slate-700 text-white p-2 rounded-full shadow-lg z-30 animate-bounce"
            >
              <ArrowDown size={20} />
            </button>
          )}

          {isLockedByOther && <ChatLockOverlay handler={handler} />}
        </div>

        <ChatInput
          onSendMessage={handleSend}
          onSendTemplate={handleSendTemplate}
          onSendCRMTemplate={handleSendCRMTemplate}
          activeChat={activeChat}
          customerContext={detailedCustomer}
          sending={sending}
          disabled={isLockedByOther || (availableNumbers.length === 0 && session?.user?.role !== "superAdmin" && session?.user?.department !== "admin")}
          isLockedByOther={isLockedByOther}
          lockHandlerName={session?.user?.role === "superAdmin" ? handler?.name : "another team member"}
          isChatClosed={isChatClosed}
          onFocus={() => {
            setTimeout(scrollToBottom, 150);
          }}
        />
      </div>

      {/* Customer Info Panel (Persistent Right Sidebar Column) */}
      <CustomerInfoPanel
        isOpen={isInfoOpen}
        onClose={() => setIsInfoOpen(false)}
      />
    </div>
  );
}
