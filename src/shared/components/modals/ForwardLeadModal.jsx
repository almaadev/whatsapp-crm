"use client";
import api from "@/shared/lib/axios";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { X, Send, User, Phone, MessageSquare, Share2, CheckCircle2, RotateCcw } from "lucide-react";
<<<<<<<< HEAD:src/shared/components/modals/ForwardLeadModal.jsx
import { useChatStore } from "@/features/chat/stores/chatStore";
import { toast } from "react-toastify";
import { leadRepository } from "@/shared/api/repositories/leadRepository";
========
import { useChatStore } from "@/stores/chatStore";
import { toast } from "react-toastify";
import api from "@/lib/axios";
>>>>>>>> 11ffb49e9c4b9bb7d6e6f9c45923b32f6d216d32:src/components/modals/ForwardLeadModal.jsx

export default function ForwardLeadModal({ isOpen, onClose, customer, onConfirm }) {
    const [targetPhone, setTargetPhone] = useState("+91");
    const [targetName, setTargetName] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const [toggleLoading, setToggleLoading] = useState(false);

    const selectedChat = useChatStore((s) => s.selectedChat);
    const { data: session } = useSession();
    const updateChatDetails = useChatStore((s) => s.updateChatDetails);

    const currentHandler = selectedChat?.currentHandler;
    const currentUser = session?.user?.name;
    const canModify = (currentHandler === currentUser) || !currentHandler || currentHandler === "Unassigned";

    // FIX: Only update message when the CUSTOMER changes, not on every poll
    useEffect(() => {
        if (customer) {
            const defaultMsg = `*Forwarding Lead*\nName: ${customer.name || "Unknown"}\nPhone: ${customer.phone}\n\nPlease take over this inquiry.`;
            setMessage(defaultMsg);
        }
    }, [customer?.phone]);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!targetPhone || targetPhone.length < 10) return toast.warning("Enter valid associate phone number");
        if (!targetName) return toast.warning("Enter associate name");

        setLoading(true);
        await onConfirm(targetPhone, targetName, message);
        setLoading(false);
        setTargetPhone("+91");
        setTargetName("");
        onClose();
    };

    const handleToggleClosed = async () => {
        if (!selectedChat) return;
        setToggleLoading(true);
        try {
            const { data } = await api.post("/api/leads/close", {
                mobile: selectedChat.phone,
                currentState: selectedChat.isClosed
            });
            updateChatDetails(selectedChat.phone, { isClosed: data.newState });
            toast.success(data.newState === "TRUE" ? "Lead marked as completed" : "Lead re-opened");
        } catch (error) {
            toast.error("Error updating status.");
        } finally {
            setToggleLoading(false);
        }
    };

    return (
        <div className={`
        fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl z-[60] border-l border-slate-200 flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "translate-x-full"}
    `}>
            {/* Panel Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 shrink-0 bg-[#0b8343] text-white">
                <h2 className="font-bold text-lg flex items-center gap-2">
                    <Share2 size={20} className="text-emerald-400" /> Forward Lead
                </h2>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition p-2 hover:bg-white/10 rounded-lg">
                    <X size={20} />
                </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/50 custom-scrollbar">

                {/* Customer Context (Preview) */}
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Active Lead</p>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
                            {customer?.name ? customer.name.charAt(0).toUpperCase() : <User size={18} />}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-800">{customer?.name || "Unknown"}</p>
                            <p className="text-xs text-slate-500 font-mono">{customer?.phone}</p>
                        </div>
                    </div>
                </div>

                {/* Warning if access denied */}
                {!canModify && (
                    <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 rounded">
                        <p className="font-bold"> {selectedChat?.currentHandler} is the current handler.</p>
                        <p className="text-sm mt-1">You are not the current handler of this lead.</p>
                        <p className="text-xs mt-2 opacity-80">Only the active handler or admin can view details and forward this lead.</p>
                    </div>
                )}

                {/* New Forward Form Inputs (Only if Allowed) */}
                {canModify && (
                    <div className="space-y-4 pt-4 border-t border-slate-200">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Transfer</h3>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Associate / Branch Name</label>
                            <div className="relative group">
                                <User className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={16} />
                                <input
                                    placeholder="Name of receiving associate or branch"
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm text-slate-700"
                                    value={targetName}
                                    onChange={(e) => setTargetName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1"> WhatsApp Number</label>
                            <div className="relative group">
                                <Phone className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={16} />
                                <input
                                    placeholder="+91..."
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-mono text-slate-700"
                                    value={targetPhone}
                                    onChange={(e) => setTargetPhone(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Note / Forwarding Message</label>
                            <div className="relative group">
                                <MessageSquare className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={16} />
                                <textarea
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm text-slate-700 h-32 resize-none leading-relaxed"
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* History Section (Only if Allowed) */}
                {selectedChat?.lastForwardedTo && canModify && (
                    <div className={`p-4 rounded-2xl border transition-all ${selectedChat.isClosed === "TRUE"
                            ? "bg-slate-100 border-slate-200 opacity-80"
                            : "bg-white border-emerald-100 shadow-sm"
                        }`}>
                        <div className="flex justify-between items-start mb-2">
                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1">
                                <Share2 size={12} /> Previously Forwarded
                            </p>
                            <button
                                onClick={handleToggleClosed}
                                disabled={toggleLoading}
                                className={`p-1 rounded-md transition-colors ${selectedChat.isClosed === "TRUE"
                                        ? "text-emerald-600 hover:bg-emerald-50"
                                        : "text-slate-400 hover:bg-slate-100"
                                    }`}
                            >
                                {selectedChat.isClosed === "TRUE" ? <RotateCcw size={16} /> : <CheckCircle2 size={16} />}
                            </button>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <p className="text-md font-bold text-slate-800">{selectedChat.lastForwardedName}</p>
                                {selectedChat.isClosed === "TRUE" && (
                                    <span className="bg-emerald-500 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
                                        DONE <CheckCircle2 size={10} />
                                    </span>
                                )}
                            </div>

                            {selectedChat.isClosed !== "TRUE" ? (
                                <div>
                                    <p className="text-md text-slate-500 font-mono">{selectedChat.lastForwardedTo}</p>
                                    <p className="text-xs text-slate-400 mt-1">{selectedChat.forwardDate}</p>
                                    <div className="mt-3 p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs italic text-slate-600">
                                        "{selectedChat.forwardMessage}"
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[10px] text-slate-400 italic">Details hidden (Lead Completed)</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Button (Only if Allowed) */}
            {canModify && (
                <div className="p-6 border-t border-slate-100 bg-white shrink-0">
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {loading ? "Processing..." : <><Send size={18} /> Forward to Associate</>}
                    </button>
                </div>
            )}
        </div>
    );
}