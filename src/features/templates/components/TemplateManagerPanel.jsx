import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTemplateStore } from "@/features/templates/stores/templateStore";
import { toast } from "react-toastify";
import { 
    Layers, Search, X, Loader2, LayoutTemplate, ExternalLink, Image as ImageIcon,
    Clock, CheckCircle2, AlertCircle, Info, PhoneCall, FastForward, PauseCircle, XCircle, Signal 
} from "lucide-react";
import { useDebounce } from "@/shared/hooks/useDebounce";

// --- NORMALIZATION LOGIC ---
const normalizeStatus = (rawStatus) => {
    if (!rawStatus) return "draft";
    const s = rawStatus.toLowerCase();
    if (s.includes("approve")) return "approved";
    if (s.includes("reject") || s.includes("fail")) return "rejected";
    if (s.includes("pend") || s.includes("submit")) return "pending";
    if (s === "paused") return "paused";
    if (s === "disabled") return "disabled";
    if (s === "received") return "received";
    return "draft"; 
};

export default function TemplateManagerPanel({ open, onClose, onSelect, selectedId }) {
    const { templates, loading, forceRefresh } = useTemplateStore();

    // ─── Local State ────────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [expandedRejections, setExpandedRejections] = useState({});

    // ─── Refs for Focus & Scroll management ──────────────────────────────────
    const searchInputRef = useRef(null);
    const triggerElementRef = useRef(null);

    // Refresh store & manage side effects (Scroll lock, escape key, focus) when panel opens/closes
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        if (open) {
            forceRefresh();
            setSearchQuery("");
            setActiveFilter("ALL");
            setExpandedRejections({});

            // Save the currently focused element (the trigger button)
            triggerElementRef.current = document.activeElement;

            // Lock background body scroll
            document.body.style.overflow = "hidden";

            // Bind Escape key event listener
            window.addEventListener("keydown", handleKeyDown);

            // Auto-focus search input after drawer transition completes
            const focusTimer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 150);

            return () => {
                document.body.style.overflow = "";
                window.removeEventListener("keydown", handleKeyDown);
                clearTimeout(focusTimer);

                // Return focus to the trigger button
                if (triggerElementRef.current && typeof triggerElementRef.current.focus === "function") {
                    triggerElementRef.current.focus();
                }
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // ─── Helper: Format Preview Body ────────────────────────────────────────
    const formatPreviewBody = (text) => {
        if (!text) return { __html: "Your message body will appear here..." };
        let formatted = text
            .replace(/\*([^\*]+)\*/g, "<strong>$1</strong>")
            .replace(/_([^_]+)_/g, "<em>$1</em>")
            .replace(/~([^~]+)~/g, "<del>$1</del>")
            .replace(/\{\{(\d+)\}\}/g, `<span class="bg-emerald-100 text-emerald-800 px-1 rounded font-mono text-[11px] mx-0.5">{{$1}}</span>`);
        return { __html: formatted.replace(/\n/g, "<br/>") };
    };

    const toggleRejection = (e, sid) => {
        e.stopPropagation();
        setExpandedRejections(prev => ({
            ...prev,
            [sid]: !prev[sid]
        }));
    };

    // ─── Filter Logic ───────────────────────────────────────────────────────
    
    // Normalize templates on the fly
    const normalizedTemplates = useMemo(() => {
        const rawTpls = Array.isArray(templates) ? templates : [];
        return rawTpls.map(t => ({
            ...t,
            normalizedStatus: normalizeStatus(t.whatsapp?.status)
        }));
    }, [templates]);

    const filterCounts = useMemo(() => {
        const counts = { ALL: normalizedTemplates.length, APPROVED: 0, RECEIVED: 0, PENDING: 0, REJECTED: 0, PAUSED: 0, DISABLED: 0, DRAFT: 0 };
        normalizedTemplates.forEach(t => {
            const s = t.normalizedStatus.toUpperCase();
            if (counts[s] !== undefined) counts[s]++;
        });
        return counts;
    }, [normalizedTemplates]);

    const filteredTemplates = useMemo(() => {
        let filtered = [...normalizedTemplates];

        // 1. Status Filter
        if (activeFilter !== "ALL") {
            filtered = filtered.filter(t => t.normalizedStatus.toUpperCase() === activeFilter);
        }

        // 2. Search Filter
        if (debouncedSearchQuery.trim() !== "") {
            const query = debouncedSearchQuery.toLowerCase().trim();
            filtered = filtered.filter(t => 
                (t.name && t.name.toLowerCase().includes(query)) || 
                (t.sid && t.sid.toLowerCase().includes(query)) ||
                (t.whatsapp?.category && t.whatsapp.category.toLowerCase().includes(query)) ||
                (t.language && t.language.toLowerCase().includes(query))
            );
        }
        
        return filtered;
    }, [normalizedTemplates, activeFilter, debouncedSearchQuery]);


    // ─── Render Helpers ───────────────────────────────────────────────────────
    const renderChannelEligibility = (tpl) => {
        const status = tpl.normalizedStatus;
        const rejectionReason = tpl.whatsapp?.rejection_reason;
        const isExpanded = expandedRejections[tpl.sid];

        if (status === "approved") {
            return (
                <span className="inline-flex items-center gap-1 w-max text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                    <CheckCircle2 size={12} strokeWidth={2.5} /> Approved
                </span>
            );
        }
        if (status === "rejected") {
            return (
                <div className="flex flex-col gap-1 w-full">
                    <span className="inline-flex items-center gap-1 w-max text-[10px] font-bold uppercase tracking-widest text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
                        <XCircle size={12} strokeWidth={2.5} /> Rejected
                    </span>
                    {rejectionReason && (
                        <div 
                            onClick={(e) => toggleRejection(e, tpl.sid)}
                            className="mt-1 cursor-pointer bg-rose-50/50 p-2 rounded border border-rose-100/50 hover:bg-rose-50 transition-colors"
                        >
                            <div className="flex items-center gap-1.5 mb-0.5">
                                <Info size={10} className="text-rose-500" />
                                <span className="text-[9px] font-bold uppercase tracking-widest text-rose-600">Rejection Reason</span>
                            </div>
                            <p className={`text-[11px] text-rose-600 font-medium leading-snug whitespace-pre-wrap ${!isExpanded ? "line-clamp-2" : ""}`}>
                                {rejectionReason}
                            </p>
                            {rejectionReason.length > 80 && (
                                <p className="text-[9px] font-bold text-rose-400 mt-1 uppercase text-right">
                                    {isExpanded ? "Show Less" : "Read More"}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            );
        }
        if (status === "received") {
             return (
                <span className="inline-flex items-center gap-1 w-max text-[10px] font-bold uppercase tracking-widest text-green-700 bg-green-50 px-2 py-1 rounded border border-green-200">    
                    <Signal size={12} strokeWidth={2.5} className="text-green-500" /> Received
                </span>
            );
        }

        if (status === "pending") {
             return (
                <span className="inline-flex items-center gap-1 w-max text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    <Clock size={12} strokeWidth={2.5} /> Pending
                </span>
            );
        }
        if (status === "paused") {
             return (
                <span className="inline-flex items-center gap-1 w-max text-[10px] font-bold uppercase tracking-widest text-orange-700 bg-orange-50 px-2 py-1 rounded border border-orange-200">
                    <PauseCircle size={12} strokeWidth={2.5} /> Paused
                </span>
            );
        }
        if (status === "disabled") {
             return (
                <span className="inline-flex items-center gap-1 w-max text-[10px] font-bold uppercase tracking-widest text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-300">
                    <XCircle size={12} strokeWidth={2.5} /> Disabled
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 w-max text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                <AlertCircle size={12} strokeWidth={2.5} /> Draft
            </span>
        );
    };

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} 
                onClick={onClose} 
            />
            
            {/* Drawer Panel */}
            <div className={`fixed top-0 right-0 h-[100dvh] w-full md:w-[600px] bg-slate-50 border-l border-slate-200 shadow-2xl z-[1000] flex flex-col transform transition-transform duration-300 ease-out ${open ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"}`}>
                
                {/* Header */}
                <div className="p-5 border-b border-slate-200 bg-white flex flex-col gap-4 shrink-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                                <Layers size={20} />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-slate-800 text-lg leading-none tracking-tight">Select Template</h3>
                                <p className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-wider">Campaign Library</p>
                            </div>
                        </div>
                        <button className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all" onClick={onClose}>
                            <X size={18} />
                        </button>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            ref={searchInputRef}
                            type="text" 
                            placeholder="Search by name, SID, language, category..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400 text-slate-700"
                        />
                    </div>

                    {/* Filter Pills */}
                    <div className="flex items-center gap-2 overflow-x-auto hide-scrollbar pb-1">
                        {["ALL", "APPROVED", "RECEIVED", "PENDING", "REJECTED", "PAUSED", "DISABLED", "DRAFT"].map((filter) => {
                            const count = filterCounts[filter] || 0;
                            return (
                                <button 
                                    key={filter}
                                    onClick={() => setActiveFilter(filter)}
                                    className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                                        activeFilter === filter 
                                        ? "bg-slate-800 text-white shadow-md shadow-slate-200" 
                                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                    {filter}
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${activeFilter === filter ? "bg-slate-600 text-slate-200" : "bg-slate-100 text-slate-500"}`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative bg-slate-50/50">
                    {loading && normalizedTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-3">
                            <Loader2 className="animate-spin text-emerald-500" size={24} />
                            <span className="text-sm font-bold uppercase tracking-widest">Loading Library from Twilio...</span>
                        </div>
                    ) : filteredTemplates.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-3 border border-slate-200 shadow-sm">
                                <Search size={20} className="text-slate-400" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-700">No templates found</h4>
                            <p className="text-xs text-slate-500 mt-1">Try adjusting your search or filters.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4 pb-4">
                            {filteredTemplates.map(tpl => {
                                const isSelected = selectedId === tpl.sid;
                                const isApproved = tpl.normalizedStatus === "approved" || tpl.normalizedStatus === "received" || tpl.normalizedStatus === "pending";

                                return (
                                    <div 
                                        key={tpl.sid} 
                                        onClick={() => isApproved  ? onSelect(tpl.sid, tpl.name) : toast.error("Only Approved templates can be selected for sending.")}
                                        className={`bg-white rounded-2xl p-4 transition-all relative overflow-hidden group ${
                                            isSelected 
                                            ? "border-2 border-emerald-500 shadow-md ring-4 ring-emerald-500/10 cursor-pointer" 
                                            : isApproved 
                                                ? "border border-slate-200 hover:border-emerald-300 hover:shadow-md cursor-pointer"
                                                : "border border-slate-200 opacity-70 cursor-not-allowed grayscale-[0.2]"
                                        }`}
                                    >
                                        {isSelected && (
                                            <div className="absolute top-0 right-0 w-12 h-12 overflow-hidden pointer-events-none z-20">
                                                <div className="absolute top-0 right-0 w-[200%] h-[200%] bg-emerald-500 origin-bottom-left rotate-45 translate-x-1/2 -translate-y-1/2 flex items-end justify-center pb-1">
                                                    <CheckCircle2 size={12} className="text-white -rotate-45 mb-1" />
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-4">
                                            <div className="flex-1 min-w-0 pr-6">
                                                <h4 className="font-extrabold text-slate-800 text-[15px] leading-snug truncate">{tpl.name}</h4>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{tpl.sid}</span>
                                                    <span className="text-[9px] font-bold text-slate-600 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{tpl.language}</span>
                                                    
                                                    {/* Format Badge */}
                                                    <div className="flex items-center gap-1 text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                                                        {tpl.templateType === "TEXT" && <LayoutTemplate size={10} className="text-slate-400" />}
                                                        {tpl.templateType === "WHATSAPP_CARD" && <ImageIcon size={10} className="text-slate-400" />}
                                                        {tpl.templateType === "CALL_TO_ACTION" && <ExternalLink size={10} className="text-slate-400" />}
                                                        <span className="text-[9px] font-bold uppercase">{tpl.templateType === "TEXT" ? "Text" : tpl.templateType === "WHATSAPP_CARD" ? "Card" : "Action"}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className="shrink-0 flex items-start z-10">
                                                {renderChannelEligibility(tpl)}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-4">
                                            {/* Preview Box */}
                                            <div className="w-full">
                                                <div className="bg-[#EFEAE2] rounded-xl p-3 h-full relative overflow-hidden flex flex-col min-h-[120px]">
                                                    <div className="absolute inset-0 opacity-10 mix-blend-multiply pointer-events-none" style={{ backgroundImage: "url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')", backgroundSize: '150px' }}></div>
                                                    
                                                    {/* Message Bubble */}
                                                    <div className="bg-white rounded-lg rounded-tl-none p-2.5 shadow-sm max-w-[90%] relative z-10 text-[12px] leading-relaxed text-slate-800 border border-slate-100">
                                                        {/* Header */}
                                                        {tpl.headerType === "TEXT" && tpl.headerText && <div className="font-extrabold text-[13px] mb-1 leading-snug">{tpl.headerText}</div>}
                                                        {tpl.headerType === "MEDIA" && (
                                                            <div className="w-full h-20 bg-slate-100 rounded mb-2 flex items-center justify-center border border-slate-200 overflow-hidden relative">
                                                                {tpl.mediaUrl ? <img src={tpl.mediaUrl} className="w-full h-full object-cover opacity-80" alt="media" /> : <ImageIcon size={20} className="text-slate-300" />}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Body */}
                                                        <div className="whitespace-pre-wrap word-break" dangerouslySetInnerHTML={formatPreviewBody(tpl.body)} />
                                                        
                                                        {/* Footer */}
                                                        {tpl.footerText && <div className="text-[10px] text-slate-400 mt-1 font-medium leading-tight">{tpl.footerText}</div>}
                                                    </div>

                                                    {/* Buttons */}
                                                    {tpl.buttons && tpl.buttons.length > 0 && (
                                                        <div className="mt-1 flex flex-col gap-1 max-w-[90%] relative z-10">
                                                            {tpl.buttons.map((btn, i) => (
                                                                <div key={i} className="bg-white rounded-lg shadow-sm border border-slate-100 py-1.5 px-2 flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#00a884]">
                                                                    {btn.type === "URL" ? <ExternalLink size={12} /> : btn.type === "PHONE_NUMBER" ? <PhoneCall size={12} /> : <FastForward size={12} />}
                                                                    <span className="truncate">{btn.title}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}