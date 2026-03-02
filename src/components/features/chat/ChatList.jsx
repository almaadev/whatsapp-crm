"use client";
import { useState, useMemo } from "react"; 
import { useChatStore } from "@/store/chatStore";
import { useSession } from "next-auth/react";
import Link from "next/link"; // Added Next.js Link
import { Search, PlusCircle, CheckCheck, Flag } from "lucide-react"; 

export default function ChatList({ role, loading }) { 
  const messages = useChatStore((s) => s.messages); 
  const { selectedChat, setSelectedChat, updateChatDetails } = useChatStore(); 
  const { data: session } = useSession();
  const [searchTerm, setSearchTerm] = useState(""); 

  const getPriorityStyles = (priority, isUnread) => {
    if (isUnread) return "bg-emerald-50/40 border-l-emerald-400/50";
    
    switch (priority?.toLowerCase()) {
        case 'high': return "bg-red-50/30 border-l-red-400/50 hover:bg-red-50/50";
        case 'medium': return "bg-amber-50/30 border-l-amber-400/50 hover:bg-amber-50/50";
        default: return "bg-white border-l-transparent hover:bg-slate-50";
    }
  };

  const getPriorityIconColor = (priority) => {
      switch (priority?.toLowerCase()) {
          case 'high': return "text-red-500";
          case 'medium': return "text-amber-500";
          default: return "text-slate-300";
      }
  };

  const parseDate = (dateString) => {
    if (!dateString) return new Date(0); 
    if (dateString.includes("T") || (dateString.includes("-") && dateString.includes(":"))) {
        return new Date(dateString);
    }
    const parts = dateString.split(" ");
    if (parts.length >= 2) {
        const dateParts = parts[0].split("/"); 
        const timeParts = parts[1].split(":"); 
        if (dateParts.length === 3) {
            return new Date(
                parseInt(dateParts[2]), parseInt(dateParts[0]) - 1, parseInt(dateParts[1]), 
                parseInt(timeParts[0] || 0), parseInt(timeParts[1] || 0), parseInt(timeParts[2] || 0)
            );
        }
    }
    return new Date(dateString);
  };

  const formatTimeDisplay = (dateObj) => {
    if (isNaN(dateObj.getTime())) return "";
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
    const diffTime = today - msgDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    if (diffDays === 1) return "Yesterday";
    if (diffDays > 1 && diffDays < 7) return dateObj.toLocaleDateString([], { weekday: 'long' });
    
    const d = String(dateObj.getDate()).padStart(2, '0');
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const y = String(dateObj.getFullYear()).slice(-2);
    return `${d}/${m}/${y}`;
  };

  const handleChatClick = async (chat) => {
    setSelectedChat(chat);
    if (chat.direction === "INBOUND" && chat.read === "FALSE") {
        updateChatDetails(chat.phone, { read: "TRUE" });
        try {
            await fetch("/api/chats/mark-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: chat.phone })
            });
        } catch (err) {
            console.error("Failed to mark chat as read", err);
        }
    }
  };

  const groupedChats = useMemo(() => {
    const filtered = messages.filter((chat) => {
        const term = searchTerm.toLowerCase();
        const name = (chat.name || "").toLowerCase();
        const phone = (chat.phone || "").toLowerCase();
        return name.includes(term) || phone.includes(term);
    });

    const sorted = filtered.sort((a, b) => {
        return parseDate(b.lastSeenAt || b.timestamp) - parseDate(a.lastSeenAt || a.timestamp);
    });

    const groups = { today: [], yesterday: [], older: [] };
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    sorted.forEach(chat => {
        const chatDateRaw = parseDate(chat.lastSeenAt || chat.timestamp);
        const chatDateOnly = new Date(chatDateRaw.getFullYear(), chatDateRaw.getMonth(), chatDateRaw.getDate());
        const diffTime = today - chatDateOnly;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) groups.today.push(chat);
        else if (diffDays === 1) groups.yesterday.push(chat);
        else groups.older.push(chat);
    });

    return groups;
  }, [messages, searchTerm]);

  const renderChatGroup = (title, chats) => {
    if (chats.length === 0) return null;
    return (
        <div className="mb-2">
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-2 z-10 border-b border-slate-50">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
            </div>
            {chats.map((chat, index) => {
                const isSelected = selectedChat?.phone === chat.phone;

                // FIX: If chat is selected, NEVER treat as unread (prevents highlight/red dot)
                const isUnread = !isSelected && chat.direction === "INBOUND" && chat.read === "FALSE";
                
                const cleanPhone = chat.phone ? chat.phone.replace("whatsapp:", "") : "";
                const displayName = chat.name || cleanPhone;
                const dateObj = parseDate(chat.lastSeenAt || chat.timestamp);
                
                const baseStyle = isSelected 
                    ? "bg-slate-50 border-l-emerald-500" 
                    : getPriorityStyles(chat.priority, isUnread);

                return (
                    <div 
                        key={index} 
                        onClick={() => handleChatClick(chat)}
                        className={`
                            flex items-start gap-4 px-5 py-3 cursor-pointer border-b border-slate-50 transition-all duration-200 group border-l-4
                            ${baseStyle}
                        `}
                    >
                        <div className="relative shrink-0">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm transition-transform group-hover:scale-105
                                ${isUnread ? "bg-emerald-500 shadow-emerald-200" : "bg-slate-200 text-slate-500"}
                            `}>
                                {chat.name ? chat.name.charAt(0).toUpperCase() : "#"}
                            </div>
                            {isUnread && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>}
                        </div>

                        <div className="flex-1 min-w-0 pt-0.5">
                            <div className="flex justify-between items-baseline mb-1">
                                <span className={`truncate text-sm ${isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                                    {displayName}
                                </span>
                                <span className={`text-[10px] shrink-0 ${isUnread ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
                                    {formatTimeDisplay(dateObj)}
                                </span>
                            </div>
                            
                            <div className="flex justify-between items-center">
                                <p className={`text-xs truncate pr-3 max-w-[180px] ${isUnread ? "text-slate-900 font-bold" : "text-slate-500"}`}>
                                    {chat.direction === "OUTBOUND" && <span className="text-emerald-600 mr-1">You:</span>}
                                    {chat.message}
                                </p>
                                
                                {chat.status === 'Closed' ? (
                                    <div className="flex items-center gap-1 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] text-emerald-700 font-bold border border-emerald-100">
                                        <CheckCheck size={10} />
                                    </div>
                                ) : chat.status === 'Follow Up' ? (
                                    <div className="flex items-center gap-1">
                                        <Flag size={12} className={getPriorityIconColor(chat.priority)} fill="currentColor" />
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
  };

  if (loading && messages.length === 0) return <div className="p-8 text-slate-400 text-sm flex justify-center">Loading conversations...</div>;

  return (
    <div className="flex flex-col h-full w-full bg-white border-r border-slate-200">
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <h2 className="text-lg font-bold text-slate-800 tracking-tight">Messages</h2>
        {/* FIXED: Replaced <button><a> with proper <Link> */}
        <Link href="/dashboard/chat/new-customer" className="text-slate-400 hover:text-emerald-600 transition">
             <PlusCircle size={20} />
        </Link>
      </div>

      <div className="p-3 bg-white shrink-0">
        <div className="relative group">
          <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
          <input 
            placeholder="Search leads..." 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all placeholder:text-slate-400"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {renderChatGroup("Today", groupedChats.today)}
        {renderChatGroup("Yesterday", groupedChats.yesterday)}
        {renderChatGroup("Older", groupedChats.older)}

        {messages.length === 0 && !loading && (
            <div className="p-8 text-center text-slate-400 text-xs">
                No chats found.
            </div>
        )}
      </div>
    </div>
  );
}