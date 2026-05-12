"use client";
<<<<<<< HEAD
import { useChatStore } from "@/store/chatStore";
import { chatService } from "@/services/chatService";
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect, memo } from "react";
import CustomerInfoPanel from "./CustomerInfoPanel";
import ForwardLeadModal from "./ForwardLeadModal";
import ReminderModal from "./ReminderModal";
import { toast } from "react-toastify";
import { getStatusColor } from "@/utils/colorUtils";
import { Send, Info, ChevronDown, Check, CheckCheck, ChevronLeft, MessageSquare, ArrowDown, Share2, X, Clock, Flag, AlertCircle, User, History, Bell, FileText } from "lucide-react";

=======

import { useState, useRef, useEffect, memo, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/chatStore";
import { useTemplateStore } from "@/store/templateStore";
import { chatService } from "@/services/chatService";
import { parseMessageDate, getDayHeader, formatBubbleTime, mutateLastMessage, MessageStatusIcon } from "@/utils/chatUtils";
import { getStatusColor } from "@/utils/colorUtils";
import { toast } from "react-toastify";

import CustomerInfoPanel from "./CustomerInfoPanel";
import ForwardLeadModal from "./ForwardLeadModal";
import ReminderModal from "./ReminderModal";
import PriorityModal from "../modal/PriorityModal";

import {
    Send, Info, X, Flag, User, History, Bell,
    FileText, ToggleLeft, ToggleRight, ChevronLeft, MessageSquare,
    ArrowDown, Share2, Layers, Search, Plus, Edit2, Trash2, Loader2,
    Tag, Save, Check, MapPin 
} from "lucide-react";

// --- Custom Hooks ---
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN CHAT AREA ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────
>>>>>>> c1be5bc (Initial commit from new system)
export default function ChatArea() {
    const { data: session } = useSession();
    const userRole = session?.user?.role || "associate";
    const userName = session?.user?.name || "User";
<<<<<<< HEAD
    const { selectedChat, messages: allMessages, addMessage, setSelectedChat, updateChatDetails, updateMessageStatus } = useChatStore();

    const [sending, setSending] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const [showScrollButton, setShowScrollButton] = useState(false);
=======
    const userEmail = session?.user?.email;

    const { selectedChat, messages: allMessages, addMessage, setSelectedChat, updateChatDetails, updateMessageStatus } = useChatStore();

    const [sending, setSending] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
>>>>>>> c1be5bc (Initial commit from new system)
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState(null);

    const [showPriorityModal, setShowPriorityModal] = useState(false);
    const [showClosingModal, setShowClosingModal] = useState(false);
<<<<<<< HEAD
    const [followUpNote, setFollowUpNote] = useState("");
    const [closingNote, setClosingNote] = useState("");

    const messagesEndRef = useRef(null);
    const scrollContainerRef = useRef(null);

    const activeChat = allMessages.find(c => c.phone === selectedChat?.phone) || selectedChat;

    const currentLeadStatus = activeChat?.status || "New";
    const isNewHandler = activeChat?.lastClosedBy && activeChat?.lastClosedBy !== session?.user?.name;
    const messages = activeChat?.history || (activeChat ? [activeChat] : []);


    // --- REMINDER LOGIC ---
    const handleSetReminder = async ({ date, time, message }) => {
        try {
            const res = await fetch("/api/reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "SET",
                    phone: activeChat.phone,
                    message,
                    date,
                    time
                })
            });
            if (res.ok) {
                toast.success("Reminder Scheduled!");
            } else {
                toast.error("Failed to set reminder");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error setting reminder");
        }
    };

    useEffect(() => {
        let isMounted = true;

        const checkReminders = async () => {

            if (!navigator.onLine) return;

            try {
                const res = await fetch("/api/reminders", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "CHECK" })
                });

                if (!res.ok) return;

                const data = await res.json();

                if (isMounted && data.success && data.processed && data.processed.length > 0) {
                    data.processed.forEach(item => {
                        if (item.associate === session?.user?.name) {
                            toast.info(`🔔 Reminder Sent to ${item.phone}: "${item.message}"`, { autoClose: 5000 });
                        }
                    });
                }
            } catch (e) {
                if (process.env.NODE_ENV === "development") {
                    console.debug("Reminder check skipped: Server may be restarting.");
                }
            }
        };

        const interval = setInterval(checkReminders, 30 * 1000);
        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [session?.user?.name]);

=======
    const [actionNote, setActionNote] = useState("");

    const scrollContainerRef = useRef(null);
    const messagesEndRef = useRef(null);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // --- Derived Data ---
    const activeChat = allMessages.find(c => c.phone === selectedChat?.phone) || selectedChat;
    const messages = activeChat?.history || [];
    const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;
    const isChatClosed = lastMessage?.isChatClosed || false;

    // --- Scroll Handling ---
