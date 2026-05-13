"use client";
import { useState, useMemo, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Search, PlusCircle, CheckCheck, Check, Clock, AlertCircle, ChevronDown, Trash2, X, AlertTriangle } from "lucide-react";

export default function ChatList({ role, loading }) {
    const messages = useChatStore((s) => s.messages);
    const { selectedChat, setSelectedChat, updateChatDetails } = useChatStore();
    const { data: session } = useSession();

    const [searchTerm, setSearchTerm] = useState("");
    const [allCustomers, setAllCustomers] = useState(null);

    // 👇 States for Deletion functionality
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedPhones, setSelectedPhones] = useState(new Set());
    const [showMainMenu, setShowMainMenu] = useState(false);
    const [activeChatMenu, setActiveChatMenu] = useState(null);

    // 👇 New Custom Modal States
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, phones: [] });
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (searchTerm.length > 0 && !allCustomers) {
            fetch("/api/customers")
                .then(res => res.json())
                .then(data => setAllCustomers(Array.isArray(data) ? data : []))
                .catch(err => console.error("Failed to fetch customers", err));
        }
    }, [searchTerm, allCustomers]);

    const getPriorityStyles = (priority, isUnread) => {
        if (isUnread) return "bg-emerald-50/40 border-l-emerald-400/50";

        switch (priority?.toLowerCase()) {
            case 'high': return "bg-red-50/30 border-l-red-400/50 hover:bg-red-50/50";
            case 'medium': return "bg-amber-50/30 border-l-amber-400/50 hover:bg-amber-50/50";
            default: return "bg-white border-l-transparent hover:bg-slate-50";
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

    const handleCustomerClick = (customer) => {
        let cleanPhone = customer.phone || "";
        if (!cleanPhone.startsWith("whatsapp:")) {
            cleanPhone = `whatsapp:${cleanPhone.replace(/\D/g, '')}`;
        }

        setSelectedChat({
            phone: cleanPhone,
            name: customer.name || "Unknown",
            message: "",
            direction: "OUTBOUND",
            status: customer.status || "New",
            priority: customer.priority || "Medium",
            read: "TRUE",
            timestamp: new Date().toISOString()
        });
        setSearchTerm("");
    };

    // 👇 API Functions to trigger and confirm deletion
    const triggerDelete = (phonesArray) => {
        setDeleteModal({ isOpen: true, phones: phonesArray });
    };

    const confirmDelete = async () => {
        const phonesArray = deleteModal.phones;
        setIsDeleting(true);
        try {
            const res = await fetch("/api/chats", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phones: phonesArray })
            });

            if (res.ok) {
                if (selectedChat && phonesArray.includes(selectedChat.phone)) {
                    setSelectedChat(null);
                }
                setIsSelectionMode(false);
                setSelectedPhones(new Set());
                setActiveChatMenu(null);
                setDeleteModal({ isOpen: false, phones: [] });

                window.location.reload();
            } else {
                alert("Failed to delete chats.");
            }
        } catch (err) {
            console.error("Delete Error", err);
            alert("An error occurred while deleting.");
        }
        setIsDeleting(false);
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

    const filteredCustomers = useMemo(() => {
        if (!searchTerm || !allCustomers) return [];
        const term = searchTerm.toLowerCase();

        const existingPhones = new Set(messages.map(m => m.phone?.replace(/\D/g, '') || ""));

        return allCustomers.filter(c => {
            const phoneStr = c.phone?.replace(/\D/g, '') || "";
            const nameStr = (c.name || "").toLowerCase();

            const matches = nameStr.includes(term) || phoneStr.includes(term);
            const notInChats = !existingPhones.has(phoneStr);

            return matches && notInChats;
        });
    }, [searchTerm, allCustomers, messages]);

    const renderChatGroup = (title, chats) => {
        if (chats.length === 0) return null;
        return (
            <div className="mb-2">
                <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-2 z-10 border-b border-slate-50">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
                </div>
                {chats.map((chat, index) => {
                    const isSelected = selectedChat?.phone === chat.phone;
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
                            relative flex items-start gap-3 px-5 py-3 cursor-pointer border-b border-slate-50 transition-all duration-200 group border-l-4
                            ${baseStyle}
                        `}
                        >
                            {isSelectionMode && (
                                <div className="flex items-center self-center shrink-0 mr-1">
                                    <input
                                        type="checkbox"
                                        checked={selectedPhones.has(chat.phone)}
                                        readOnly
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                </div>
                            )}

                            <div className="relative shrink-0">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm transition-transform group-hover:scale-105
                                ${isUnread ? "bg-emerald-500 shadow-emerald-200" : "bg-slate-200 text-slate-500"}
                            `}>
                                    {chat.name && chat.name !== "Unknown" ? chat.name.charAt(0).toUpperCase() : "#"}
                                </div>
                                {isUnread && <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>}
                            </div>

                            <div className="flex-1 min-w-0 pt-0.5">
                                <div className="flex justify-between items-baseline mb-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`truncate text-sm ${isUnread ? "font-bold text-slate-900" : "font-semibold text-slate-700"}`}>
                                            {displayName}
                                        </span>

                                        {chat.priority && chat.priority.toLowerCase() === 'high' && (
                                            <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                                                <AlertCircle size={8} className="stroke-[3]" /> High
                                            </span>
                                        )}
                                        {chat.priority && chat.priority.toLowerCase() === 'medium' && (
                                            <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">
                                                Medium
                                            </span>
                                        )}
                                    </div>

                                    <span className={`text-[10px] shrink-0 ml-2 ${isUnread ? "text-emerald-600 font-bold" : "text-slate-400"}`}>
                                        {formatTimeDisplay(dateObj)}
                                    </span>
                                </div>

                                <div className="flex justify-between items-center pr-3">
                                    <p className={`text-xs truncate pr-3 max-w-[180px] ${isUnread ? "text-slate-900 font-bold" : "text-slate-500"}`}>
                                        {chat.direction === "OUTBOUND" && <span className="text-emerald-600 mr-1">You:</span>}
                                        {chat.message}
                                    </p>
                                    {chat.categoryLabel && (
                                        <span className="inline-block mt-1 bg-indigo-50 text-indigo-600 text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-100">
                                            {chat.categoryLabel}
                                        </span>
                                    )}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {chat.direction === "OUTBOUND" && (
                                            (() => {
                                                const msgStat = (chat.messageStatus || "").toUpperCase();
                                                if (msgStat === "SENDING") return <Clock size={14} className="text-slate-400" />;
                                                if (msgStat === "SENT") return <Check size={16} className="text-slate-400" />;
                                                if (msgStat === "DELIVERED") return <CheckCheck size={16} className="text-slate-400" />;
                                                if (msgStat === "READ") return <CheckCheck size={16} className="text-blue-500" />;
                                                if (msgStat === "FAILED") return <AlertCircle size={14} className="text-red-500" />;
                                                return null;
                                            })()
                                        )}
                                    </div>
                                </div>
                            </div>

                            {!isSelectionMode && (
                                <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveChatMenu(activeChatMenu === chat.phone ? null : chat.phone);
                                            setShowMainMenu(false);
                                        }}
                                        className="p-1.5 text-slate-400 hover:text-slate-700 bg-white shadow-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                    {activeChatMenu === chat.phone && (
                                        <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-slate-100 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    triggerDelete([chat.phone]); // Trigger modal instead of deleting immediately
                                                }}
                                                disabled={isDeleting}
                                                className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                            >
                                                <Trash2 size={14} /> Delete
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    if (loading && messages.length === 0) return <div className="p-8 text-slate-400 text-sm flex justify-center">Loading conversations...</div>;

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
                                Delete Conversation{deleteModal.phones.length > 1 ? 's' : ''}?
                            </h4>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                You are about to delete {deleteModal.phones.length} chat{deleteModal.phones.length > 1 ? 's' : ''}. This will clear the message history. The customer will remain in your database.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-2 pt-3 border-t border-slate-100/50">
                        <button
                            onClick={() => setDeleteModal({ isOpen: false, phones: [] })}
                            disabled={isDeleting}
                            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-transparent"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-red-200"
                        >
                            {isDeleting ? <Clock size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            {isDeleting ? "Deleting..." : "Yes, Delete"}
                        </button>
                    </div>
                </div>
            )}

            <div className="h-16 px-5 flex items-center justify-between border-b border-slate-100 shrink-0 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Messages</h2>
                <Link href="/crm/chat/new-customer" className="text-slate-400 hover:text-emerald-600 transition">
                    <PlusCircle size={20} />
                </Link>
            </div>

            <div className="p-3 bg-white shrink-0">
                <div className="flex items-center gap-2">
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={16} />
                        <input
                            placeholder={isSelectionMode ? "Select chats below..." : "Search recent or all customers..."}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            disabled={isSelectionMode}
                        />
                    </div>

                    {!isSelectionMode ? (
                        <div className="relative shrink-0">
                            <button
                                onClick={() => { setShowMainMenu(!showMainMenu); setActiveChatMenu(null); }}
                                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                            >
                                <ChevronDown size={18} />
                            </button>
                            {showMainMenu && (
                                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-100 rounded-xl shadow-lg z-50 py-1 overflow-hidden">
                                    <button
                                        onClick={() => { setIsSelectionMode(true); setShowMainMenu(false); }}
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
                                onClick={() => { setIsSelectionMode(false); setSelectedPhones(new Set()); }}
                                className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
                                title="Cancel"
                            >
                                <X size={18} />
                            </button>
                            {selectedPhones.size > 0 && (
                                <button
                                    onClick={() => triggerDelete(Array.from(selectedPhones))} // Trigger modal instead of immediate delete
                                    disabled={isDeleting}
                                    className="p-2 text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm flex items-center gap-1 text-sm font-medium"
                                >
                                    <Trash2 size={16} /> {selectedPhones.size}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar">
                {searchTerm ? (
                    <>
                        {renderChatGroup("Recent Chats", [...groupedChats.today, ...groupedChats.yesterday, ...groupedChats.older])}

                        {filteredCustomers.length > 0 && !isSelectionMode && (
                            <div className="mb-2">
                                <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-5 py-2 z-10 border-b border-slate-50">
                                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider text-emerald-600">From Customer Database</span>
                                </div>
                                {filteredCustomers.map((cust, idx) => (
                                    <div key={`cust-${idx}`} onClick={() => handleCustomerClick(cust)} className="flex items-start gap-4 px-5 py-3 cursor-pointer border-b border-slate-50 transition-all duration-200 hover:bg-slate-50 border-l-4 border-l-transparent">
                                        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg shrink-0">
                                            {cust.name && cust.name !== "Unknown" ? cust.name.charAt(0).toUpperCase() : "#"}
                                        </div>
                                        <div className="flex-1 min-w-0 pt-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-slate-700 truncate">{cust.name || cust.phone}</span>
                                                {cust.priority && cust.priority.toLowerCase() === 'high' && (
                                                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">High</span>
                                                )}
                                                {cust.priority && cust.priority.toLowerCase() === 'medium' && (
                                                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-200">Medium</span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400 truncate">Click to start conversation...</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {Object.values(groupedChats).flat().length === 0 && filteredCustomers.length === 0 && (
                            <div className="p-8 text-center text-slate-400 text-xs">No results found.</div>
                        )}
                    </>
                ) : (
                    <>
                        {renderChatGroup("Today", groupedChats.today)}
                        {renderChatGroup("Yesterday", groupedChats.yesterday)}
                        {renderChatGroup("Older", groupedChats.older)}

                        {messages.length === 0 && !loading && (
                            <div className="p-8 text-center text-slate-400 text-xs">
                                No chats found.
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}