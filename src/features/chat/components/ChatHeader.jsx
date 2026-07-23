import React, { useState, memo } from "react";
import { ChevronLeft,ChevronDown, Bell, Share2, Info, Tag, MapPin, MoreVertical, Smartphone, Building2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePresenceStore } from "@/features/chat/stores/presenceStore";

const ChatHeader = memo(function ChatHeader({
  activeChat,
  detailedCustomer,
  isChatClosed,
  isToggling,
  onToggle,
  onStatusChange,
  onBack,
  onInfo,
  onReminder,
  onForward,
  availableNumbers = [],
  selectedSender = "",
  onSelectSender,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [senderMenuOpen, setSenderMenuOpen] = useState(false);

  const { data: session } = useSession();
  const activeHandlers = usePresenceStore((s) => s.activeHandlers);
  const handler = activeChat ? activeHandlers[activeChat.phone] : null;
  const isHandledActive = handler && (!handler.lockedUntil || handler.lockedUntil > Date.now());
  const currentUserIdentifier = session?.user?.id || session?.user?.email;
  const handledBySelf = isHandledActive && handler.userId === currentUserIdentifier;
  const isCloseDisabled = isHandledActive && !handledBySelf;

  if (!activeChat) return null;

  const displayName = activeChat?.name || (activeChat?.phone ? activeChat.phone.replace("whatsapp:", "") : "Unknown");
  const location = detailedCustomer?.city || activeChat?.city || "No City Info";
  const branchName = detailedCustomer?.branchName || activeChat?.branchName || "Unassigned Branch";
  
  const receivedOn = detailedCustomer?.lastIncomingNumber || activeChat?.receivedOnNumber;

  const activeSenderDoc = (availableNumbers || []).find(
    (n) => n.phoneNumber === selectedSender || `whatsapp:${n.phoneNumber}` === selectedSender
  ) || availableNumbers?.[0];

  const history = activeChat?.history || [];
  const lastHistoryMsg = history.length > 0 ? history[history.length - 1] : null;

  const hasStatusHistory = Boolean(
    lastHistoryMsg?.status === "Follow Up" ||
    lastHistoryMsg?.status === "Closed" ||
    lastHistoryMsg?.status === "Not Interested"
  );

  const statusOptions = hasStatusHistory
    ? ["Follow Up", "Closed", "Not Interested"]
    : ["New", "Follow Up", "Closed", "Not Interested"];

  return (
    <div className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex items-center justify-between shadow-sm z-20 select-none">
      <div className="flex items-center gap-3.5 min-w-0">
        <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center gap-3 cursor-pointer min-w-0" onClick={onInfo}>
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500 flex items-center justify-center text-white font-extrabold text-base shrink-0 shadow-sm uppercase">
            {displayName.charAt(0)}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-slate-800 text-base truncate">{displayName}</h2>
              {/* Active/Closed Status */}
              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border shadow-sm shrink-0
                ${isChatClosed 
                  ? "bg-rose-50 text-rose-700 border-rose-200" 
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }
              `}>
                <span className={`w-1.5 h-1.5 rounded-full ${isChatClosed ? "bg-rose-500" : "bg-emerald-500 animate-pulse"}`} />
                {isChatClosed ? "Closed" : "Active"}
              </span>

              {/* Received On Business Number Badge */}
              {receivedOn && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  <Smartphone size={10} className="text-emerald-600" />
                  Received on: {receivedOn}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400 mt-0.5">
              <span>{activeChat.phone?.replace("whatsapp:", "")}</span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="hidden sm:inline-flex items-center gap-0.5 font-medium text-slate-500">
                <MapPin size={11} className="text-slate-400" />
                {location}
              </span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="hidden sm:inline-flex items-center gap-0.5 font-medium text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                <Building2 size={10} />
                {branchName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop/Tablet Actions */}
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {/* Outgoing Sender Number Component (Super Admin / Admin / Associate) */}
        {(() => {
          const { useSession } = require("next-auth/react");
          const { data: session } = useSession();
          const isSuperAdmin = session?.user?.role === "superAdmin";
          const isAdmin = session?.user?.department === "admin" || session?.user?.role === "admin";
          const isAssociate = !isSuperAdmin && !isAdmin;

          if (availableNumbers.length === 0) {
            return (
              <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-sm select-none">
                <span>No WhatsApp sender assigned. Contact administrator.</span>
              </div>
            );
          }

          // Associate with ONLY 1 assigned sender -> Hide dropdown, show static badge
          if (isAssociate && availableNumbers.length === 1) {
            const singleSender = activeSenderDoc || availableNumbers[0];
            return (
              <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm select-none">
                <Smartphone size={13} className="text-emerald-600 shrink-0" />
                <span className="truncate">
                   <strong className="text-slate-900">{singleSender.friendlyName}</strong> ({singleSender.phoneNumber})
                </span>
              </div>
            );
          }

          // Multi-number dropdown (Super Admin, Admin, or Associate with multiple senders)
          return (
            <div className="relative">
              <button
                onClick={() => setSenderMenuOpen(!senderMenuOpen)}
                className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Select Outgoing WhatsApp Sender Number"
              >
                <Smartphone size={13} className="text-emerald-600" />
                <span>
                  {activeSenderDoc ? `${activeSenderDoc.friendlyName} (${activeSenderDoc.phoneNumber})` : "Select Sender"}
                </span>
                <ChevronDown size={14} className="text-emerald-600" />
              </button>
              {senderMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 font-semibold text-xs text-slate-700">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    {isSuperAdmin
                      ? "All System Senders (Super Admin)"
                      : isAdmin
                      ? "Assigned Senders (Admin)"
                      : "Your Assigned Senders"}
                  </div>
                  {availableNumbers.map((num) => {
                    const isSelected =
                      selectedSender === num.phoneNumber || selectedSender === `whatsapp:${num.phoneNumber}`;
                    return (
                      <button
                        key={num._id || num.phoneNumber}
                        onClick={() => {
                          if (onSelectSender) onSelectSender(num.phoneNumber);
                          setSenderMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors flex flex-col gap-0.5 cursor-pointer ${
                          isSelected ? "bg-emerald-50/70 border-l-4 border-emerald-500" : ""
                        }`}
                      >
                        <span className="font-bold text-slate-800 flex items-center justify-between">
                          {num.friendlyName}
                          {isSelected && <span className="text-[10px] text-emerald-600 font-extrabold">Active</span>}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {num.phoneNumber}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Toggle Status Controls */}
        <div className="relative group">
          <button
            onClick={onToggle}
            disabled={isToggling || (!isChatClosed && isCloseDisabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm
              ${isChatClosed
                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
                : (!isChatClosed && isCloseDisabled)
                  ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-75"
                  : "bg-white text-slate-650 hover:text-slate-800 border-slate-200 hover:bg-slate-50"
              }
            `}
            title={(!isChatClosed && isCloseDisabled) ? `${handler?.name || "Another user"} is currently handling this chat.` : ""}
          >
            {isToggling ? (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isChatClosed ? (
              "Reopen Chat"
            ) : (!isChatClosed && isCloseDisabled) ? (
              <span className="flex items-center gap-1 select-none">
                🔒 Close Chat
              </span>
            ) : (
              "Close Chat"
            )}
          </button>
          {!isChatClosed && isCloseDisabled && (
            <span className="absolute hidden group-hover:block whitespace-nowrap bg-slate-800 text-white text-[10px] px-2.5 py-1 rounded-md -bottom-8 right-0 z-30 font-semibold shadow-md">
              🔒 {handler?.name || "Another user"} is currently handling this chat.
            </span>
          )}
        </div>

        {/* Lifecycle Status Select */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors shadow-sm"
            title="Change Lifecycle Status"
          >
            <Tag size={12} className="text-slate-400" />
            <span>{activeChat.status || "New"}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95 font-semibold text-xs text-slate-700">
              {statusOptions.map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    onStatusChange(st);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors"
                >
                  {st}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <button
          onClick={onReminder}
          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all *:cursor-not-allowed"
          disabled={true}
          title="Set Follow-up Reminder"
        >
          <Bell size={18} />
        </button>

        <button
          onClick={onForward}
          className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all *:cursor-not-allowed"
          disabled={true}
          title="Transfer Lead"
        >
          <Share2 size={18} />
        </button>

        <button
          onClick={onInfo}
          className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
          title="View Details & Notes"
        >
          <Info size={18} />
        </button>
      </div>

      {/* Mobile Actions Dropdown */}
      <div className="flex sm:hidden items-center gap-1.5 shrink-0 relative">
        <button
          onClick={() => setActionsMenuOpen(!actionsMenuOpen)}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all border border-slate-200/50 shadow-sm"
          title="More Actions"
        >
          <MoreVertical size={18} />
        </button>

        {actionsMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-100 py-1.5 z-[70] animate-in fade-in zoom-in-95 font-semibold text-xs text-slate-700 flex flex-col">
            <button
              onClick={() => {
                if (isChatClosed || !isCloseDisabled) {
                  onToggle();
                }
                setActionsMenuOpen(false);
              }}
              disabled={!isChatClosed && isCloseDisabled}
              className={`w-full text-left px-4 py-2.5 transition-colors flex items-center gap-2
                ${(!isChatClosed && isCloseDisabled)
                  ? "text-slate-400 cursor-not-allowed bg-slate-50/50"
                  : "hover:bg-slate-50 text-slate-700"
                }
              `}
              title={(!isChatClosed && isCloseDisabled) ? `${handler?.name || "Another user"} is currently handling this chat.` : ""}
            >
              {isChatClosed ? "Reopen Chat" : (!isChatClosed && isCloseDisabled) ? "🔒 Close Chat (Locked)" : "Close Chat"}
            </button>

            <div className="border-t border-slate-100 my-1" />
            <span className="px-4 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Set Status:
            </span>
            {["New", "Follow Up", "Closed", "Not Interested"].map((st) => (
              <button
                key={st}
                onClick={() => {
                  onStatusChange(st);
                  setActionsMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors
                  ${activeChat.status === st ? "text-[#00a884] font-extrabold" : ""}
                `}
              >
                {st}
              </button>
            ))}

            <div className="border-t border-slate-100 my-1" />

            <button
              onClick={() => {
                onInfo();
                setActionsMenuOpen(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors"
            >
              View Info & Notes
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default ChatHeader;