>>>>>>> c1be5bc (Initial commit from new system)
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [messages.length, activeChat?.phone]);

    const handleScroll = () => {
<<<<<<< HEAD
        if (scrollContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
            const isNotAtBottom = scrollHeight - scrollTop - clientHeight > 100;
            setShowScrollButton(isNotAtBottom);
        }
    };

    const scrollToBottom = () => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
            setShowScrollButton(false);
        }
    };

    const parseDate = (dateString) => {
        if (!dateString) return new Date();
        if (dateString.includes("T") || (dateString.includes("-") && dateString.includes(":"))) return new Date(dateString);
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

    const getDayHeader = (date) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffTime = today - msgDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Yesterday";
        if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const dayName = date.toLocaleDateString([], { weekday: 'long' });
        return `${d} ${m} ${y} ${dayName}`;
    };

    const formatBubbleTime = (date) => {
        if (isNaN(date.getTime())) return "";
        return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
    };

    const initiateStatusChange = (newStatus) => {
        if (newStatus === "Follow Up") {
            setFollowUpNote("");
            setShowPriorityModal(true);
        } else if (newStatus === "Closed") {
            setClosingNote("");
            setShowClosingModal(true);
        } else {
            finalizeStatusChange(newStatus);
        }
    };

    const finalizeStatusChange = async (newStatus, priority = null, noteContent = "") => {
        if (!activeChat) return;

        const optimisticUpdate = {
            status: newStatus,
            ...(priority && { priority }),
            currentHandler: session?.user?.name
        };

        const originalChat = { ...activeChat };

        updateChatDetails(activeChat.phone, optimisticUpdate);

=======
        if (!scrollContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    };
  
    
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        setShowScrollButton(false);
    };

    // --- Business Logic ---
    const handleSetReminder = async ({ date, time, message }) => {
        try {
            await chatService.setReminder({ action: "SET", phone: activeChat.phone, message, date, time });
            toast.success("Reminder Scheduled!");
        } catch (e) {
            toast.error("Error setting reminder");
        }
    };

    const handleForwardLead = async (targetPhone, targetName, message) => {
        try {
            await chatService.forwardLead({
                customerPhone: activeChat.phone, targetPhone, message, associateName: targetName, role: userRole
            });
            toast.success(`Lead forwarded to ${targetName}`);
        } catch (e) {
            toast.error("Error forwarding lead.");
        }
    };

    const handleToggleChatStatus = async () => {
        if (!activeChat || isToggling || messages.length === 0) return;
        setIsToggling(true);
        const newClosedState = !isChatClosed;

        const updatedHistory = mutateLastMessage(messages, { isChatClosed: newClosedState });
        updateChatDetails(activeChat.phone, { history: updatedHistory });

        try {
            await chatService.updateChatControlStatus(activeChat.phone, newClosedState, activeChat.leadType || "Direct Lead");
            toast.success(newClosedState ? "Chat Marked as Closed" : "Chat Marked as Active");
        } catch (error) {
            toast.error("Failed to update Chat Control Status");
            const revertedHistory = mutateLastMessage(messages, { isChatClosed: !newClosedState });
            updateChatDetails(activeChat.phone, { history: revertedHistory });
        } finally {
            setIsToggling(false);
        }
    };

    const submitStatusChange = async (newStatus, priority = null) => {
        if (!activeChat) return;

        const optimisticUpdate = { status: newStatus, ...(priority && { priority }), currentHandler: userName };
        const originalChat = { ...activeChat };

        updateChatDetails(activeChat.phone, optimisticUpdate);
>>>>>>> c1be5bc (Initial commit from new system)
        setShowPriorityModal(false);
        setShowClosingModal(false);
        toast.success(`Status updated to ${newStatus}`);

        try {
<<<<<<< HEAD
            const res = await fetch("/api/lead-status", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    phone: activeChat.phone,
                    status: newStatus,
                    associateEmail: session?.user?.email,
                    associateName: session?.user?.name,
                    notes: noteContent,
                    priority: priority
                }),
            });
            if (!res.ok) throw new Error("Server Failed");
        } catch (e) {
            console.error("Status update failed", e);
=======
            await chatService.updateLeadLifecycle({
                phone: activeChat.phone,
                status: newStatus,
                associateEmail: userEmail,
                associateName: userName,
                notes: actionNote,
                priority: priority
            });
        } catch (e) {
>>>>>>> c1be5bc (Initial commit from new system)
            toast.error("Failed to save status. Reverting...");
            updateChatDetails(activeChat.phone, originalChat);
        }
    };

