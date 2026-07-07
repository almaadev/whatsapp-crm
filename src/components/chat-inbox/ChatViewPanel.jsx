import { Lock } from "lucide-react";
import ChatHeader from "@/components/features/chat/ChatHeader";
import MessageList from "@/components/features/chat/MessageList";
import ChatInput from "@/components/features/chat/ChatInput";

/**
 * Renders the main chat view panel, including header, message list, and input.
 *
 * @param {Object} props
 * @param {Object} props.selectedChat - Currently active chat object.
 * @param {Function} props.setSelectedChat - Function to set the active chat (used for back button on mobile).
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
  selectedChat,
  setSelectedChat,
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
            <ChatInput
              onSendMessage={handleSend}
              onSendTemplate={handleSendTemplate}
              sending={sending}
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
