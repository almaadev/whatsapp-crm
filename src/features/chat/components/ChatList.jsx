"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStore, isSameConversation } from "@/features/chat/stores/chatStore";
import { usePresenceStore } from "@/features/chat/stores/presenceStore";
import { useSession } from "next-auth/react";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { normalizePhone } from "@/shared/utils/phoneUtils";

import Link from "next/link";
import {
  Search,
  PlusCircle,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  ChevronDown,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";
import { chatRepository } from "@/shared/api/repositories/chatRepository";
import { customerRepository } from "@/shared/api/repositories/customerRepository";
import { getChatMessagePreview } from "@/shared/utils/chatDisplay";

const getAvatarGradient = (name) => {
  const char = name ? name.charCodeAt(0) : 65;
  const gradients = [
    "bg-gradient-to-tr from-blue-400 to-indigo-500",
    "bg-gradient-to-tr from-emerald-400 to-teal-500",
    "bg-gradient-to-tr from-violet-400 to-purple-500",
    "bg-gradient-to-tr from-rose-400 to-pink-500",
    "bg-gradient-to-tr from-amber-400 to-orange-500",
    "bg-gradient-to-tr from-sky-400 to-cyan-500",
  ];
  return gradients[char % gradients.length];
};

export default function ChatList({ role, loading, error = null, onRetry = null }) {
  const queryClient = useQueryClient();
  const messages = useChatStore((s) => s.messages);

  const { selectedChat, setSelectedChat, updateChatDetails } = useChatStore();
  const activeHandlers = usePresenceStore((s) => s.activeHandlers);
  const { data: session } = useSession();

  const [searchTerm, setSearchTerm] = useState("");
  const [allCustomers, setAllCustomers] = useState(null);

  // 👇 States for Deletion functionality
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState(new Set());
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [activeChatMenu, setActiveChatMenu] = useState(null);

  // 👇 New Custom Modal States
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, chats: [] });
  const [isDeleting, setIsDeleting] = useState(false);

  const [activeFilter, setActiveFilter] = useState("All");

  const [visibleCount, setVisibleCount] = useState(30);
  const listContainerRef = useRef(null);

  useEffect(() => {
    const el = listContainerRef.current;
    if (!el) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 100) {
        setVisibleCount((prev) => prev + 20);
      }
    };
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (searchTerm.length > 0 && !allCustomers) {
      customerRepository
        .getCustomers()
        .then(({ data }) => setAllCustomers(Array.isArray(data) ? data : []))
        .catch((err) => console.error("Failed to fetch customers", err));
    }
  }, [searchTerm, allCustomers]);

  const getPriorityStyles = (priority, isUnread) => {
    if (isUnread) return "bg-emerald-50/40 border-l-emerald-400/50";

    switch (priority?.toLowerCase()) {
      case "high":
        return "bg-red-50/30 border-l-red-400/50 hover:bg-red-50/50";
      case "medium":
        return "bg-amber-50/30 border-l-amber-400/50 hover:bg-amber-50/50";
      default:
        return "bg-white border-l-transparent hover:bg-slate-50";
    }
  };

  const parseDate = (dateString) => {
    if (!dateString) return new Date(0);
    if (
      dateString.includes("T") ||
      (dateString.includes("-") && dateString.includes(":"))
    ) {
      return new Date(dateString);
    }
    const parts = dateString.split(" ");
    if (parts.length >= 2) {
      const dateParts = parts[0].split("/");
      const timeParts = parts[1].split(":");
      if (dateParts.length === 3) {
        return new Date(
          parseInt(dateParts[2]),
          parseInt(dateParts[0]) - 1,
          parseInt(dateParts[1]),
          parseInt(timeParts[0] || 0),
          parseInt(timeParts[1] || 0),
          parseInt(timeParts[2] || 0),
        );
      }
    }
    return new Date(dateString);
  };

  const formatTimeDisplay = (dateObj) => {
    if (isNaN(dateObj.getTime())) return "";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
    );
    const diffTime = today - msgDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0)
      return dateObj
        .toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .toLowerCase();
    if (diffDays === 1) return "Yesterday";
    if (diffDays > 1 && diffDays < 7)
      return dateObj.toLocaleDateString([], { weekday: "long" });

    const d = String(dateObj.getDate()).padStart(2, "0");
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const y = String(dateObj.getFullYear()).slice(-2);
    return `${d}/${m}/${y}`;
  };

  const handleChatClick = async (chat) => {
    setSelectedChat(chat);
    if (chat.direction === "INBOUND" && chat.read === "FALSE") {
      updateChatDetails(chat.phone, { read: "TRUE" });
      try {
        await chatRepository.markRead({ phone: chat.phone });
      } catch (err) {
        console.error("Failed to mark chat as read", err);
      }
    }
  };

  const handleCustomerClick = (customer) => {
    const cleanPhone = normalizePhone(customer.phone || "");

    setSelectedChat({
      phone: cleanPhone,
      name: customer.name || "Unknown",
      message: "",
      direction: "OUTBOUND",
      status: customer.status || "New",
      priority: customer.priority || "Medium",
      read: "TRUE",
      timestamp: new Date().toISOString(),
    });
    setSearchTerm("");
  };

  // You can pass customer.activeRouteCategory or chat.chatType as the prop
  const InboxSourceBadge = ({ sourceType }) => {
    const config = {
      "Direct Lead": {
        color: "bg-slate-100 text-slate-800",
        dot: "bg-slate-500",
        label: "General Inbox",
      },
    };

    const style = config[sourceType] || config["Direct Lead"];

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${style.color}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`}></span>
        {style.label}
      </span>
    );
  };

  // 👇 API Functions to trigger and confirm deletion
  const triggerDelete = (chatsArray) => {
    if (!Array.isArray(chatsArray) || chatsArray.length === 0) return;
    setDeleteModal({ isOpen: true, chats: chatsArray });
  };

  const confirmDelete = async () => {
    if (isDeleting || !deleteModal.chats || deleteModal.chats.length === 0) return;
    const chatsToDelete = deleteModal.chats;
    setIsDeleting(true);

    try {
      const customerIds = chatsToDelete.map((c) => c.customerId).filter(Boolean);
      const phones = chatsToDelete.map((c) => c.phone).filter(Boolean);

      const { data: res } = await chatRepository.deleteChats({ customerIds, phones });

      if (res?.success) {
        // 1. Remove from Zustand chat store
        useChatStore.getState().removeConversations({ customerIds, phones });

        // 2. Clear selectedChat if it was among deleted
        if (selectedChat && chatsToDelete.some((c) => isSameConversation(c, selectedChat))) {
          setSelectedChat(null);
        }

        // 3. Reset local selection and modal state
        setIsSelectionMode(false);
        setSelectedPhones(new Set());
        setActiveChatMenu(null);
        setDeleteModal({ isOpen: false, chats: [] });

        // 4. Invalidate React Query caches
        try {
          queryClient.invalidateQueries({ queryKey: ["chats"] });
          queryClient.invalidateQueries({ queryKey: ["leads"] });
          queryClient.invalidateQueries({ queryKey: ["customers"] });
          queryClient.invalidateQueries({ queryKey: ["detailed-customer"] });
        } catch (queryErr) {
          console.error("Cache invalidation error:", queryErr);
        }
      } else {
        alert(res?.message || "Failed to delete chat.");
      }
    } catch (err) {
      console.error("Delete Error", err);
      const errMsg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An error occurred while deleting.";
      alert(errMsg);
    } finally {
      setIsDeleting(false);
    }
  };

  const groupedChats = useMemo(() => {
    const filtered = messages.filter((chat) => {
      const term = searchTerm.toLowerCase();
      const name = (chat.name || "").toLowerCase();
      const phone = (chat.phone || "").toLowerCase();
      const matchesSearch = name.includes(term) || phone.includes(term);
      if (!matchesSearch) return false;

      // Filter by tab
      const isClosed = chat.isClosed || chat.isChatClosed;
      if (activeFilter === "Active") {
        return !isClosed;
      }
      if (activeFilter === "Closed") {
        return isClosed;
      }
      if (activeFilter === "Follow Up") {
        return chat.status === "Follow Up";
      }
      return true;
    });

    const sorted = filtered.sort((a, b) => {
      return (
        parseDate(b.lastSeenAt || b.timestamp) -
        parseDate(a.lastSeenAt || a.timestamp)
      );
    });

    // Lazy load pagination slice
    const sliced = sorted.slice(0, visibleCount);

    const groups = { today: [], yesterday: [], older: [] };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    sliced.forEach((chat) => {
      const chatDateRaw = parseDate(chat.lastSeenAt || chat.timestamp);
      const chatDateOnly = new Date(
        chatDateRaw.getFullYear(),
        chatDateRaw.getMonth(),
        chatDateRaw.getDate(),
      );
      const diffTime = today - chatDateOnly;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) groups.today.push(chat);
      else if (diffDays === 1) groups.yesterday.push(chat);
      else groups.older.push(chat);
    });

    return groups;
  }, [messages, searchTerm, activeFilter, visibleCount]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm || !allCustomers) return [];
    const term = searchTerm.toLowerCase();

    const existingPhones = new Set(
      messages.map((m) => normalizePhone(m.phone || "")),
    );

    return allCustomers.filter((c) => {
      const phoneStr = normalizePhone(c.phone || "");
      const nameStr = (c.name || "").toLowerCase();

      const matches = nameStr.includes(term) || phoneStr.includes(term);
      const notInChats = !existingPhones.has(phoneStr);

      return matches && notInChats;
    });
  }, [searchTerm, allCustomers, messages]);

  const renderChatGroup = (title, chats) => {
    if (chats.length === 0) return null;

    return (
      <div className="mb-4">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-2.5 z-10 border-b border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest">
            {title}
          </span>
          <span className="bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded-full text-[9px]">
            {chats.length}
          </span>
        </div>
        <div className="space-y-1.5 pt-2">
          {chats.map((chat, index) => {
            const isSelected = isSameConversation(selectedChat, chat);
            const isUnread =
              !isSelected &&
              chat.direction === "INBOUND" &&
              chat.read === "FALSE";
            const handler = activeHandlers[chat.phone];

            const isBeingHandledByOther =
              handler &&
              handler.userId !== (session?.user?.id || session?.user?.email) &&
              (!handler.lockedUntil || handler.lockedUntil > Date.now());


            const displayName = resolveCustomerDisplayName(chat);
            const dateObj = parseDate(chat.lastSeenAt || chat.timestamp);

            const isClosed = chat.status === "Closed";

            return (
              <div
                key={chat.customerId || chat.phone || index}
                onClick={(e) => {
                  if (isSelectionMode) {
                    e.preventDefault();
                    e.stopPropagation();
                    const newSet = new Set(selectedPhones);
                    if (newSet.has(chat.phone)) newSet.delete(chat.phone);
                    else newSet.add(chat.phone);
                    setSelectedPhones(newSet);
                  } else {
                    handleChatClick(chat);
                  }
                }}
                onMouseLeave={() => setActiveChatMenu(null)}
                className={`
                  relative flex items-start gap-3.5 mx-3.5 my-1 p-3.5 rounded-2xl cursor-pointer border transition-all duration-200 select-none group
                  ${
                    isSelected
                      ? "bg-emerald-50/60 border-emerald-200/80 shadow-sm shadow-emerald-100/20"
                      : "bg-white border-slate-100 hover:bg-slate-50/50 hover:border-slate-200/50 hover:shadow-sm"
                  }
                `}
              >
                {isSelectionMode && (
                  <div className="flex items-center self-center shrink-0 mr-1.5">
                    <input
                      type="checkbox"
                      checked={selectedPhones.has(chat.phone)}
                      readOnly
                      className="w-4 h-4 rounded border-slate-300 text-[#00a884] focus:ring-[#00a884] cursor-pointer"
                    />
                  </div>
                )}

                <div className="relative shrink-0">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-extrabold text-sm shadow-sm transition-transform group-hover:scale-105 uppercase tracking-wide
                      ${isUnread ? "shadow-emerald-200" : ""}
                      ${getAvatarGradient(displayName)}
                    `}
                  >
                    {displayName.charAt(0) ==="+" ? displayName.charAt(3) : displayName.charAt(0)}
                  </div>
                  {/* Status Indicator Dot */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm flex items-center justify-center
                    ${isClosed ? "bg-slate-300" : "bg-emerald-500"}
                  `}
                    title={isClosed ? "Closed" : "Active"}
                  />
                </div>

                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex justify-between items-baseline mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`truncate text-sm ${isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}
                      >
                        {displayName}
                      </span>

                      {chat.priority &&
                        chat.priority.toLowerCase() === "high" && (
                          <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-100">
                            <AlertCircle size={8} className="stroke-[3]" /> High
                          </span>
                        )}
                      {chat.priority &&
                        chat.priority.toLowerCase() === "medium" && (
                          <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">
                            Medium
                          </span>
                        )}
                    </div>

                    <span
                      className={`text-[10px] shrink-0 ml-2 ${isUnread ? "text-emerald-600 font-bold" : "text-slate-400"}`}
                    >
                      {formatTimeDisplay(dateObj)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pr-3 min-w-0">
                    <p
                      className={`text-xs truncate flex-1 min-w-0 pr-2 ${isUnread ? "text-slate-900 font-bold" : "text-slate-500"}`}
                    >
                      {getChatMessagePreview(chat, session?.user)}
                    </p>

                    {chat.categoryLabel && (
                      <span className="inline-block bg-indigo-50 text-indigo-650 text-[9px] font-bold px-2 py-0.5 rounded-md border border-indigo-100">
                        {chat.categoryLabel}
                      </span>
                    )}

                    <div className="flex items-center gap-1 shrink-0">
                      {chat.direction === "OUTBOUND" &&
                        (() => {
                          const msgStat = (
                            chat.messageStatus || ""
                          ).toUpperCase();
                          if (msgStat === "SENDING")
                            return (
                              <Clock size={12} className="text-slate-400" />
                            );
                          if (msgStat === "SENT")
                            return (
                              <Check size={14} className="text-slate-400" />
                            );
                          if (msgStat === "DELIVERED")
                            return (
                              <CheckCheck
                                size={14}
                                className="text-slate-400"
                              />
                            );
                          if (msgStat === "READ")
                            return (
                              <CheckCheck size={14} className="text-blue-500" />
                            );
                          if (msgStat === "FAILED")
                            return (
                              <AlertCircle size={12} className="text-red-500" />
                            );
                          return null;
                        })()}
                    </div>
                  </div>

                  {/* Handles dynamically displayed creator / timeline details */}
                  {chat.lastHandled && (
                    <div className="mt-2 flex items-center justify-between gap-1 select-none leading-none">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-[10px] font-medium">
                          Last Handled:
                        </span>
                        <span className="text-slate-650 bg-slate-100 border border-slate-200/60 px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                          {(() => {
                            const isSuperAdmin =
                              session?.user?.role === "superAdmin";
                            const isMe =
                              chat.lastHandled.isCurrentHandler ||
                              chat.lastHandled.name === session?.user?.name;
                            if (isSuperAdmin) {
                              const name = isMe ? "You" : chat.lastHandled.name;
                              return chat.lastHandled.role
                                ? `${name} | ${chat.lastHandled.role}`
                                : name;
                            }
                            if (isMe) return "You";
                            return "Team Member";
                          })()}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[10px] font-medium">
                        {isBeingHandledByOther && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-red-50 text-red-600 border border-red-100">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                            {session?.user?.role === "superAdmin"
                              ? handler.name
                              : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!isSelectionMode && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveChatMenu(
                          activeChatMenu === chat.phone ? null : chat.phone,
                        );
                        setShowMainMenu(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-slate-700 bg-white shadow-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <ChevronDown size={14} />
                    </button>
                    {activeChatMenu === chat.phone && (
                      <div className="absolute right-8 top-0 mt-1 w-32 bg-white border border-slate-100 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerDelete([chat]);
                          }}
                          disabled={isDeleting}
                          className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors font-semibold disabled:opacity-50"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading && messages.length === 0)
    return (
      <div className="p-8 text-slate-400 text-sm flex justify-center">
        Loading conversations...
      </div>
    );

  return (
    // 👇 Added relative positioning to main container so modal anchors nicely
    <div className="flex flex-col h-full w-full bg-white border-r border-slate-200 relative">
      {/* 👇 Custom Premium Delete Modal */}
      {deleteModal.isOpen && (
        <div className="absolute top-4 left-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-red-100 p-4 z-[60] flex flex-col gap-3 transition-all animate-in fade-in slide-in-from-top-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
              <AlertTriangle size={20} className="text-red-500" />
            </div>
            <div className="pt-0.5">
              <h4 className="text-sm font-bold text-slate-800">
                Delete Conversation{deleteModal.chats?.length > 1 ? "s" : ""}?
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                You are about to permanently delete {deleteModal.chats?.length} conversation
                {deleteModal.chats?.length > 1 ? "s" : ""}. This will remove all associated messages, leads, and customer records from the database.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-slate-100/50">
            <button
              onClick={() => setDeleteModal({ isOpen: false, chats: [] })}
              disabled={isDeleting}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-red-200 disabled:opacity-50"
            >
              {isDeleting ? (
                <Clock size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {isDeleting ? "Deleting..." : "Yes, Delete"}
            </button>
          </div>
        </div>
      )}

      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">
          Messages
        </h2>
        <Link
          href="/crm/chat/new-customer"
          className="text-slate-400 hover:text-emerald-600 transition"
        >
          <PlusCircle size={20} />
        </Link>
      </div>

      <div className="p-3 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative group flex-1">
            <Search
              className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors"
              size={16}
            />
            <input
              placeholder={
                isSelectionMode
                  ? "Select chats below..."
                  : "Search recent or all customers..."
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={isSelectionMode}
            />
          </div>

          {!isSelectionMode ? (
            <div className="relative shrink-0">
              <button
                onClick={() => {
                  setShowMainMenu(!showMainMenu);
                  setActiveChatMenu(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
              >
                <ChevronDown size={18} />
              </button>
              {showMainMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-100 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                  <button
                    onClick={() => {
                      setIsSelectionMode(true);
                      setShowMainMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                  >
                    <CheckCheck size={16} /> Select Multiple
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedPhones(new Set());
                }}
                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                title="Cancel"
              >
                <X size={18} />
              </button>
              {selectedPhones.size > 0 && (
                <button
                  onClick={() => {
                    const selectedChats = messages.filter((c) => selectedPhones.has(c.phone));
                    triggerDelete(selectedChats);
                  }}
                  disabled={isDeleting}
                  className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm flex items-center gap-1 text-sm font-medium disabled:opacity-50"
                >
                  <Trash2 size={16} /> {selectedPhones.size}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Tab Filter Pills */}
      <div className="px-3 pb-3 flex gap-1.5 overflow-x-auto shrink-0 select-none no-scrollbar border-b border-slate-100">
        {["All", "Active", "Follow Up", "Closed"].map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => {
                setActiveFilter(filter);
                setVisibleCount(30);
              }}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-full border transition-all shrink-0 ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-slate-55 bg-white text-slate-500 border-slate-200 hover:bg-slate-100/80"
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      <div
        ref={listContainerRef}
        className="overflow-y-auto flex-1 custom-scrollbar"
      >
        {searchTerm ? (
          <>
            {renderChatGroup("Recent Chats", [
              ...groupedChats.today,
              ...groupedChats.yesterday,
              ...groupedChats.older,
            ])}

            {filteredCustomers.length > 0 && !isSelectionMode && (
              <div className="mb-2">
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-2 z-10 border-b border-slate-50">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-emerald-600">
                    From Customer Database
                  </span>
                </div>
                {filteredCustomers.map((cust, idx) => (
                  <div
                    key={`cust-${idx}`}
                    onClick={() => handleCustomerClick(cust)}
                    className="flex items-start gap-4 px-5 py-3 cursor-pointer border-b border-slate-50 transition-all duration-200 hover:bg-slate-50 border-l-4 border-l-transparent"
                  >
                    <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg shrink-0">
                      {cust.name && cust.name !== "Unknown"
                        ? cust.name.charAt(0).toUpperCase()
                        : "#"}
                    </div>
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-700 truncate">
                          {cust.name || cust.phone}
                        </span>
                        {cust.priority &&
                          cust.priority.toLowerCase() === "high" && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                              High
                            </span>
                          )}
                        {cust.priority &&
                          cust.priority.toLowerCase() === "medium" && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">
                              Medium
                            </span>
                          )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">
                        Click to start conversation...
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {Object.values(groupedChats).flat().length === 0 &&
              filteredCustomers.length === 0 && (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No results found.
                </div>
              )}
          </>
        ) : (
          <>
            {renderChatGroup("Today", groupedChats.today)}
            {renderChatGroup("Yesterday", groupedChats.yesterday)}
            {renderChatGroup("Older", groupedChats.older)}

            {messages.length === 0 && !loading && (
              error ? (
                <div className="p-8 text-center text-rose-500 text-xs flex flex-col items-center gap-2 select-none">
                  <AlertCircle size={20} className="text-rose-500" />
                  <span className="font-semibold">{error}</span>
                  {onRetry && (
                    <button
                      onClick={onRetry}
                      className="mt-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Retry
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No chats found.
                </div>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