<<<<<<< HEAD

    const handleSend = async (text) => {
        if (!text.trim() || !activeChat) return;

        const tempId = Date.now().toString();

=======
    const handleSend = async (text) => {
        if (!text.trim() || !activeChat) return;
        const tempId = Date.now().toString();
>>>>>>> c1be5bc (Initial commit from new system)
        const newMessage = {
            phone: activeChat.phone,
            message: text,
            direction: "OUTBOUND",
            timestamp: new Date().toISOString(),
            name: activeChat.name,
            status: "Sending",
            role: userRole,
<<<<<<< HEAD
            tempId: tempId
=======
            tempId: tempId,
            isChatClosed: false
>>>>>>> c1be5bc (Initial commit from new system)
        };

        addMessage(newMessage);
        setSending(true);
<<<<<<< HEAD
        setTimeout(() => scrollToBottom(), 100);

        try {
            if (!navigator.onLine) throw new Error("Offline");

            const res = await chatService.sendMessage(newMessage);

            updateMessageStatus(activeChat.phone, tempId, "SENT", res?.twilioSid);

        } catch (error) {
            console.error("Failed to send", error);
=======
        setTimeout(scrollToBottom, 100);

        try {
            const res = await chatService.sendMessage(newMessage);
            updateMessageStatus(activeChat.phone, tempId, "SENT", res?.twilioSid);
        } catch (error) {
>>>>>>> c1be5bc (Initial commit from new system)
            updateMessageStatus(activeChat.phone, tempId, "FAILED");
            toast.error("Message failed to send.");
        } finally {
            setSending(false);
        }
    };

<<<<<<< HEAD
    const handleForwardLead = async (targetPhone, targetName, message) => {
        try {
            const res = await fetch("/api/forward-lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerPhone: activeChat.phone,
                    targetPhone: targetPhone,
                    message: message,
                    associateName: targetName,
                    role: userRole,
                })
            });
            if (res.ok) {
                toast.success(`Lead forwarded to ${targetName}`);
            } else {
                toast.error("Failed to forward lead.");
            }
        } catch (e) {
            toast.error("Error forwarding lead.");
        }
    };

    if (!activeChat) return <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-full text-slate-300"><MessageSquare size={40} className="mb-4" /><h1 className="text-2xl font-light">Select a conversation</h1></div>;


    // 👇 FIX: Safely checking if activeChat.phone exists before calling replace
    const displayName = activeChat.name || (activeChat.phone ? activeChat.phone.replace("whatsapp:", "") : "Unknown");

    const followUpLabel = "Follow Up";

    return (
        <div className="flex flex-col h-full w-full relative bg-[#e5ddd5]/30">
=======
    const handleSendTemplate = useCallback(async (template) => {
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
            templateSid: template.sid
        };

        addMessage(newMessage);
        setTimeout(scrollToBottom, 100);

        try {
            const res = await chatService.sendTemplateMessage({
                phone: activeChat.phone,
                templateSid: template.sid,
                chatType: activeChat.leadType || "Direct Lead",
                associateName: userName
            });
            updateMessageStatus(activeChat.phone, tempId, "SENT", res?.twilioSid);
        } catch (error) {
            updateMessageStatus(activeChat.phone, tempId, "FAILED");
            toast.error("Template failed to send.");
        }
    }, [activeChat, userName, userRole, addMessage, updateMessageStatus]);

    if (!activeChat) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 h-full text-slate-300">
                <MessageSquare size={40} className="mb-4" />
                <h1 className="text-2xl font-light">Select a conversation</h1>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full relative bg-[#e5ddd5]/30">
            {/* Modals & Drawers */}
>>>>>>> c1be5bc (Initial commit from new system)
            <CustomerInfoPanel isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
            <ForwardLeadModal isOpen={showForwardModal} onClose={() => setShowForwardModal(false)} customer={activeChat} onConfirm={handleForwardLead} />
            <ReminderModal isOpen={showReminderModal} onClose={() => setShowReminderModal(false)} onSet={handleSetReminder} initialPhone={activeChat.phone} />

<<<<<<< HEAD
            {/* MODALS */}
            {showPriorityModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity">
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
                        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
                            <div><h3 className="text-xl font-bold text-slate-900">Set Follow Up</h3><p className="text-sm text-slate-500 mt-1">Select urgency level</p></div>
                            <button onClick={() => setShowPriorityModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea value={followUpNote} onChange={(e) => setFollowUpNote(e.target.value)} className="w-full p-4 text-sm bg-slate-50 border rounded-2xl outline-none" placeholder="Daily Note..." rows={3} />
                            <div className="grid gap-2">
                                <button onClick={() => finalizeStatusChange("Follow Up", "High", followUpNote)} className="p-4 rounded-2xl border hover:bg-red-50 flex items-center gap-3"><Flag size={20} className="text-red-600" /> <span className="font-bold text-slate-800">High Priority</span></button>
                                <button onClick={() => finalizeStatusChange("Follow Up", "Medium", followUpNote)} className="p-4 rounded-2xl border hover:bg-amber-50 flex items-center gap-3"><Flag size={20} className="text-amber-600" /> <span className="font-bold text-slate-800">Medium Priority</span></button>
                                <button onClick={() => finalizeStatusChange("Follow Up", "Low", followUpNote)} className="p-4 rounded-2xl border hover:bg-emerald-50 flex items-center gap-3"><Flag size={20} className="text-emerald-600" /> <span className="font-bold text-slate-800">Low Priority</span></button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showClosingModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity">
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95">
                        <div className="px-6 pt-6 pb-2 flex items-center justify-between">
                            <div><h3 className="text-xl font-bold text-emerald-700">Lead Closed! 🎉</h3><p className="text-sm text-slate-500 mt-1">Add a quick note.</p></div>
                            <button onClick={() => setShowClosingModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <textarea value={closingNote} onChange={(e) => setClosingNote(e.target.value)} className="w-full p-4 text-sm bg-emerald-50 border border-emerald-100 rounded-2xl outline-none" rows={4} autoFocus />
                            <button onClick={() => finalizeStatusChange("Closed", null, closingNote)} disabled={!closingNote.trim()} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"><Check size={18} /> Confirm</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MEDIA VIEWER */}
            {selectedMedia && (
                <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedMedia(null)}>
                    <button className="absolute top-4 right-4 text-white p-2" onClick={() => setSelectedMedia(null)}> <X size={24} /> </button>
                    <div className="relative max-w-5xl max-h-full w-full flex justify-center" onClick={e => e.stopPropagation()}>
                        {selectedMedia.type?.includes("video") ? (
                            <video src={selectedMedia.url} controls autoPlay className="max-w-full max-h-[90vh] rounded shadow-2xl" />
                        ) : selectedMedia.type?.includes("pdf") || selectedMedia.type?.includes("document") ? (
                            <iframe src={selectedMedia.url} className="w-[90vw] md:w-[80vw] h-[90vh] bg-white rounded shadow-2xl" />
                        ) : (
                            <img src={selectedMedia.url} alt="Full View" className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" />
                        )}
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="bg-[#f0f2f5] border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-200 rounded-full"><ChevronLeft size={24} /></button>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsInfoOpen(true)}>
                        <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-bold shrink-0">{displayName.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="font-bold text-slate-800 text-base truncate">{displayName}</h2>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide border shrink-0 ${getStatusColor(currentLeadStatus)}`}>
                                    {currentLeadStatus === "Follow Up" ? followUpLabel : currentLeadStatus}
                                </span>
                            </div>

                            {/* Phone */}
                            {/* 👇 FIX: Safely checking phone before replace */}
                            <p className="text-xs text-slate-500 truncate mb-0.5">{activeChat.phone ? activeChat.phone.replace("whatsapp:", "") : ""}</p>

                            {/* HANDLERS INFO */}
                            <div className="flex items-center gap-2 text-[12px] font-medium tracking-tight">
                                {activeChat.currentHandler && (
                                    <span className={`${userName === activeChat.currentHandler ? "hidden" : "bg-slate-200/50 text-slate-600 border-slate-200"} flex items-center gap-1 px-1.5 py-0.5 rounded border`}>
                                        <User size={10} /> Previous Associate: {activeChat.currentHandler}
                                    </span>
                                )}
                                {activeChat.lastClosedBy && (
                                    <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                        <History size={10} /> Prev: {activeChat.lastClosedBy}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowReminderModal(true)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors" title="Set Auto Reminder">
                        <Bell size={20} />
                    </button>
                    <button onClick={() => setShowForwardModal(true)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full"><Share2 size={20} /></button>
                    <button onClick={() => setIsInfoOpen(true)} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full"><Info size={20} /></button>
                </div>
            </div>

            {/* MESSAGES AREA */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative" ref={scrollContainerRef} onScroll={handleScroll}>
                {isNewHandler && (
                    <div className="flex justify-center mb-4 sticky top-0 z-10">
                        <div className="bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-lg text-xs font-medium shadow-sm flex items-center gap-2">
                            <Info size={14} />
                            This lead was previously handled by <strong>{activeChat.lastClosedBy}</strong>
                        </div>
                    </div>
                )}

                {messages.map((msg, index) => {
                    const isMe = msg.direction?.toUpperCase() === "OUTBOUND";
                    const currentMsgDate = parseDate(msg.timestamp);
                    const previousMsgDate = index > 0 ? parseDate(messages[index - 1].timestamp) : null;
                    const showDateHeader = index === 0 || (previousMsgDate && currentMsgDate.toDateString() !== previousMsgDate.toDateString());

                    return (
                        <div key={index} className="w-full flex flex-col">
                            {showDateHeader && <div className="flex justify-center my-4 sticky top-2 z-10"><span className="bg-white/90 backdrop-blur text-slate-500 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">{getDayHeader(currentMsgDate)}</span></div>}
                            
                            <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"} group mb-1 min-w-0`}>
                                                                
                                <div className={`relative px-3 py-1.5 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] min-w-0 break-words rounded-lg shadow-sm text-sm leading-relaxed ${isMe ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none"}`}>

                                    {/* Media */}
                                    {msg.mediaUrl && msg.mediaUrl.startsWith("http") && (
                                        <div className="mb-1 rounded overflow-hidden">
                                            {msg.mediaType?.includes("video") ? (
                                                <div className="cursor-pointer" onClick={() => setSelectedMedia({ url: msg.mediaUrl, type: msg.mediaType })} title="Play Video">
                                                    <video src={msg.mediaUrl} className="w-full max-w-[300px] h-auto rounded" />
                                                </div>
                                            ) : msg.mediaType?.includes("audio") ? (
                                                <div className="pt-1" title="Play audio">
                                                    <audio src={msg.mediaUrl} controls className="w-full max-w-[240px] h-10" />
                                                </div>
                                            ) : msg.mediaType?.includes("pdf") || msg.mediaType?.includes("document") ? (
                                                <a href={msg.mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-white/60 border border-slate-200 rounded-lg hover:bg-white/90 transition-colors cursor-pointer" title="Open Document">
                                                    <div className="p-2 bg-red-100 text-red-600 rounded-lg" ><FileText size={20} /></div>
                                                </a>
                                            ) : (
                                                <div className="cursor-pointer" onClick={() => setSelectedMedia({ url: msg.mediaUrl, type: msg.mediaType })} title="Open Image">
                                                    <img src={msg.mediaUrl} alt="Attachment" className="w-full max-w-[300px] h-auto object-cover rounded" />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Message Text */}
                                    {msg.message && (
                                        <div className="whitespace-pre-wrap text-left" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                                            <span>{msg.message}</span>
                                            
                                            {/* Time & Status */}
                                            <span className="inline-flex items-center gap-1 float-right mt-2 ml-3">
                                                <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatBubbleTime(currentMsgDate)}</span>
                                                {isMe && (
                                                    (() => {
                                                        const msgStat = (msg.messageStatus || msg.status || "").toUpperCase();
                                                        return (
                                                            <>
                                                                {msgStat === "SENDING" && <Clock size={12} className="text-slate-400 shrink-0" />}
                                                                {msgStat === "SENT" && <Check size={14} className="text-slate-400 shrink-0" />}
                                                                {msgStat === "DELIVERED" && <CheckCheck size={14} className="text-slate-400 shrink-0" />}
                                                                {msgStat === "READ" && <CheckCheck size={14} className="text-blue-500 shrink-0" />}
                                                                {msgStat === "FAILED" && <AlertCircle size={12} className="text-red-500 shrink-0" />}
                                                            </>
                                                        );
                                                    })()
                                                )}
                                            </span>
                                        </div>
                                    )}
                                    
                                    {/* Fallback Time & Status if there is NO text (e.g. only image sent) */}
                                    {!msg.message && (
                                        <div className="flex justify-end items-center gap-1 mt-1">
                                            <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatBubbleTime(currentMsgDate)}</span>
                                            {isMe && (
                                                (() => {
                                                    const msgStat = (msg.messageStatus || msg.status || "").toUpperCase();
                                                    return (
                                                        <>
                                                            {msgStat === "SENDING" && <Clock size={12} className="text-slate-400 shrink-0" />}
                                                            {msgStat === "SENT" && <Check size={14} className="text-slate-400 shrink-0" />}
                                                            {msgStat === "DELIVERED" && <CheckCheck size={14} className="text-slate-400 shrink-0" />}
                                                            {msgStat === "READ" && <CheckCheck size={14} className="text-blue-500 shrink-0" />}
                                                            {msgStat === "FAILED" && <AlertCircle size={12} className="text-red-500 shrink-0" />}
                                                        </>
                                                    );
                                                })()
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
                {showScrollButton && <button onClick={scrollToBottom} className="fixed bottom-20 right-5 bg-slate-700 text-white p-2 rounded-full shadow-lg z-30"><ArrowDown size={20} /></button>}
            </div>

            {/* CHAT INPUT */}
            <ChatInput
                currentLeadStatus={currentLeadStatus}
                followUpLabel={followUpLabel}
                getStatusColor={getStatusColor}
                onStatusChange={initiateStatusChange}
                onSendMessage={handleSend}
=======
            {showPriorityModal && <PriorityModal note={actionNote} setNote={setActionNote} onClose={() => setShowPriorityModal(false)} onSubmit={submitStatusChange} />}
            {showClosingModal && <ClosingModal note={actionNote} setNote={setActionNote} onClose={() => setShowClosingModal(false)} onSubmit={submitStatusChange} />}
            {selectedMedia && <MediaViewer media={selectedMedia} onClose={() => setSelectedMedia(null)} />}

            <ChatHeader
                activeChat={activeChat}
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
                onInfo={() => setIsInfoOpen(true)}
                onReminder={() => setShowReminderModal(true)}
                onForward={() => setShowForwardModal(true)}
            />

            <MessageList
                messages={messages}
                activeChat={activeChat}
                userName={userName}
                scrollRef={scrollContainerRef}
                onScroll={handleScroll}
                onMediaClick={setSelectedMedia}
                endRef={messagesEndRef}
            />

            {showScrollButton && (
                <button onClick={scrollToBottom} className="fixed bottom-24 right-5 bg-slate-700 text-white p-2 rounded-full shadow-lg z-30">
                    <ArrowDown size={20} />
                </button>
            )}

            <ChatInput
                onSendMessage={handleSend}
                onSendTemplate={handleSendTemplate}
>>>>>>> c1be5bc (Initial commit from new system)
                sending={sending}
            />
        </div>
    );
}

<<<<<<< HEAD
const ChatInput = memo(function ChatInput({ currentLeadStatus, followUpLabel, onStatusChange, onSendMessage, sending }) {
    const [text, setText] = useState("");
    const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
    const statusMenuRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        function handleClickOutside(event) {
            if (statusMenuRef.current && !statusMenuRef.current.contains(event.target)) {
                setIsStatusMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);
=======

const TemplateBubble = memo(function TemplateBubble({ onSelect, onManage, onClose }) {
    const { templates, loading, fetchTemplates } = useTemplateStore();
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);
    const searchRef = useRef(null);

    useEffect(() => {
        fetchTemplates();
        setTimeout(() => searchRef.current?.focus(), 50);
    }, [fetchTemplates]);

    const filtered = useMemo(() =>
        templates.filter(t => t.name.toLowerCase().includes(debouncedSearch.toLowerCase())),
        [templates, debouncedSearch]);

    return (
        <div className="absolute bottom-[70px] right-4 w-72 sm:w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200 z-50 origin-bottom-right">
            <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <Search size={14} className="text-slate-400" />
                <input
                    ref={searchRef}
                    type="text"
                    placeholder="Search templates (/)"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400"
                />
                <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-md text-slate-400 transition-colors"><X size={14} /></button>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
                {loading ? (
                    <div className="p-6 flex justify-center"><Loader2 size={16} className="animate-spin text-[#00a884]" /></div>
                ) : filtered.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400 font-medium">No templates match '{debouncedSearch}'</div>
                ) : (
                    filtered.map(tpl => (
                        <button
                            key={tpl._id || tpl.sid}
                            onClick={() => { onSelect(tpl); onClose(); }}
                            className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 hover:shadow-sm border border-transparent hover:border-emerald-100 transition-all group flex items-center gap-3"
                        >
                            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors">
                                <Layers size={14} className="text-slate-500 group-hover:text-emerald-600 transition-colors" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-700 group-hover:text-emerald-800 truncate transition-colors">{tpl.name}</p>
                            </div>
                        </button>
                    ))
                )}
            </div>
            <div className="p-3 border-t border-slate-100 bg-slate-50">
                <button onClick={() => { onClose(); onManage(); }} className="w-full py-2.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 hover:text-slate-800 transition-colors shadow-sm flex items-center justify-center gap-2">
                    <Plus size={14} /> Manage Templates
                </button>
            </div>
        </div>
    );
});

const TemplateSidebar = memo(function TemplateSidebar({ open, onClose }) {
    const { templates, loading, addTemplate, updateTemplate, removeTemplate, forceRefresh } = useTemplateStore();

    const [sidInput, setSidInput] = useState("");
    const [nameInput, setNameInput] = useState("");
    const [editId, setEditId] = useState(null);
    const [adding, setAdding] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [showAddForm, setShowAddForm] = useState(false);

    useEffect(() => { if (open) forceRefresh(); }, [open, forceRefresh]);

    const resetForm = () => { setSidInput(""); setNameInput(""); setEditId(null); setShowAddForm(false); };

    const handleSave = async () => {
        const sid = sidInput.trim();
        if (!sid) return toast.error("Content SID is required");
        setAdding(true);
        try {
            const payload = { name: nameInput.trim() || `Template ${templates.length + 1}`, sid };
            const url = editId ? `/api/templates/${editId}` : "/api/templates";
            const res = await fetch(url, {
                method: editId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || "Failed to save");
            if (editId) updateTemplate(editId, json.data); else addTemplate(json.data);
            toast.success(editId ? "Template updated" : "Template added");
            resetForm();
        } catch (error) {
            toast.error(error.message);
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || "Failed to delete");
            removeTemplate(id);
            toast.success("Template deleted");
        } catch (error) {
            toast.error(error.message);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <div className={`fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
            <div className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl z-[1000] flex flex-col transform transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}>
                <div className="p-6 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2"><Layers size={18} className="text-[#00a884]" /><span className="font-extrabold text-base text-slate-800 tracking-tight">Template Library</span></div>
                    <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-rose-500 transition-all" onClick={onClose}><X size={16} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 bg-slate-50 flex flex-col gap-3 custom-scrollbar">
                    {loading && templates.length === 0 ? (
                        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[#00a884]" /></div>
                    ) : templates.map(tpl => (
                        <div key={tpl._id || tpl.sid} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 transition-all hover:border-slate-300 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center bg-slate-50 border border-slate-200 text-slate-400"><Tag size={15} /></div>
                            <div className="flex-1 min-w-0"><div className="text-sm font-bold text-slate-800 truncate">{tpl.name}</div></div>
                            <div className="flex gap-1 shrink-0">
                                <button className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-blue-100 hover:text-blue-600 transition-colors" onClick={() => { setEditId(tpl._id); setNameInput(tpl.name); setSidInput(tpl.sid); setShowAddForm(true); }}><Edit2 size={14} /></button>
                                <button className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors" onClick={() => handleDelete(tpl._id)} disabled={deletingId === tpl._id}>{deletingId === tpl._id ? <Loader2 size={14} className="animate-spin text-rose-500" /> : <Trash2 size={14} />}</button>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="shrink-0 p-5 sm:p-6 bg-white border-t border-slate-200">
                    {!showAddForm ? (
                        <button className="w-full py-3 bg-emerald-50 border border-dashed border-emerald-200 rounded-xl text-[#00a884] text-sm font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-all" onClick={() => setShowAddForm(true)}><Plus size={16} /> Add New Template</button>
                    ) : (
                        <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                            <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Template Label</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/10" value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="e.g. Welcome Message" /></div>
                            <div><label className="block text-[10px] font-bold uppercase text-slate-500 mb-1.5">Content SID *</label><input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 font-mono text-sm text-slate-700 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/10" value={sidInput} onChange={e => setSidInput(e.target.value)} placeholder="HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" spellCheck={false} /></div>
                            <div className="flex gap-2 mt-2">
                                <button className="flex-1 py-2.5 bg-slate-100 rounded-lg text-slate-600 text-sm font-bold hover:bg-slate-200 transition-all" onClick={resetForm}>Cancel</button>
                                <button className="flex-[2] py-2.5 bg-[#00a884] text-white rounded-lg text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#059669] transition-all disabled:opacity-50" onClick={handleSave} disabled={adding || !sidInput.trim()}>{adding ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
});

const ChatInput = memo(function ChatInput({ onSendMessage, onSendTemplate, sending }) {
    const [text, setText] = useState("");
    const [showBubble, setShowBubble] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);
    const textareaRef = useRef(null);
>>>>>>> c1be5bc (Initial commit from new system)

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [text]);

    const handleSendClick = () => {
        if (text.trim() && !sending) {
            onSendMessage(text);
            setText("");
<<<<<<< HEAD
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
=======
>>>>>>> c1be5bc (Initial commit from new system)
        }
    };

    const handleKeyDown = (e) => {
<<<<<<< HEAD
        if (e.key === 'Enter' && !e.shiftKey) {
=======
        if (e.key === '/' && text === "") {
            e.preventDefault();
            setShowBubble(true);
        } else if (e.key === 'Enter' && !e.shiftKey) {
>>>>>>> c1be5bc (Initial commit from new system)
            e.preventDefault();
            handleSendClick();
        }
    };

    return (
<<<<<<< HEAD
        <div className="bg-[#f0f2f5] p-3 px-4 border-t border-slate-200 flex items-end gap-3 z-20">

            <div className={`relative mb-1 ${text ? "hidden lg:block" : ""}`} ref={statusMenuRef}>
                <button onClick={() => setIsStatusMenuOpen(!isStatusMenuOpen)} className={`h-10 px-4 rounded-full border border-slate-300 flex items-center gap-2 text-xs font-bold transition-all shadow-sm bg-white hover:bg-slate-50 text-slate-700`}>
                    {currentLeadStatus === "Follow Up" ? followUpLabel : currentLeadStatus} <ChevronDown size={14} />
                </button>
                {isStatusMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-3 w-48 bg-white rounded-lg shadow-xl border border-slate-100 py-1 overflow-hidden animate-in zoom-in-95 origin-bottom-left">
                        {["Follow Up", "Closed", "Not Closed"].map((status) => (
                            <button key={status} onClick={() => { onStatusChange(status); setIsStatusMenuOpen(false); }} className="w-full text-left px-4 py-3 text-sm hover:bg-slate-50 text-slate-700 border-b border-slate-50 last:border-0">{status}</button>
                        ))}
                    </div>
                )}
            </div>
=======
        <div className="relative bg-[#f0f2f5] p-3 px-4 border-t border-slate-200 flex items-end gap-3 z-20">
            {showBubble && <TemplateBubble onSelect={onSendTemplate} onManage={() => { setShowBubble(false); setShowSidebar(true); }} onClose={() => setShowBubble(false)} />}
            {showSidebar && <TemplateSidebar open={showSidebar} onClose={() => setShowSidebar(false)} />}
>>>>>>> c1be5bc (Initial commit from new system)

            <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex items-center px-4 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-sm min-h-[44px]">
                <textarea
                    ref={textareaRef}
                    className="w-full bg-transparent border-none text-sm outline-none placeholder:text-slate-400 resize-none py-1.5 text-slate-800 custom-scrollbar"
                    style={{ maxHeight: '150px' }}
<<<<<<< HEAD
                    placeholder="Type a message"
=======
                    placeholder="Type a message (or type '/' for templates)"
>>>>>>> c1be5bc (Initial commit from new system)
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>

<<<<<<< HEAD
            <button onClick={handleSendClick} disabled={sending || !text.trim()} className={`p-3 rounded-full shadow transition-all flex-shrink-0 mb-0.5 ${text.trim() ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-400"}`}>
                {sending ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Send size={20} className={text.trim() ? "ml-0.5" : ""} />}
            </button>
        </div>
    );
});
=======
            <button onClick={handleSendClick} disabled={sending || !text.trim()} className={`p-3 rounded-full shadow transition-all flex-shrink-0 mb-0.5 ${text.trim() ? "bg-[#00a884] text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-400"}`}>
                {sending ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Send size={20} className={text.trim() ? "ml-0.5" : ""} />}
            </button>
            <button onClick={() => setShowBubble(!showBubble)} className={`p-3 flex-shrink-0 rounded-full transition-all shadow-sm ${showBubble ? "bg-emerald-100 text-emerald-600" : "bg-white text-slate-500 hover:bg-slate-100"}`} title="Templates (Shortcut: /)">
                <Layers size={20} />
            </button>
        </div>
    );
});

const ChatHeader = memo(function ChatHeader({ activeChat, userName, isChatClosed, isToggling, onToggle, onStatusChange, onBack, onInfo, onReminder, onForward }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const displayName = activeChat.name || (activeChat.phone ? activeChat.phone.replace("whatsapp:", "") : "Unknown");
    const statusColor = getStatusColor(activeChat.status);

    return (
        <div className="bg-[#f0f2f5] border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-20">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-200 rounded-full"><ChevronLeft size={24} /></button>
                <div className="flex items-center gap-3 cursor-pointer" onClick={onInfo}>
                    <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-bold shrink-0">{displayName.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-slate-800 text-base truncate">{displayName}</h2>
                                {activeChat?.city && <div className="hidden lg:flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200"><MapPin size={12}/> {activeChat.city}</div>} 
                        </div>
                        <p className="text-xs text-slate-500 truncate mb-0.5">{activeChat.phone?.replace("whatsapp:", "")}</p>

                        <div className="flex items-center gap-2 text-[12px] font-medium tracking-tight">
                            {activeChat.currentHandler && activeChat.currentHandler !== userName && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-slate-200/50 text-slate-600 border-slate-200">
                                    <User size={10} /> Prev: {activeChat.currentHandler}
                                </span>
                            )}
                            {activeChat.lastClosedBy && (
                                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                                    <History size={10} /> Closed By: {activeChat.lastClosedBy}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={onToggle} disabled={isToggling} className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-all shadow-sm ${isChatClosed ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'}`}>
                    {isToggling ? <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : (isChatClosed ? <ToggleLeft size={16} /> : <ToggleRight size={16} />)}
                    <span>{isChatClosed ? "Closed" : "Active"}</span>
                </button>

                <div className="relative">
                    <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm"><FileText size={16} /><span className="hidden sm:inline">{activeChat.status || "New"}</span></button>
                    {menuOpen && (
                        <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95">
                            {["Follow Up", "Closed", "Not Interested"].map((st) => (
                                <button key={st} onClick={() => { onStatusChange(st); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700 font-medium">{st}</button>
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={onReminder} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-full transition-colors"><Bell size={20} /></button>
                <button onClick={onForward} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full"><Share2 size={20} /></button>
                <button onClick={onInfo} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full"><Info size={20} /></button>
            </div>
        </div>
    );
});

const MessageList = memo(function MessageList({ messages, activeChat, userName, scrollRef, onScroll, onMediaClick, endRef }) {
    const isNewHandler = activeChat?.lastClosedBy && activeChat.lastClosedBy !== userName;

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar relative" ref={scrollRef} onScroll={onScroll}>
            {isNewHandler && (
                <div className="flex justify-center mb-4 sticky top-0 z-10">
                    <div className="bg-amber-50 text-amber-800 border border-amber-200 px-4 py-2 rounded-lg text-xs font-medium shadow-sm flex items-center gap-2">
                        <Info size={14} /> This lead was previously handled by <strong>{activeChat.lastClosedBy}</strong>
                    </div>
                </div>
            )}

            {messages.map((msg, index) => {
                const currentMsgDate = parseMessageDate(msg.timestamp || msg.createdAt);
                const previousMsgDate = index > 0 ? parseMessageDate(messages[index - 1].timestamp || messages[index - 1].createdAt) : null;
                const showDateHeader = index === 0 || (previousMsgDate && currentMsgDate.toDateString() !== previousMsgDate.toDateString());

                return (
                    <div key={index} className="w-full flex flex-col">
                        {showDateHeader && (
                            <div className="flex justify-center my-4 sticky top-2 z-10">
                                <span className="bg-white/90 backdrop-blur text-slate-500 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">
                                    {getDayHeader(currentMsgDate)}
                                </span>
                            </div>
                        )}
                        <MessageBubble msg={msg} currentMsgDate={currentMsgDate} onMediaClick={onMediaClick} />
                    </div>
                );
            })}
            <div ref={endRef} />
        </div>
    );
});

const MessageBubble = memo(function MessageBubble({ msg, currentMsgDate, onMediaClick }) {
    const isMe = msg.direction?.toUpperCase() === "OUTBOUND";

    return (
        <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"} group mb-1 min-w-0`}>
            <div className={`relative px-3 py-1.5 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] min-w-0 break-words rounded-lg shadow-sm text-sm leading-relaxed ${isMe ? "bg-[#d9fdd3] text-slate-900 rounded-tr-none" : "bg-white text-slate-900 rounded-tl-none"}`}>

                {msg.isTemplate && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#00a884] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 mb-1.5 w-max shadow-sm">
                        <Layers size={10} /> Template Sent
                    </div>
                )}

                {msg.mediaUrl && msg.mediaUrl.startsWith("http") && (
                    <div className="mb-1 rounded overflow-hidden cursor-pointer" onClick={() => onMediaClick({ url: msg.mediaUrl, type: msg.mediaType })}>
                        {msg.mediaType?.includes("video") ? (
                            <video src={msg.mediaUrl} className="w-full max-w-[300px] h-auto rounded pointer-events-none" />
                        ) : msg.mediaType?.includes("audio") ? (
                            <audio src={msg.mediaUrl} controls className="w-full max-w-[240px] h-10 mt-1" onClick={e => e.stopPropagation()} />
                        ) : msg.mediaType?.includes("pdf") || msg.mediaType?.includes("document") ? (
                            <div className="flex items-center gap-3 p-3 bg-white/60 border border-slate-200 rounded-lg hover:bg-white/90 transition-colors">
                                <div className="p-2 bg-red-100 text-red-600 rounded-lg"><FileText size={20} /></div>
                                <span className="text-xs font-bold text-slate-700">View Document</span>
                            </div>
                        ) : (
                            <img src={msg.mediaUrl} alt="Attachment" className="w-full max-w-[300px] h-auto object-cover rounded" />
                        )}
                    </div>
                )}

                {msg.message ? (
                    <div className="whitespace-pre-wrap text-left" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                        <span>{msg.message}</span>
                        <span className="inline-flex items-center gap-1 float-right mt-2 ml-3">
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatBubbleTime(currentMsgDate)}</span>
                            {isMe && <MessageStatusIcon status={msg.messageStatus || msg.status} />}
                        </span>
                    </div>
                ) : (
                    <div className="flex justify-end items-center gap-1 mt-1">
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">{formatBubbleTime(currentMsgDate)}</span>
                        {isMe && <MessageStatusIcon status={msg.messageStatus || msg.status} />}
                    </div>
                )}
            </div>
        </div>
    );
});

// const PriorityModal = ({ note, setNote, onClose, onSubmit }) => (
//     <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity">
//         <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95">
//             <div className="px-6 pt-6 pb-2 flex items-center justify-between">
//                 <div><h3 className="text-xl font-bold text-slate-900">Set Follow Up</h3><p className="text-sm text-slate-500 mt-1">Select urgency level</p></div>
//                 <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
//             </div>
//             <div className="p-6 space-y-4">
//                 <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-4 text-sm bg-slate-50 border rounded-2xl outline-none" placeholder="Daily Note..." rows={3} />
//                 <div className="grid gap-2">
//                     <button onClick={() => onSubmit("Follow Up", "High")} className="p-4 rounded-2xl border hover:bg-red-50 flex items-center gap-3"><Flag size={20} className="text-red-600" /> <span className="font-bold text-slate-800">High Priority</span></button>
//                     <button onClick={() => onSubmit("Follow Up", "Medium")} className="p-4 rounded-2xl border hover:bg-amber-50 flex items-center gap-3"><Flag size={20} className="text-amber-600" /> <span className="font-bold text-slate-800">Medium Priority</span></button>
//                     <button onClick={() => onSubmit("Follow Up", "Low")} className="p-4 rounded-2xl border hover:bg-emerald-50 flex items-center gap-3"><Flag size={20} className="text-emerald-600" /> <span className="font-bold text-slate-800">Low Priority</span></button>
//                 </div>
//             </div>
//         </div>
//     </div>
// );

const ClosingModal = ({ note, setNote, onClose, onSubmit }) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity">
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95">
            <div className="px-6 pt-6 pb-2 flex items-center justify-between">
                <div><h3 className="text-xl font-bold text-emerald-700">Lead Closed! 🎉</h3><p className="text-sm text-slate-500 mt-1">Add a quick note.</p></div>
                <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-4 text-sm bg-emerald-50 border border-emerald-100 rounded-2xl outline-none" rows={4} autoFocus />
                <button onClick={() => onSubmit("Closed")} disabled={!note.trim()} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"><Check size={18} /> Confirm</button>
            </div>
        </div>
    </div>
);

const MediaViewer = ({ media, onClose }) => (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
        <button className="absolute top-4 right-4 text-white p-2" onClick={onClose}> <X size={24} /> </button>
        <div className="relative max-w-5xl max-h-full w-full flex justify-center" onClick={e => e.stopPropagation()}>
            {media.type?.includes("video") ? (
                <video src={media.url} controls autoPlay className="max-w-full max-h-[90vh] rounded shadow-2xl" />
            ) : media.type?.includes("pdf") || media.type?.includes("document") ? (
                <iframe src={media.url} className="w-[90vw] md:w-[80vw] h-[90vh] bg-white rounded shadow-2xl" />
            ) : (
                <img src={media.url} alt="Full View" className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" />
            )}
        </div>
    </div>
);  
>>>>>>> c1be5bc (Initial commit from new system)
