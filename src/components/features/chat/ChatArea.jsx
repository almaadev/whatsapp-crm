"use client";
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

export default function ChatArea() {
    const { data: session } = useSession();
    const userRole = session?.user?.role || "associate";
    const userName = session?.user?.name || "User";
    const { selectedChat, messages: allMessages, addMessage, setSelectedChat, updateChatDetails, updateMessageStatus } = useChatStore();

    const [sending, setSending] = useState(false);
    const [isInfoOpen, setIsInfoOpen] = useState(false);

    const [showScrollButton, setShowScrollButton] = useState(false);
    const [showForwardModal, setShowForwardModal] = useState(false);
    const [showReminderModal, setShowReminderModal] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState(null);

    const [showPriorityModal, setShowPriorityModal] = useState(false);
    const [showClosingModal, setShowClosingModal] = useState(false);
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

    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
    }, [messages.length, activeChat?.phone]);

    const handleScroll = () => {
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

        setShowPriorityModal(false);
        setShowClosingModal(false);
        toast.success(`Status updated to ${newStatus}`);

        try {
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
            toast.error("Failed to save status. Reverting...");
            updateChatDetails(activeChat.phone, originalChat);
        }
    };


    const handleSend = async (text) => {
        if (!text.trim() || !activeChat) return;

        const tempId = Date.now().toString();

        const newMessage = {
            phone: activeChat.phone,
            message: text,
            direction: "OUTBOUND",
            timestamp: new Date().toISOString(),
            name: activeChat.name,
            status: "Sending",
            role: userRole,
            tempId: tempId
        };

        addMessage(newMessage);
        setSending(true);
        setTimeout(() => scrollToBottom(), 100);

        try {
            // if (currentLeadStatus === 'New') initiateStatusChange('Follow Up');

            if (!navigator.onLine) throw new Error("Offline");

            const res = await chatService.sendMessage(newMessage);

            updateMessageStatus(activeChat.phone, tempId, "SENT", res?.twilioSid);

        } catch (error) {
            console.error("Failed to send", error);
            updateMessageStatus(activeChat.phone, tempId, "FAILED");
            toast.error("Message failed to send.");
        } finally {
            setSending(false);
        }
    };

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


    const displayName = activeChat.name || activeChat.phone.replace("whatsapp:", "");

    const followUpLabel = "Follow Up";

    return (
        <div className="flex flex-col h-full w-full relative bg-[#e5ddd5]/30">
            <CustomerInfoPanel isOpen={isInfoOpen} onClose={() => setIsInfoOpen(false)} />
            <ForwardLeadModal isOpen={showForwardModal} onClose={() => setShowForwardModal(false)} customer={activeChat} onConfirm={handleForwardLead} />
            <ReminderModal isOpen={showReminderModal} onClose={() => setShowReminderModal(false)} onSet={handleSetReminder} initialPhone={activeChat.phone} />

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
                            <p className="text-xs text-slate-500 truncate mb-0.5">{activeChat.phone.replace("whatsapp:", "")}</p>

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
                                    {/* FIX 3: Applied exact CSS styles to force breaking of continuous characters */}
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
                sending={sending}
            />
        </div>
    );
}

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
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto';
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendClick();
        }
    };

    return (
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

            <div className="flex-1 bg-white border border-slate-200 rounded-2xl flex items-center px-4 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-sm min-h-[44px]">
                <textarea
                    ref={textareaRef}
                    // 🔴 FIX: Custom Scrollbar மற்றும் Max Height சேர்க்கப்பட்டுள்ளது
                    className="w-full bg-transparent border-none text-sm outline-none placeholder:text-slate-400 resize-none py-1.5 text-slate-800 custom-scrollbar"
                    style={{ maxHeight: '150px' }} // 150px வரை பெரிதாகும், அதற்கு மேல் Scroll ஆகும்
                    placeholder="Type a message"
                    rows={1}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            <button onClick={handleSendClick} disabled={sending || !text.trim()} className={`p-3 rounded-full shadow transition-all flex-shrink-0 mb-0.5 ${text.trim() ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-200 text-slate-400"}`}>
                {sending ? <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Send size={20} className={text.trim() ? "ml-0.5" : ""} />}
            </button>
        </div>
    );
});