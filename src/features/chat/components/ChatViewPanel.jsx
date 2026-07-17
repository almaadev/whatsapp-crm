import { Lock } from "lucide-react";
import { usePresenceStore } from "@/features/chat/stores/presenceStore";
import ChatHeader from "@/features/chat/components/ChatHeader";
import MessageList from "@/features/chat/components/MessageList";
import ChatInput from "@/features/chat/components/ChatInput";

/**
 * Renders the main chat view panel, including header, message list, and input.
 *
 * @param {Object} props
 * @param {Function} props.useStore - Zustand store hook for the specific category.
 * @param {Object} props.session - NextAuth session object for the current user.
 * @param {boolean} props.isChatClosed - Boolean indicating if the chat is marked as closed.
 * @param {boolean} props.isToggling - Loading state for toggling chat status.
 * @param {Function} props.handleToggleChatStatus - Handler to toggle chat open/closed.
 * @param {Function} props.handleStatusChange - Handler to change chat status (e.g. Lead Status).
 * @param {Function} props.setIsInfoOpen - Function to toggle the customer info side panel.
 * @param {Object} props.config - Configuration object for the category (colors, icons, text).
 * @param {Function} props.handleSend - Handler for sending a text message.
 * @param {Function} props.handleSendTemplate - Handler for sending a WhatsApp template.
 * @param {boolean} props.sending - Loading state for sending messages.
 * @param {Object} props.messagesEndRef - Ref attached to the bottom of the message list for auto-scrolling.
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
}) {
  const { Icon, borderAccent, accentText, emptyTitle } = config;
  const selectedChat = useStore((s) => s.selectedChat);
  const setSelectedChat = useStore((s) => s.setSelectedChat);

  const activeHandlers = usePresenceStore((s) => s.activeHandlers);
  const handler = selectedChat ? activeHandlers[selectedChat.phone] : null;
  const isLockedByOther = handler && handler.userId !== (session?.user?.id || session?.user?.email) && (!handler.lockedUntil || handler.lockedUntil > Date.now());

  return (
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
            {isLockedByOther && (
              <div className="absolute inset-0 top-[65px] z-40 bg-white/30 backdrop-blur-[3px] flex flex-col items-center justify-center">
                   <div className="bg-red-50 text-red-700 px-6 py-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-red-100 flex items-center gap-3">
                      <Lock size={20} className="text-red-500" />
                      <span className="font-semibold text-sm">This conversation is locked by {handler.name || handler.userId}</span>
                   </div>
              </div>
            )}
            <ChatInput
              onSendMessage={handleSend}
              onSendTemplate={handleSendTemplate}
              sending={sending}
              disabled={isLockedByOther}
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
    </div>
  );
}
