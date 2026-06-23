"use client";

import { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chatStore";
import { usePathStore } from "@/stores/pathStore";
import { useCrmLayout } from "@/components/layout/CrmShell";
import {
  ArrowLeft, User, Phone, MapPin, Tag, FileText,
  MessageSquare, History, Briefcase, Clock,
  AlertCircle, Copy, Check, Loader2, Menu, Globe,
  BadgeCheck, RefreshCcw, TrendingUp, UserCircle, CornerDownRight,
  ChevronDown, ChevronUp, Filter, ChevronLeft, ChevronRight, X, CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { useSession } from "next-auth/react";

// ─────────────────────────────────────────────────────────────────────────────
//  LIFECYCLE & UI CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const LIFECYCLE_CONFIG = {
    "New":            { color: "blue",    icon: <AlertCircle size={12} /> },
    "Follow Up":      { color: "amber",   icon: <Clock size={12} /> },
    "Closed":         { color: "emerald", icon: <BadgeCheck size={12} /> },
    "Not Interested": { color: "slate",   icon: <X size={12} /> },
};

const LifecycleBadge = ({ state }) => {
    const cfg = LIFECYCLE_CONFIG[state] ?? LIFECYCLE_CONFIG["New"];
    const cls = {
        blue:   "bg-blue-50 text-blue-700 border-blue-200",
        amber:  "bg-amber-50 text-amber-700 border-amber-200",
        emerald:"bg-emerald-50 text-emerald-700 border-emerald-200",
        slate:  "bg-slate-100 text-slate-600 border-slate-200",
    }[cfg.color];
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${cls} whitespace-nowrap`}>
            {cfg.icon} {state}
        </span>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function LeadDetailsPage({ params }) {
  const unwrappedParams  = use(params);
  const phone = decodeURIComponent(unwrappedParams.phone);

  const {setMobileOpen} = useCrmLayout()
  const { data: session }       = useSession();
  const router                  = useRouter();
  const { setSelectedChat }     = useChatStore();
  const lastPath = usePathStore((state) => state.lastpath);
  
    const [lead, setLead]             = useState(null); 
  const [loading, setLoading]       = useState(true);
  const [copied, setCopied]         = useState(false);

  // ── Timeline Filter & Pagination State ──
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterAssociate, setFilterAssociate] = useState("All");
  const [timelinePage, setTimelinePage] = useState(1);
  const [expandedNodes, setExpandedNodes] = useState({});

  const ITEMS_PER_PAGE = 4;

  // ── Fetch lead strictly via API ───────────────────────────────────────────
  useEffect(() => {
    if (!phone) return;

    const fetchLead = async () => {
      try {
        setLoading(true);
        const res  = await fetch(`/api/leads/${encodeURIComponent(phone)}`, { cache: "no-store" });
        const data = await res.json();
        
        if (Object.keys(data).length > 0) setLead(data);
      } catch (err) {
        console.error("Failed to load lead:", err);
        toast.error("Could not load lead details");
      } finally {
        setLoading(false);
      }
    };

    fetchLead();
  }, [phone]);

  // ── DERIVED INTELLIGENCE LAYER ────────────────────────────────────────────
const intelligence = useMemo(() => {
      if (!lead) return null;

      const timeline = lead.history || [];
      
      // 🚀 THE FIX: Pure Logic -> Count ONLY if status === "Closed"
      const interactionCount = timeline.filter(item => item.status === "Closed").length;
      
      const firstFollowUp = timeline.length > 0 ? timeline[0] : {};
      const latestFollowUp = timeline.length > 0 ? timeline[timeline.length - 1] : {};

      const originHandler = firstFollowUp.associateName || lead.assignedTo || "Unassigned";
      const currentHandler = latestFollowUp.associateName || lead.assignedTo || "Unassigned";

      const currentStatus = latestFollowUp.status || "New";
      const currentPriority = latestFollowUp.priority || "Medium";
      const currentEnquiry = latestFollowUp.enquiredFor || "None specified";
      const currentRemarks = latestFollowUp.overAllRemarks || "No remarks added.";
      const leadType = latestFollowUp.leadType || "Direct Lead";
      const saleAmount = parseInt(latestFollowUp.saleAmount) || 0;

      const isClosed = currentStatus === "Closed";
      const closedBy = isClosed ? currentHandler : null;

      let ownershipTransitionText = null;
      if (isClosed) {
          ownershipTransitionText = (closedBy && closedBy !== originHandler) ? `Closed by ${closedBy}` : "Closed";
      }

      return {
          timeline,
          interactionCount,
          originHandler,
          currentHandler,
          currentStatus,
          currentPriority,
          currentEnquiry,
          currentRemarks,
          leadType,
          saleAmount,
          isClosed,
          closedBy,
          ownershipTransitionText
      };
  }, [lead]);

  // ── TIMELINE PROCESSING (Enrich -> Filter -> Paginate) ────────────────────
  
  // 1. Enrich data chronologically (compute ownership changes before sorting)
  const enrichedTimeline = useMemo(() => {
      if (!intelligence?.timeline) return [];
      return intelligence.timeline.map((fu, idx, arr) => {
          const prev = arr[idx - 1]; // chronological previous
          const ownershipChanged = prev && prev.associateName !== fu.associateName;
          return { ...fu, ownershipChanged, originalIndex: idx };
      }).reverse(); // Reverse to show newest first
  }, [intelligence]);

  // 2. Filter options dynamically extracted
  const uniqueAssociates = useMemo(() => ["All", ...new Set(enrichedTimeline.map(f => f.associateName).filter(Boolean))], [enrichedTimeline]);
  const uniqueTypes = useMemo(() => ["All", ...new Set(enrichedTimeline.map(f => f.leadType).filter(Boolean))], [enrichedTimeline]);

  // Reset page when filters change
  useEffect(() => { setTimelinePage(1); setExpandedNodes({}); }, [filterStatus, filterType, filterAssociate]);

  // 3. Filter Data
  const filteredTimeline = useMemo(() => {
      return enrichedTimeline.filter(fu => {
          const matchStatus = filterStatus === "All" || fu.status === filterStatus;
          const matchType = filterType === "All" || fu.leadType === filterType;
          const matchAssociate = filterAssociate === "All" || fu.associateName === filterAssociate;
          return matchStatus && matchType && matchAssociate;
      });
  }, [enrichedTimeline, filterStatus, filterType, filterAssociate]);

  // 4. Paginate Data
  const totalPages = Math.ceil(filteredTimeline.length / ITEMS_PER_PAGE);
  const paginatedTimeline = filteredTimeline.slice((timelinePage - 1) * ITEMS_PER_PAGE, timelinePage * ITEMS_PER_PAGE);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleCopyPhone = () => {
    if (!lead?.phone) return;
    navigator.clipboard.writeText(lead.phone.replace('whatsapp:', ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Phone copied");
  };

  const handleOpenChat = () => {
    if (!lead || !intelligence) return;
    setSelectedChat({
      phone:     lead.phone,
      name:      lead.name || lead.phone.replace('whatsapp:', ''),
      status:    intelligence.currentStatus,
      priority:  intelligence.currentPriority,
      direction: "OUTBOUND",
      read:      "TRUE",
      timestamp: new Date().toISOString(),
    });
    router.push("/crm/chat");
  };

  const toggleNode = (id) => {
      setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Render States ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 size={32} className="animate-spin text-[#00a884]" />
            <p className="text-sm font-bold tracking-wide uppercase">Syncing Audit Trail…</p>
          </div>
        </div>
      </Shell>
    );
  }

  if (!lead || !intelligence) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-white m-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 border border-slate-100">
            <User size={32} className="text-slate-300" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Lead Record Missing</h2>
          <p className="text-slate-500 mb-8 max-w-sm text-sm font-medium">
            This lead identity could not be resolved in the database.
          </p>
          <Link href={lastPath ? lastPath : "/crm/leads"} className="px-6 py-3 bg-[#00a884] text-white rounded-xl font-bold hover:bg-emerald-600 transition shadow-md shadow-emerald-200/50 flex items-center gap-2">
            <ArrowLeft size={16}/> Return to Pipeline
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc]">

        {/* ── HEADER ── */}
        <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 sticky top-0 shadow-sm gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 transition hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
            <Link href={lastPath ? lastPath : "/crm/leads"} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition border border-transparent hover:border-slate-200"><ArrowLeft size={20} /></Link>
            <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 leading-tight tracking-tight">Lead & Customer History</h1>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">Audit & Interaction Record</p>
            </div>
          </div>
          <button onClick={handleOpenChat} className="flex items-center justify-center gap-2 bg-[#00a884] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-200/50 transition-all active:scale-95 w-full md:w-auto">
            <MessageSquare size={18} /> <span className="hidden sm:inline">Open CRM Chat</span>
          </button>
        </header>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-[1200px] mx-auto space-y-6 lg:space-y-8">

            {/* ── HERO SUMMARY LAYER ── */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">
              <div className="p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative">
                
                {/* Identity Anchor */}
                <div className="flex items-center gap-5 flex-1 min-w-0">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 flex items-center justify-center font-extrabold text-2xl shrink-0 border-2 border-white shadow-sm ring-1 ring-slate-100">
                        {lead.name?.charAt(0).toUpperCase() || "#"}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                            <h2 className="font-extrabold text-slate-800 text-2xl md:text-3xl truncate tracking-tight">{lead.name || "Unknown Identity"}</h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm font-medium text-slate-500">
                            <div className="flex items-center gap-1.5 cursor-pointer hover:text-[#00a884] transition-colors group bg-slate-50 px-2 py-1 rounded-md border border-slate-100" onClick={handleCopyPhone} title="Click to copy">
                                <Phone size={14} className="text-slate-400 group-hover:text-[#00a884]" />
                                <span className="font-mono tracking-wide">{lead.phone.replace('whatsapp:', '')}</span>
                                {copied ? <Check size={12} className="text-[#00a884]" /> : <Copy size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                            {lead.city && (
                                <span className="flex items-center gap-1.5 truncate bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                                    <MapPin size={14} className="shrink-0 text-slate-400"/> {lead.city}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Lifecycle & Ownership Anchor */}
                <div className="flex flex-col lg:items-start gap-2.5 flex-1 min-w-0 border-l-2 border-transparent lg:border-slate-100 lg:pl-8">
                    <div className="flex flex-wrap items-center gap-2">
                        <LifecycleBadge state={intelligence.currentStatus} />

                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${intelligence.currentPriority === "High" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-50 text-slate-600 border-slate-200"}`}>
                            {intelligence.currentPriority === "High" && <AlertCircle size={12} />}
                            {intelligence.currentPriority} Priority
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 mt-1">
                        <UserCircle size={14} className="text-slate-400" />
                        Current Handler: <span className="text-[#00a884] font-bold">{intelligence.currentHandler}</span>
                    </div>
                </div>

                {/* Activity & Revenue Anchor */}
                <div className="flex flex-col lg:items-end gap-2 shrink-0 border-l-2 border-transparent lg:border-slate-100 lg:pl-8">
                    <div className="flex items-center gap-2 text-sm font-extrabold text-slate-700 bg-blue-50/50 px-3 py-1.5 rounded-lg border border-blue-100/50">
                        <History size={16} className="text-blue-500" />
                        {intelligence.interactionCount} Interaction Cycle{intelligence.interactionCount !== 1 ? 's' : ''}
                    </div>
                    {intelligence.isClosed && intelligence.saleAmount > 0 && (
                        <div className="bg-gradient-to-r from-emerald-500 to-[#00a884] text-white px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-sm shadow-emerald-200/50 mt-1 w-max lg:w-auto">
                            <TrendingUp size={16} />
                            <span className="text-sm font-bold tracking-wide">Revenue: ₹{intelligence.saleAmount.toLocaleString()}</span>
                        </div>
                    )}
                </div>
              </div>
            </div>

            {/* ── TWO-COLUMN CONTENT AREA ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

              {/* LEFT — Context & Remarks */}
              <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Briefcase size={16} className="text-[#00a884]" /> Contextual Meta
                  </h3>
                  <div className="space-y-4">
                    <DetailRow icon={<Globe size={14} />} label="Origin Source">{lead.source || "N/A"}</DetailRow>
                    <DetailRow icon={<Tag size={14} />} label="Active Enquiry"><span className="font-bold text-slate-800">{intelligence.currentEnquiry}</span></DetailRow>
                    <DetailRow icon={<Tag size={14} />} label="Lead Category"><span className="bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-semibold text-xs border border-slate-200">{intelligence.leadType}</span></DetailRow>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-teal-50/30 rounded-2xl border border-emerald-100/50 p-6 shadow-sm">
                  <h3 className="text-xs font-extrabold text-emerald-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <FileText size={16} className="text-emerald-600"/> Latest Remarks
                  </h3>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed italic bg-white/60 p-4 rounded-xl border border-emerald-100/50 shadow-sm">
                    "{intelligence.currentRemarks}"
                  </p>
                </div>
              </div>

              {/* RIGHT — Progressive Interaction Timeline */}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 lg:p-8 h-full flex flex-col">
                  
                  {/* Timeline Header & Filters */}
                  <div className="flex flex-col mb-8 gap-4 border-b border-slate-100 pb-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <History size={18} className="text-[#00a884]" /> Interaction Audit
                          </h3>
                          <p className="text-xs font-medium text-slate-400 mt-1">Review lifecycle history, handoffs, and progressions.</p>
                        </div>
                        <span className="bg-slate-50 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 shrink-0">
                          {filteredTimeline.length} Record{filteredTimeline.length !== 1 ? "s" : ""}
                        </span>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 px-2 border-r border-slate-200">
                            <Filter size={14} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-500 uppercase">Filters</span>
                        </div>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-slate-300">
                            <option value="All">All Statuses</option>
                            <option value="New">New</option>
                            <option value="Follow Up">Follow Up</option>
                            <option value="Closed">Closed</option>
                            <option value="Not Interested">Not Interested</option>
                        </select>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-slate-300">
                            {uniqueTypes.map(t => <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>)}
                        </select>
                        <select value={filterAssociate} onChange={e => setFilterAssociate(e.target.value)} className="bg-white border border-slate-200 text-xs font-bold text-slate-600 rounded-lg px-3 py-1.5 outline-none cursor-pointer hover:border-slate-300">
                            {uniqueAssociates.map(a => <option key={a} value={a}>{a === "All" ? "All Handlers" : a}</option>)}
                        </select>
                    </div>
                  </div>

                  {/* Accordion Timeline Engine */}
                  <div className="relative pl-4 sm:pl-8 space-y-6 before:absolute before:left-[21px] sm:before:left-[37px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 flex-1">
                    {paginatedTimeline.length > 0 ? (
                      paginatedTimeline.map((fu, idx) => {
                          const isLatest = timelinePage === 1 && idx === 0 && filterStatus === "All" && filterType === "All" && filterAssociate === "All";
                          const isExpanded = !!expandedNodes[fu._id || fu.originalIndex];
                          const truncatedRemarks = fu.overAllRemarks?.length > 60 ? fu.overAllRemarks.substring(0, 60) + '...' : fu.overAllRemarks;

                          return (
                              <div key={fu._id || fu.originalIndex} className="relative group">
                                  {/* Timeline Node Connector */}
                                  <div className={`absolute -left-[23px] sm:-left-[39px] top-4 w-3.5 h-3.5 rounded-full border-2 shadow-sm transition-colors ${isLatest ? 'bg-[#00a884] border-white ring-2 ring-[#00a884]/30' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}></div>

                                  <div className={`bg-white border rounded-2xl transition-all relative overflow-hidden ${isExpanded ? 'border-slate-300 shadow-md' : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'}`}>
                                      
                                      {/* Collapsed Header (Clickable) */}
                                      <div 
                                          onClick={() => toggleNode(fu._id || fu.originalIndex)} 
                                          className="p-4 sm:p-5 cursor-pointer flex flex-col gap-3 bg-white hover:bg-slate-50/50 transition-colors select-none"
                                      >
                                          <div className="flex flex-wrap sm:flex-nowrap justify-between items-start sm:items-center gap-2">
                                              <div className="flex flex-wrap items-center gap-3">
                                                  <LifecycleBadge state={fu.status} />
                                                  <span className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                                                      <Clock size={12} className="text-slate-400"/> {new Date(fu.date).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute:"2-digit" })}
                                                  </span>
                                              </div>
                                              <div className="text-slate-400 bg-slate-50 p-1 rounded-full">
                                                  <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#00a884]' : ''}`} />
                                              </div>
                                          </div>

                                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                              <div className={`text-[11px] font-bold flex items-center gap-1.5 px-2.5 py-1 rounded-md border w-max ${fu.ownershipChanged ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-slate-50 border-slate-100 text-slate-600"}`}>
                                                  <UserCircle size={14} className={fu.ownershipChanged ? "text-blue-500" : "text-slate-400"} />
                                                  {fu.associateName || "Unknown"}
                                              </div>
                                              {fu.ownershipChanged && (
                                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-blue-600 flex items-center gap-1">
                                                      <RefreshCcw size={10}/> Transferred
                                                  </span>
                                              )}
                                          </div>

                                          {/* Truncated Preview (Hides when expanded) */}
                                          {!isExpanded && (
                                              <div className="text-sm text-slate-500 truncate pr-8 font-medium">
                                                  {fu.overAllRemarks ? `"${truncatedRemarks}"` : <span className="italic text-slate-400">No remarks documented.</span>}
                                              </div>
                                          )}
                                      </div>

                                      {/* Expanded Body Layer */}
                                      {isExpanded && (
                                          <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/30 animate-in fade-in slide-in-from-top-2 duration-200">
                                              
                                              {fu.enquiredFor && (
                                                  <div className="mb-3 text-sm text-slate-800 flex items-center gap-2">
                                                      <span className="font-bold text-slate-400 text-xs uppercase tracking-wider">Context:</span> 
                                                      <span className="font-semibold bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">{fu.enquiredFor}</span>
                                                  </div>
                                              )}

                                              {fu.overAllRemarks && (
                                                  <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-700 font-medium italic shadow-sm relative">
                                                      <CornerDownRight size={16} className="absolute top-4 left-4 text-slate-300" />
                                                      <span className="pl-6 block">"{fu.overAllRemarks}"</span>
                                                  </div>
                                              )}

                                              {/* Day-wise Progression Sub-nodes */}
                                              {(fu.day1Remarks || fu.day2Remarks || fu.day3Remarks) && (
                                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-slate-100 pt-4 mt-4">
                                                      {fu.day1Remarks && <DayNote day={1} text={fu.day1Remarks} />}
                                                      {fu.day2Remarks && <DayNote day={2} text={fu.day2Remarks} />}
                                                      {fu.day3Remarks && <DayNote day={3} text={fu.day3Remarks} />}
                                                  </div>
                                              )}

                                              {/* Revenue Attribution */}
                                              {fu.status === "Closed" && parseInt(fu.saleAmount) > 0 && (
                                                  <div className="mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold px-3.5 py-2 rounded-lg w-max shadow-sm">
                                                      <TrendingUp size={16} className="text-emerald-600" />
                                                      Deal Closed Value: ₹{parseInt(fu.saleAmount).toLocaleString()}
                                                  </div>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              </div>
                          );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-slate-200 border-dashed ml-[-24px] sm:ml-[-32px]">
                        <Clock size={32} className="mb-3 opacity-20" />
                        <p className="text-sm font-bold uppercase tracking-wider">No Records Found</p>
                      </div>
                    )}
                  </div>

                  {/* ── Premium Pagination Layer ── */}
                  <TimelinePagination 
                      current={timelinePage} 
                      total={totalPages} 
                      onChange={setTimelinePage} 
                  />
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function Shell({ children }) {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
      {children}
    </div>
  );
}

function DetailRow({ icon, label, children }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        {icon} {label}
      </p>
      <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 font-semibold text-slate-700 text-sm">
        {children}
      </div>
    </div>
  );
} 

const DayNote = ({ day, text }) => (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:border-[#00a884]/30 transition-colors">
        <div className="text-[10px] font-extrabold text-[#00a884] uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Clock size={10}/> Day {day} Log
        </div>
        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{text}</p>
    </div>
);

const TimelinePagination = ({ current, total, onChange }) => {
    if (total <= 1) return null;

    return (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <button 
                onClick={() => onChange(current - 1)} 
                disabled={current === 1}
                className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
                <ChevronLeft size={14} /> Prev
            </button>
            
            <div className="flex items-center gap-1.5">
                {[...Array(total)].map((_, i) => {
                    const page = i + 1;
                    const isActive = page === current;
                    // Keep pagination visual tight
                    if (total > 5 && Math.abs(page - current) > 1 && page !== 1 && page !== total) {
                        if (page === 2 || page === total - 1) return <span key={page} className="text-slate-400 text-xs px-1">...</span>;
                        return null;
                    }

                    return (
                        <button 
                            key={page}
                            onClick={() => onChange(page)}
                            className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-extrabold transition-all shadow-sm ${isActive ? 'bg-gradient-to-tr from-emerald-500 to-[#00a884] text-white border-transparent' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                        >
                            {page}
                        </button>
                    )
                })}
            </div>

            <button 
                onClick={() => onChange(current + 1)} 
                disabled={current === total}
                className="flex items-center gap-1 px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-full hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
                Next <ChevronRight size={14} />
            </button>
        </div>
    );
};
