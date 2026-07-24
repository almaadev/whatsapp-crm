import { useState, useRef, useEffect, useCallback } from "react";
import { Lock, ArrowDown } from "lucide-react";
import dynamic from "next/dynamic";
import { usePresenceStore } from "@/features/chat/stores/presenceStore";
import ChatHeader from "@/features/chat/components/ChatHeader";
import MessageList from "@/features/chat/components/MessageList";
import ChatInput from "@/features/chat/components/ChatInput";
import ChatLockBanner from "@/features/chat/components/ChatLockBanner";
import { useChatStore } from "@/features/chat/stores/chatStore";

const ForwardLeadModal = dynamic(() => import("@/shared/components/modals/ForwardLeadModal"), { ssr: false });
const ReminderModal = dynamic(() => import("@/shared/components/modals/ReminderModal"), { ssr: false });
const PriorityModal = dynamic(() => import("@/shared/components/modals/PriorityModal"), { ssr: false });
const ClosingModal = dynamic(() => import("@/shared/components/modals/ClosingModal"), { ssr: false });
const MediaViewer = dynamic(() => import("@/features/chat/components/MediaViewer"), { ssr: false });

/**
 * Renders the main chat view panel, including header, message list, input, presence banner, and action modals.
 */
export default function ChatViewPanel({
  useStore,
  session,
  isChatClosed,
  isToggling,
  handleToggleChatStatus,
  handleStatusChange,
  setIsInfoOpen,
  config,
  handleSend,
  handleSendTemplate,
  sending,
  messagesEndRef,
  onFocus,
  onReminder,
  onForward,
  showForwardModal,
  setShowForwardModal,
  showReminderModal,
  setShowReminderModal,
  showPriorityModal,
  setShowPriorityModal,
  showClosingModal,
  setShowClosingModal,
  actionNote,
  setActionNote,
  submitStatusChange,
  handleSetReminder,
  handleForwardLead,
}) {
  const availableNumbers = useChatStore((s) => s.availableNumbers);
  const { Icon, borderAccent, accentText, emptyTitle } = config;
  const selectedChat = useStore((s) => s.selectedChat);
  const setSelectedChat = useStore((s) => s.setSelectedChat);
  const detailedCustomer = useStore((s) => s.detailedCustomer);
  const [selectedMedia, setSelectedMedia] = useState(null);

  const activeHandlers = usePresenceStore((s) => s.activeHandlers);
  const handler = selectedChat ? activeHandlers[selectedChat.phone] : null;
  const isLockedByOther =
    handler &&
    handler.userId !== (session?.user?.id || session?.user?.email) &&
    (!handler.lockedUntil || handler.lockedUntil > Date.now());

  // --- Scroll Handling ---
  const scrollContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevChatPhoneRef = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const chatHistory = selectedChat?.history || [];

  const checkIfNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    const threshold = 150;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }, []);

  const forceScrollToBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef?.current?.scrollIntoView({ behavior: "smooth" });
    isNearBottomRef.current = true;
    setShowScrollButton(false);
  }, [messagesEndRef]);

  // On conversation switch: force instant scroll to bottom
  useEffect(() => {
    const currentPhone = selectedChat?.phone;
    if (currentPhone !== prevChatPhoneRef.current) {
      prevChatPhoneRef.current = currentPhone;
      isNearBottomRef.current = true;
      requestAnimationFrame(() => {
        setTimeout(forceScrollToBottom, 0);
      });
    }
  }, [selectedChat?.phone, forceScrollToBottom]);

  // On new messages: auto-scroll only if user is near the bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollToBottom();
        }, 0);
      });
    }
  }, [chatHistory.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const nearBottom = checkIfNearBottom();
    isNearBottomRef.current = nearBottom;
    setShowScrollButton(!nearBottom);
  }, [checkIfNearBottom]);

  return (
    <div
      className={`flex flex-col bg-white h-full transition-all relative ${
        selectedChat
          ? "fixed inset-0 z-50 md:static md:z-auto flex-1 min-w-[65%] lg:min-w-[70%]"
          : "hidden md:flex flex-1"
      }`}
    >
      {/* Action Modals */}
      {selectedChat && (
        <>
          {showForwardModal && (
            <ForwardLeadModal
              isOpen={showForwardModal}
              onClose={() => setShowForwardModal(false)}
              customer={selectedChat}
              onConfirm={handleForwardLead}
            />
          )}
          {showReminderModal && (
            <ReminderModal
              isOpen={showReminderModal}
              onClose={() => setShowReminderModal(false)}
              onSet={handleSetReminder}
              initialPhone={selectedChat.phone}
            />
          )}
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
        </>
      )}

      {selectedChat ? (
        <>
          <ChatHeader
            activeChat={selectedChat}
            detailedCustomer={detailedCustomer}
            userName={session?.user?.name}
            isChatClosed={isChatClosed}
            isToggling={isToggling}
            onToggle={handleToggleChatStatus}
            onStatusChange={(st) => {
              if (setActionNote) setActionNote("");
              if (st === "Follow Up") setShowPriorityModal?.(true);
              else if (st === "Closed") setShowClosingModal?.(true);
              else if (submitStatusChange) submitStatusChange(st);
              else handleStatusChange(st);
            }}
            onBack={() => setSelectedChat(null)}
            onInfo={() => setIsInfoOpen((prev) => !prev)}
            onReminder={() => (onReminder ? onReminder() : setShowReminderModal?.(true))}
            onForward={() => (onForward ? onForward() : setShowForwardModal?.(true))}
            themeGradient={config.themeGradient}
            themeBadgeClasses={config.themeBadgeClasses}
            themeIconHoverClasses={config.themeIconHoverClasses}
          />

          <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
            <MessageList
              messages={chatHistory}
              activeChat={selectedChat}
              userName={session?.user?.name}
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

            {isLockedByOther && <ChatLockBanner handler={handler} />}
          </div>

          <ChatInput
            onSendMessage={handleSend}
            onSendTemplate={handleSendTemplate}
            sending={sending}
            disabled={isLockedByOther || (availableNumbers.length === 0 && session?.user?.role !== "superAdmin" && session?.user?.department !== "admin")}
            isLockedByOther={isLockedByOther}
            lockHandlerName={session?.user?.role === "superAdmin" ? handler?.name : "another team member"}
            isChatClosed={isChatClosed}
            onFocus={onFocus}
          />
        </>
      ) : (
        <div
          className={`flex-1 flex flex-col items-center justify-center border-b-[6px] ${borderAccent}`}
        >
          <div
            className={`w-24 h-24 bg-white shadow-sm rounded-full flex items-center justify-center mb-6 ${accentText}`}
          >
            <Icon size={40} />
          </div>
          <h2 className="text-3xl font-light text-slate-700 mb-4">{emptyTitle}</h2>
          <p className="text-slate-500 text-sm text-center max-w-[400px]">
            Select a customer from the left to start messaging.
          </p>
          <div className="mt-10 flex items-center gap-1.5 text-xs text-slate-400 font-medium bg-white px-4 py-2 rounded-full shadow-sm">
            <Lock size={12} /> End-to-end encrypted CRM integration
          </div>
        </div>
      )}
    </div>
  );
}
