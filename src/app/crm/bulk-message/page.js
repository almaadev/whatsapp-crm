"use client";

import { useState } from "react";
import Sidebar from "@/components/layout/Sidebar";
import { toast } from "react-toastify";
import {
    Send, Hash, Loader2, CheckCircle2, AlertCircle,
    Layers, ChevronRight, X
} from "lucide-react";
import { useSession } from "next-auth/react";
import TemplateManagerPanel from "@/components/features/chat/Templatemanagerpanel";

export default function BulkTemplatePage() {
    const { data: session } = useSession();
    const userRole = session?.user?.role || "associate";
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // ─── Messaging state ──────────────────────────────────────────────────────
    const [numbersText, setNumbersText] = useState("");
    const [templateId, setTemplateId] = useState("");         // internal SID — never shown in UI
    const [selectedName, setSelectedName] = useState("");     // display label only
    const [isSending, setIsSending] = useState(false);
    const [progress, setProgress] = useState({ sent: 0, total: 0, failed: 0 });

    // ─── Template panel state ─────────────────────────────────────────────────
    const [panelOpen, setPanelOpen] = useState(false);

    const handleTemplateSelect = (sid, name) => {
        setTemplateId(sid || "");
        setSelectedName(name || "");
    };

    // ─── Bulk send (unchanged logic) ──────────────────────────────────────────
    const handleBulkSend = async () => {
        const extracted = numbersText.match(/\d{10,15}/g) || [];
        const uniqueNumbers = [...new Set(extracted)];

        if (!uniqueNumbers.length || !templateId) {
            return toast.error("Please enter numbers and select a Template");
        }

        setIsSending(true);
        setProgress({ sent: 0, total: uniqueNumbers.length, failed: 0 });

        const batchSize = 50;
        for (let i = 0; i < uniqueNumbers.length; i += batchSize) {
            const batch = uniqueNumbers.slice(i, i + batchSize);
            try {
                const res = await fetch("/api/bulk-message", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ numbers: batch, templateId }),
                });
                const data = await res.json();
                setProgress(prev => ({
                    ...prev,
                    sent: prev.sent + (data.successCount || 0),
                    failed: prev.failed + (data.failedCount || (batch.length - (data.successCount || 0))),
                }));
            } catch {
                setProgress(prev => ({ ...prev, failed: prev.failed + batch.length }));
            }
        }
        setIsSending(false);
        toast.success("Campaign Completed!");
    };

    // ─── Derived values ───────────────────────────────────────────────────────
    const done = progress.sent + progress.failed;
    const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
    const extracted = numbersText.match(/\d{10,15}/g) || [];
    const recipientCount = [...new Set(extracted)].length;
    const canSend = !isSending && recipientCount > 0 && !!templateId;

    return (
        <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-sans">
            <div className="flex-shrink-0 z-40">
                <Sidebar role={userRole} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
            </div>

            <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                <div className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8">

                    {/* Header Section */}
                    <div className="flex flex-col gap-2 border-b border-slate-200 pb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full w-max text-xs font-bold uppercase tracking-wider">
                            <Send size={12} />
                            Twilio Campaign
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
                            Bulk Template Messenger
                        </h1>
                        <p className="text-sm font-medium text-slate-500">
                            Send templated WhatsApp messages safely at 50 numbers per batch.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                        {/* LEFT COLUMN - RECIPIENTS (7 columns wide) */}
                        <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-600">
                                    <Hash size={16} className="text-[#00a884]" />
                                    Recipients
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                    Detected
                                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{recipientCount}</span>
                                    unique numbers
                                </div>
                            </div>
                            <div className="p-6">
                                <textarea
                                    className="w-full h-[400px] p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 text-sm font-mono text-slate-700 leading-relaxed resize-none custom-scrollbar transition-all"
                                    value={numbersText}
                                    onChange={(e) => setNumbersText(e.target.value)}
                                    placeholder={"Paste numbers here...\n9876543210, 9988776655\n9123456789, 9000112233"}
                                />
                                
                                <div className="flex items-center justify-between mt-3">
                                    <span className="text-[11px] font-mono text-slate-500">Separated by comma, space, or newline</span>
                                    {numbersText && (
                                        <button
                                            onClick={() => setNumbersText("")}
                                            className="text-xs font-mono text-slate-500 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer"
                                        >
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* RIGHT COLUMN - CONFIG & ACTIONS (5 columns wide) */}
                        <div className="lg:col-span-5 flex flex-col gap-6">

                            {/* Template Selector Card */}
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-600 mb-4">
                                    <Layers size={16} className="text-[#00a884]" />
                                    Message Template
                                </div>

                                <div className="flex items-center gap-3">
                                    {/* Selected chip / placeholder */}
                                    <div
                                        className={`flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                            templateId 
                                                ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/80 hover:border-emerald-300" 
                                                : "bg-slate-50 border-dashed border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                                        }`}
                                        onClick={() => setPanelOpen(true)}
                                        title={templateId ? "Change template" : "Open template library"}
                                    >
                                        {templateId ? (
                                            <>
                                                <div className="w-8 h-8 rounded-lg flex-shrink-0 bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                                                    <Layers size={14} className="text-emerald-600" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-bold text-emerald-800 truncate">{selectedName}</div>
                                                    <div className="text-[10px] font-mono text-emerald-600/70 mt-0.5">Template selected</div>
                                                </div>
                                                <button
                                                    className="p-1 text-emerald-500 hover:text-red-500 transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer"
                                                    onClick={e => { e.stopPropagation(); handleTemplateSelect(null, null); }}
                                                    title="Clear selection"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex-1 text-sm font-semibold text-slate-500 px-2">
                                                    No template selected
                                                </div>
                                                <ChevronRight size={16} className="text-slate-400" />
                                            </>
                                        )}
                                    </div>

                                    {/* Open library button */}
                                    <button 
                                        className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold transition-colors hover:bg-slate-100 flex-shrink-0"
                                        onClick={() => setPanelOpen(true)}
                                    >
                                        <Layers size={14} />
                                        Library
                                    </button>
                                </div>
                            </div>

                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm">
                                    <span className="text-2xl font-bold text-slate-800 leading-none mb-1">{recipientCount}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total</span>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm">
                                    <span className="text-2xl font-bold text-emerald-600 leading-none mb-1">{progress.sent}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70">Sent</span>
                                </div>
                                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm">
                                    <span className="text-2xl font-bold text-red-500 leading-none mb-1">{progress.failed}</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-red-600/70">Failed</span>
                                </div>
                            </div>

                            {/* Progress Card */}
                            {(isSending || progress.total > 0) && (
                                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                            {isSending && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                                            {isSending ? "Broadcasting..." : "Campaign Complete"}
                                        </span>
                                        <span className="text-sm font-bold text-[#00a884] font-mono">{pct}%</span>
                                    </div>
                                    
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-500 ease-out ${!isSending && pct === 100 ? "bg-[#059669]" : "bg-gradient-to-r from-emerald-400 to-[#00a884]"}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>

                                    <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1.5 text-emerald-600">
                                                <CheckCircle2 size={14} /> {progress.sent} Delivered
                                            </span>
                                            <span className="flex items-center gap-1.5 text-red-500">
                                                <AlertCircle size={14} /> {progress.failed} Failed
                                            </span>
                                        </div>
                                        <span className="font-mono text-slate-400">{done} / {progress.total}</span>
                                    </div>
                                </div>
                            )}

                            <hr className="border-slate-200 my-1" />

                            {/* Action Button */}
                            <button
                                onClick={handleBulkSend}
                                disabled={!canSend}
                                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md mt-auto
                                    ${(!canSend) 
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                                        : "bg-[#00a884] text-white hover:bg-emerald-600 hover:shadow-lg active:scale-[0.98]"
                                    }`}
                            >
                                {isSending ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" /> 
                                        Batch {Math.min(Math.ceil((done + 1) / 50), Math.ceil(progress.total / 50))} of {Math.ceil(progress.total / 50)}...
                                    </>
                                ) : (
                                    <>
                                        <Send size={18} /> Launch Campaign
                                    </>
                                )}
                            </button>

                            <p className="text-center text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
                                Processed in Batches of 50 · Twilio Content API
                            </p>
                        </div>

                    </div>
                </div>
            </div>

            {/* ── Template Manager Drawer ── */}
            <TemplateManagerPanel
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
                selectedId={templateId}
                onSelect={(sid, name) => {
                    handleTemplateSelect(sid, name);
                    if (sid) setPanelOpen(false);
                }}
            />
        </div>
    );
}