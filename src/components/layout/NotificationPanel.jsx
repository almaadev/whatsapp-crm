"use client";
import { useChatStore } from "@/store/chatStore";
import { X, Bell, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

export default function NotificationPanel({ isOpen, onClose }) {
  const router = useRouter();
  const notifications = useChatStore((s) => s.notifications);
  const clearNotifications = useChatStore((s) => s.clearNotifications);
  const setSelectedChat = useChatStore((s) => s.setSelectedChat);
  const messages = useChatStore((s) => s.messages);

  if (!isOpen) return null;

  // 1. Group Notifications: Keep only the latest notification per phone number
  // Since 'notifications' has newest first, this logic keeps the first occurrence (newest) and drops the rest.
  const uniqueNotifications = notifications.reduce((acc, current) => {
    const isExists = acc.find(item => item.phone === current.phone);
    if (!isExists) {
      return [...acc, current];
    }
    return acc;
  }, []);

  // 2. Click Handler: Select Chat & Navigate
  const handleNotificationClick = (notif) => {
    // Find the full chat object from the store using the phone number
    const chat = messages.find(c => c.phone === notif.phone);
    
    if (chat) {
        setSelectedChat(chat);
        router.push('/dashboard/chat');
        onClose(); 
    } else {
        // Fallback: If chat isn't loaded for some reason, try to navigate anyway
        // Ideally we would fetch it, but for now we redirect to chat
        console.warn("Chat object not found in store for", notif.phone);
        router.push('/dashboard/chat');
        onClose();
    }
  };

  // Helper to format time (e.g., "10:30 AM")
  const formatTime = (dateObj) => {
      if (!dateObj) return "";
      const date = new Date(dateObj);
      return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <div className="absolute top-16 left-20 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 origin-top-left ring-1 ring-black/5">
      
      {/* Header */}
      <div className="bg-slate-900 p-4 flex justify-between items-center text-white">
        <h3 className="font-bold flex items-center gap-2 text-sm">
            <Bell size={16} className="text-yellow-400" /> Notifications
            {uniqueNotifications.length > 0 && (
                <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                    {uniqueNotifications.length}
                </span>
            )}
        </h3>
        <div className="flex gap-3 items-center">
            {notifications.length > 0 && (
                <button onClick={clearNotifications} className="text-[10px] text-slate-400 hover:text-white transition-colors uppercase tracking-wider font-bold">
                    Clear All
                </button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18} /></button>
        </div>
      </div>

      {/* List */}
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-white">
        {uniqueNotifications.length === 0 ? (
            <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400">
                <Bell size={32} className="opacity-20 mb-2"/>
                <p className="text-sm">No new notifications</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-100">
                {uniqueNotifications.map((notif) => (
                    <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group"
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-slate-800 text-sm truncate max-w-[180px] group-hover:text-emerald-600 transition-colors">
                                {notif.name}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded">
                                {formatTime(notif.timestamp)}
                            </span>
                        </div>
                        
                        <div className="flex gap-2 items-start">
                            <MessageCircle size={12} className="text-slate-300 mt-0.5 shrink-0"/>
                            <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {notif.message}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
}