"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  X,
  MessageSquare,
  UserPlus,
  LogIn,
  LogOut,
  Check,
  RotateCcw,
  Trash2
} from "lucide-react";
import { useNotificationStore } from "@/features/notifications/stores/notificationStore";
import { useChatStore, isSameConversation } from "@/features/chat/stores/chatStore";
import { NotificationTypes } from "@/shared/constants/notificationConstants";

export default function NotificationPanel({ isOpen, onClose }) {
  const router = useRouter();

  const {
    notifications,
    unreadCount,
    activeFilter,
    isLoading,
    fetchNotifications,
    setFilter,
    markRead,
    markUnread,
    dismiss,
    clearAll
  } = useNotificationStore();

  const setSelectedChat = useChatStore((s) => s.setSelectedChat);
  const messages = useChatStore((s) => s.messages);

  // Fetch notifications on drawer open or filter change
  useEffect(() => {
    if (isOpen) {
      fetchNotifications({ filter: activeFilter });
    }
  }, [isOpen, activeFilter, fetchNotifications]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle clicking notification item
  const handleItemClick = async (notif) => {
    if (!notif.isRead) {
      await markRead(notif._id);
    }

    if (notif.phone || notif.customerId) {
      const targetPhone = notif.phone;
      const matchedChat = messages.find((c) => isSameConversation(c, notif));

      if (matchedChat) {
        setSelectedChat(matchedChat);
      } else if (targetPhone) {
        setSelectedChat({
          customerId: notif.customerId || null,
          phone: targetPhone,
          name: notif.senderName || notif.title || targetPhone,
          message: notif.latestMessage || notif.message,
          unreadCount: 0
        });
      }

      router.push("/crm/chat");
      onClose();
    }
  };

  // Helper for type icons
  const renderIcon = (type) => {
    switch (type) {
      case NotificationTypes.NEW_MESSAGE:
        return <MessageSquare size={16} className="text-emerald-500 shrink-0" />;
      case NotificationTypes.NEW_CHAT:
        return <UserPlus size={16} className="text-blue-500 shrink-0" />;
      case NotificationTypes.ASSOCIATE_LOGIN:
        return <LogIn size={16} className="text-teal-500 shrink-0" />;
      case NotificationTypes.ASSOCIATE_LOGOUT:
        return <LogOut size={16} className="text-rose-500 shrink-0" />;
      default:
        return <Bell size={16} className="text-amber-500 shrink-0" />;
    }
  };

  // Format relative time
  const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50"
          />

          {/* Fixed Right Sidebar Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 250 }}
            className="fixed top-0 right-0 bottom-0 z-50 h-screen w-full sm:w-[380px] md:w-[420px] bg-white shadow-2xl flex flex-col border-l border-slate-200 select-none"
          >
            {/* Header */}
            <div className="bg-[var(--brand-notification)] px-5 py-4 flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-emerald-400 border border-slate-700">
                  <Bell size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="bg-emerald-500 text-slate-950 text-[10px] px-2 py-0.5 rounded-full font-extrabold tracking-wide">
                        {unreadCount}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-200">CRM Notification Center</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-slate-100 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Close sidebar"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl text-xs font-semibold w-full max-w-[280px]">
                <button
                  onClick={() => setFilter("all")}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                    activeFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilter("unread")}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
                    activeFilter === "unread"
                      ? "bg-white text-slate-900 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>Unread</span>
                  {unreadCount > 0 && (
                    <span className="bg-emerald-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setFilter("read")}
                  className={`flex-1 py-1.5 rounded-lg transition-all text-center ${
                    activeFilter === "read"
                      ? "bg-white text-slate-900 shadow-sm font-bold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Read
                </button>
              </div>

              <span className="text-[11px] text-slate-400 font-semibold shrink-0">
                {notifications.length} total
              </span>
            </div>

            {/* Scrollable Notification List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading notifications...</span>
                </div>
              ) : notifications.length === 0 ? (
                <div className="h-full min-h-[250px] p-8 text-center flex flex-col items-center justify-center text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3 text-slate-300">
                    <Bell size={28} />
                  </div>
                  <p className="text-base font-bold text-slate-700">All caught up</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                    {activeFilter === "unread"
                      ? "No unread notifications right now."
                      : "No notifications found in your inbox."}
                  </p>
                </div>
              ) : (
                notifications.map((notif) => {
                  const isUnread = !notif.isRead;
                  const hasMultipleMsgs =
                    notif.type === NotificationTypes.NEW_MESSAGE && (notif.messageCount || 1) > 1;

                  return (
                    <div
                      key={notif._id}
                      onClick={() => handleItemClick(notif)}
                      className={`p-4 transition-colors cursor-pointer group relative flex gap-3.5 items-start border-l-4 ${
                        isUnread
                          ? "bg-emerald-50/40 hover:bg-emerald-50/80 border-emerald-500"
                          : "hover:bg-slate-50 border-transparent"
                      }`}
                    >
                      {/* Icon */}
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isUnread
                            ? "bg-white border-emerald-200 shadow-xs"
                            : "bg-slate-100 border-slate-200/60"
                        }`}
                      >
                        {renderIcon(notif.type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex justify-between items-baseline gap-2 mb-1">
                          <span
                            className={`text-sm truncate ${
                              isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"
                            }`}
                          >
                            {notif.title || "Notification"}
                          </span>
                          <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                            {formatRelativeTime(notif.latestMessageAt || notif.createdAt)}
                          </span>
                        </div>

                        {hasMultipleMsgs && (
                          <div className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mb-1 ${
                            isUnread ? "text-emerald-700 bg-emerald-100/90" : "text-slate-600 bg-slate-100"
                          }`}>
                            {notif.messageCount} {isUnread ? "new messages" : "messages"}
                          </div>
                        )}

                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-sans">
                          {notif.latestMessage || notif.message}
                        </p>

                        {notif.branchName && (
                          <span className="inline-block mt-1.5 text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                            {notif.branchName}
                          </span>
                        )}
                      </div>

                      {/* Item Dismiss X & Read Toggle Actions */}
                      <div className=" flex items-center gap-1">
                        {isUnread && (
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 group-hover:hidden" />
                        )}

                        <div className="flex items-center gap-1">
                          {isUnread ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markRead(notif._id);
                              }}
                              title="Mark as Read"
                              className="hidden group-hover:block p-1 text-slate-400 hover:text-emerald-600 hover:bg-white rounded transition-colors"
                            >
                              <Check size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markUnread(notif._id);
                              }}
                              title="Mark as Unread"
                              className="hidden group-hover:block p-1 text-slate-400 hover:text-blue-600 hover:bg-white rounded transition-colors"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismiss(notif._id);
                            }}
                            title="Dismiss notification"
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded transition-colors"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Sticky Bottom Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 shrink-0 text-center">
              <button
                onClick={clearAll}
                disabled={notifications.length === 0}
                className="w-full py-2 px-4 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:hover:text-slate-500 disabled:hover:bg-transparent uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Trash2 size={14} /> Clear All
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}