"use client";

import { useState, useEffect, use, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { usePathStore } from "@/features/chat/stores/pathStore";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import {
  ArrowLeft, User, Phone, MapPin, Tag, FileText,
  MessageSquare, History, Briefcase, Clock,
  AlertCircle, Copy, Check, Loader2, Menu, Globe,
  BadgeCheck, RefreshCcw, TrendingUp, UserCircle, CornerDownRight,
  ChevronDown, ChevronUp, Filter, ChevronLeft, ChevronRight, X, CheckCircle2,
  IndianRupee, ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { useSession } from "next-auth/react";
import { leadRepository } from "@/shared/api/repositories/leadRepository";
import { useAuth } from "@/shared/hooks/useAuth";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import { getActivityTitle } from "@/shared/utils/activityFormatter";
// ─────────────────────────────────────────────────────────────────────────────
//  MODERN ENTERPRISE STATUS BADGES
// ─────────────────────────────────────────────────────────────────────────────
const StatusBadge = ({ status, labelOverride }) => {
    const configs = {
        'New': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <AlertCircle size={12} /> },
        'Follow Up': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <Clock size={12} /> },
        'Closed': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <BadgeCheck size={12} /> },
        'Not Interested': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', icon: <X size={12} /> },
        'High': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: <AlertCircle size={12} /> },
        'Medium': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: <ShieldAlert size={12} /> },
        'Low': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <Check size={12} /> },
    };
    
    const config = configs[status] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: <Tag size={12} /> };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm whitespace-nowrap ${config.bg} ${config.text} ${config.border}`}>
            {config.icon} {labelOverride || status}
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
  const { user, isLoading, hasModuleAccess } = useAuth();
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
        const { data }  = await leadRepository.getLeadByPhone(encodeURIComponent(phone));
        
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

      const followups = lead.history || [];
      const activities = (lead.chatHistory || [])
        .map((act, index) => {
          let performerName = "System Admin";
          if (act.performedBy) {
            if (typeof act.performedBy === "object" && act.performedBy.name) {
              performerName = act.performedBy.name;
            } else if (typeof act.performedBy === "string") {
              performerName = act.performedBy;
            }
          }
          const formattedTitle = getActivityTitle(act.eventType, performerName, act.metadata || act);
          let mappedStatus = "Active";
          if (act.eventType === "LEAD_STATUS_CHANGED") {
            mappedStatus = act.metadata?.newStatus || "Follow Up";
          } else if (act.eventType === "LEAD_CREATED") {
            mappedStatus = "New";
          } else if (act.eventType === "FOLLOWUP_CREATED") {
            mappedStatus = "Follow Up";
          } else if (act.eventType === "FOLLOWUP_COMPLETED") {
            mappedStatus = "Closed";
          }
          return {
            _id: act._id || `act-${index}`,
            date: act.timestamp || act.createdAt,
            status: mappedStatus,
            associateName: performerName,
            overAllRemarks: formattedTitle,
            enquiredFor: "",
            isActivity: true,
            eventType: act.eventType
          };
        });

      const timeline = [...followups, ...activities].sort((a, b) => new Date(a.date) - new Date(b.date));
      
      const interactionCount = followups.filter(interaction => interaction.status === "Closed").length;
      
      const firstFollowUp = followups.length > 0 ? followups[0] : {};
      const latestFollowUp = followups.length > 0 ? followups[followups.length - 1] : {};

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
          timeline, interactionCount, originHandler, currentHandler,
          currentStatus, currentPriority, currentEnquiry, currentRemarks,
          leadType, saleAmount, isClosed, closedBy, ownershipTransitionText
      };
  }, [lead]);

  // ── TIMELINE PROCESSING (Enrich -> Filter -> Paginate) ────────────────────
  
  const enrichedTimeline = useMemo(() => {
      if (!intelligence?.timeline) return [];
      return intelligence.timeline.map((leadInteraction, index, interactionsList) => {
          const prev = interactionsList[index - 1]; // chronological previous
          const leadTransferred = prev && prev.associateName !== leadInteraction.associateName;
          return { ...leadInteraction, leadTransferred, originalIndex: index };
      }).reverse(); // Reverse to show newest first
  }, [intelligence]);

  const uniqueAssociates = useMemo(() => ["All", ...new Set(enrichedTimeline.map(f => f.associateName).filter(Boolean))], [enrichedTimeline]);
  const uniqueTypes = useMemo(() => ["All", ...new Set(enrichedTimeline.map(f => f.leadType).filter(Boolean))], [enrichedTimeline]);

  useEffect(() => { setTimelinePage(1); setExpandedNodes({}); }, [filterStatus, filterType, filterAssociate]);

  const filteredTimeline = useMemo(() => {
      return enrichedTimeline.filter(fu => {
          const matchStatus = filterStatus === "All" || fu.status === filterStatus;
          const matchType = filterType === "All" || fu.leadType === filterType;
          const matchAssociate = filterAssociate === "All" || fu.associateName === filterAssociate;
          return matchStatus && matchType && matchAssociate;
      });
  }, [enrichedTimeline, filterStatus, filterType, filterAssociate]);

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
  const isAuthorized = hasModuleAccess("Leads");

  if (isLoading) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#f4f7f9]">
          <Loader2 size={36} className="animate-spin text-[#00a884] mb-4" />
          <p className="text-sm font-semibold tracking-wide text-slate-500">Syncing Interaction Audit...</p>
        </div>
      </Shell>
    );
  }

  if (!user && !session) return null;

  if (!isAuthorized) {
    return (
      <Shell>
        <AccessDenied message="You do not have permission to access Lead Details." />
      </Shell>
    );
  }

  if (loading) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center bg-[#f4f7f9]">
          <Loader2 size={36} className="animate-spin text-[#00a884] mb-4" />
          <p className="text-sm font-semibold tracking-wide text-slate-500">Syncing Interaction Audit...</p>
        </div>
      </Shell>
    );
  }

  if (!lead || !intelligence) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#f4f7f9]">
          <div className="w-20 h-20 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center mb-6">
            <User size={32} className="text-slate-300" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Lead Record Missing</h2>
          <p className="text-slate-500 mb-8 max-w-sm text-sm">This lead identity could not be resolved in the database.</p>
          <Link href={lastPath ? lastPath : "/crm/leads"} className="px-6 py-2.5 bg-[#00a884] text-white rounded-xl font-semibold shadow-sm hover:bg-emerald-600 transition flex items-center gap-2">
            <ArrowLeft size={16}/> Return to Pipeline
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f4f7f9] font-sans">

        {/* ── HEADER ── */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 z-30 sticky top-0 shadow-sm shadow-slate-100/50">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"><Menu size={20} /></button>
            <Link href={lastPath ? lastPath : "/crm/leads"} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"><ArrowLeft size={20} /></Link>
            <div className="pl-2 border-l border-slate-200">
                <h1 className="text-[18px] font-bold text-slate-900 leading-tight">Lead Audit Profile</h1>
                <p className="text-[11px] font-semibold text-slate-500 tracking-wide uppercase mt-0.5">Interaction History</p>
            </div>
          </div>
          <button onClick={handleOpenChat} className="flex items-center justify-center gap-2 bg-[#00a884] text-white px-5 py-2.5 rounded-xl text-[13px] font-bold shadow-md shadow-emerald-500/20 hover:bg-emerald-600 transition-all">
            <MessageSquare size={16} /> <span className="hidden sm:inline">Open Chat</span>
          </button>
        </header>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto space-y-6 lg:space-y-8">

            {/* ── 1. PREMIUM HERO SECTION ── */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 md:p-8 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-full -z-0"></div>
              
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                <div className="flex items-start md:items-center gap-6">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl font-extrabold text-[#00a884] border border-slate-200 shadow-sm shrink-0">
                        {lead.name?.charAt(0).toUpperCase() || "#"}
                    </div>
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none">{lead.name || "Unknown Identity"}</h2>
                            <StatusBadge status={intelligence.currentStatus} />
                            {intelligence.currentPriority && <StatusBadge status={intelligence.currentPriority} />}
                        </div>
                        <div className="flex flex-wrap items-center gap-4 pt-1">
                            <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors" onClick={handleCopyPhone} title="Click to copy">
                                <Phone size={14} className="text-slate-500" />
                                <span className="text-[15px] font-semibold text-slate-800">{lead.phone.replace('whatsapp:', '')}</span>
                                {copied ? <Check size={14} className="text-[#00a884]" /> : <Copy size={12} className="text-slate-400" />}
                            </div>
                            {lead.city && (
                                <span className="flex items-center gap-1.5 text-[15px] font-medium text-slate-600 px-2">
                                    <MapPin size={16} className="text-slate-400"/> {lead.city}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 border-t lg:border-none border-slate-100 pt-6 lg:pt-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200">
                        <UserCircle size={18} className="text-slate-400" />
                        Current Handler: <span className="text-slate-900 font-bold">{intelligence.currentHandler}</span>
                    </div>
                </div>
              </div>
            </div>

            {/* ── 2. KPI DASHBOARD CARDS ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                <KPICard title="Total Interactions" value={intelligence.timeline.length} icon={<History size={20}/>} accent="text-blue-600 bg-blue-50 border-blue-100" />
                <KPICard title="Closed Cycles" value={intelligence.interactionCount} icon={<CheckCircle2 size={20}/>} />
                <KPICard title="Revenue Generated" value={`₹${intelligence.saleAmount.toLocaleString()}`} icon={<IndianRupee size={20}/>} accent={intelligence.saleAmount > 0 ? "text-[#00a884] bg-emerald-50 border-emerald-100" : undefined} />
                <KPICard title="Priority Status" value={intelligence.currentPriority} icon={<ShieldAlert size={20}/>} />
            </div>

            {/* ── TWO-COLUMN CONTENT AREA ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">

              {/* LEFT — Context & Remarks */}
              <div className="lg:col-span-4 space-y-6 lg:space-y-8">
                
                {/* Contextual Meta */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 md:p-8">
                  <h3 className="text-[18px] font-bold text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
                    <Briefcase size={18} className="text-slate-400" /> Lead Context
                  </h3>
                  <div className="space-y-6">
                    <DetailRow icon={<Globe size={16} />} label="Origin Source" value={lead.source} />
                    <DetailRow icon={<Tag size={16} />} label="Active Enquiry" value={intelligence.currentEnquiry} />
                    <DetailRow icon={<Tag size={16} />} label="Lead Category" value={intelligence.leadType} />
                  </div>
                </div>

                {/* Latest Remarks */}
                <div className="bg-gradient-to-br from-[#f8f6ff] to-white rounded-3xl shadow-sm border border-[#eaddff] p-6 md:p-8">
                  <h3 className="text-[18px] font-bold text-purple-900 mb-4 flex items-center gap-2">
                    <FileText size={18} className="text-purple-500"/> Latest Remarks
                  </h3>
                  <div className="p-5 bg-white/80 backdrop-blur-sm rounded-2xl text-[15px] text-slate-800 min-h-[100px] whitespace-pre-wrap border border-purple-100 leading-relaxed font-medium shadow-sm italic">
                    {intelligence.currentRemarks ? `"${intelligence.currentRemarks}"` : <span className="text-slate-400 not-italic">No remarks available.</span>}
                  </div>
                </div>
              </div>

              {/* RIGHT — Progressive Interaction Timeline */}
              <div className="lg:col-span-8">
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 md:p-8 h-full flex flex-col">
                  
                  {/* Timeline Header & Filters */}
                  <div className="flex flex-col mb-8 gap-5 border-b border-slate-100 pb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-[18px] font-bold text-slate-900 flex items-center gap-2">
                            <History size={18} className="text-slate-400" /> 
                            Lead Timeline
                          </h3>
                          <p className="text-[13px] font-medium text-slate-500 mt-1">Review lifecycle history, handoffs, and progressions.</p>
                        </div>
                        <span className="bg-slate-50 text-slate-600 text-[13px] font-bold px-4 py-2 rounded-xl border border-slate-200 shrink-0 shadow-sm">
                          {filteredTimeline.length} Record{filteredTimeline.length !== 1 ? "s" : ""}
                        </span>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
                        <div className="flex items-center gap-2 px-3 border-r border-slate-200 shrink-0">
                            <Filter size={16} className="text-slate-400" />
                            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline">Filters</span>
                        </div>
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="flex-1 min-w-[120px] bg-white border border-slate-200 text-[13px] font-semibold text-slate-700 rounded-xl px-3 py-2 outline-none cursor-pointer hover:border-slate-300 shadow-sm transition-colors">
                            <option value="All">All Statuses</option>
                            <option value="New">New</option>
                            <option value="Follow Up">Follow Up</option>
                            <option value="Closed">Closed</option>
                            <option value="Not Interested">Not Interested</option>
                        </select>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="flex-1 min-w-[120px] bg-white border border-slate-200 text-[13px] font-semibold text-slate-700 rounded-xl px-3 py-2 outline-none cursor-pointer hover:border-slate-300 shadow-sm transition-colors">
                            {uniqueTypes.map(t => <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>)}
                        </select>
                        <select value={filterAssociate} onChange={e => setFilterAssociate(e.target.value)} className="flex-1 min-w-[120px] bg-white border border-slate-200 text-[13px] font-semibold text-slate-700 rounded-xl px-3 py-2 outline-none cursor-pointer hover:border-slate-300 shadow-sm transition-colors">
                            {uniqueAssociates.map(a => <option key={a} value={a}>{a === "All" ? "All Handlers" : a}</option>)}
                        </select>
                    </div>
                  </div>

                  {/* Accordion Timeline Engine */}
                  <div className="relative pl-4 sm:pl-8 space-y-6 before:absolute before:left-[23px] sm:before:left-[39px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 flex-1">
                    {paginatedTimeline.length > 0 ? (
                      paginatedTimeline.map((fu, idx) => {
                          const isLatest = timelinePage === 1 && idx === 0 && filterStatus === "All" && filterType === "All" && filterAssociate === "All";
                          const isExpanded = !!expandedNodes[fu._id || fu.originalIndex];
                          const truncatedRemarks = fu.overAllRemarks?.length > 70 ? fu.overAllRemarks.substring(0, 70) + '...' : fu.overAllRemarks;

                          return (
                              <div key={fu._id || fu.originalIndex} className="relative group">
                                  {/* Timeline Node Connector */}
                                  <div className={`absolute -left-[25px] sm:-left-[41px] top-6 w-4 h-4 rounded-full border-2 shadow-sm transition-colors z-10 ${isLatest ? 'bg-[#00a884] border-white ring-4 ring-[#00a884]/20' : 'bg-white border-slate-300 group-hover:border-slate-400'}`}></div>

                                  <div className={`bg-white border rounded-2xl transition-all relative overflow-hidden ${isExpanded ? 'border-[#00a884]/30 shadow-md ring-4 ring-[#00a884]/5' : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'}`}>
                                      
                                      {/* Collapsed Header (Clickable) */}
                                      <div 
                                          onClick={() => toggleNode(fu._id || fu.originalIndex)} 
                                          className="p-5 cursor-pointer flex flex-col gap-3 bg-white hover:bg-slate-50/50 transition-colors select-none"
                                      >
                                          <div className="flex flex-wrap sm:flex-nowrap justify-between items-start sm:items-center gap-2">
                                              <div className="flex flex-wrap items-center gap-3">
                                                  <StatusBadge status={fu.status} labelOverride={fu.isActivity ? fu.overAllRemarks : null} />
                                                  <span className="text-[12px] font-semibold text-slate-500 flex items-center gap-1.5">
                                                      <Clock size={12} className="text-slate-400"/> {new Date(fu.date).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute:"2-digit" })}
                                                  </span>
                                              </div>
                                              <div className="text-slate-400 bg-slate-50 border border-slate-200 p-1 rounded-lg">
                                                  <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180 text-[#00a884]' : ''}`} />
                                              </div>
                                          </div>

                                          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                              <div className={`text-[12px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-lg border w-max shadow-sm ${fu.leadTransferred ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-slate-50 border-slate-200 text-slate-700"}`}>
                                                  <UserCircle size={14} className={fu.leadTransferred ? "text-blue-500" : "text-slate-400"} />
                                                  {fu.associateName || "Unknown"}
                                              </div>
                                              {fu.leadTransferred && (
                                                  <span className="text-[11px] font-bold uppercase tracking-widest text-blue-600 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-md">
                                                      <RefreshCcw size={12}/>Transferred
                                                  </span>
                                              )}
                                          </div>

                                          {/* Truncated Preview */}
                                          {!isExpanded && (
                                              <div className="text-[14px] text-slate-600 truncate pr-8 font-medium mt-1">
                                                  {fu.overAllRemarks ? `"${truncatedRemarks}"` : <span className="italic text-slate-400">No remarks documented.</span>}
                                              </div>
                                          )}
                                      </div>

                                      {/* Expanded Body Layer */}
                                      {isExpanded && (
                                          <div className="px-5 pb-6 pt-2 border-t border-slate-100 bg-slate-50/50 animate-in fade-in slide-in-from-top-2 duration-200">
                                              
                                              {fu.enquiredFor && (
                                                  <div className="mb-4 text-[14px] text-slate-800 flex items-center gap-2">
                                                      <span className="font-bold text-slate-500 text-[11px] uppercase tracking-widest">Context:</span> 
                                                      <span className="font-semibold bg-white border border-slate-200 px-3 py-1 rounded-lg shadow-sm">{fu.enquiredFor}</span>
                                                  </div>
                                              )}

                                              {fu.overAllRemarks && (
                                                  <div className="bg-white border border-slate-200 rounded-2xl p-5 text-[14px] text-slate-700 font-medium italic shadow-sm relative mb-4">
                                                      <CornerDownRight size={18} className="absolute top-5 left-5 text-slate-300" />
                                                      <span className="pl-8 block leading-relaxed">"{fu.overAllRemarks}"</span>
                                                  </div>
                                              )}

                                              {/* Day-wise Progression Sub-nodes */}
                                              {(fu.day1Remarks || fu.day2Remarks || fu.day3Remarks) && (
                                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-200/60 pt-5">
                                                      {fu.day1Remarks && <DayNote day={1} text={fu.day1Remarks} />}
                                                      {fu.day2Remarks && <DayNote day={2} text={fu.day2Remarks} />}
                                                      {fu.day3Remarks && <DayNote day={3} text={fu.day3Remarks} />}
                                                  </div>
                                              )}

                                              {/* Revenue Attribution */}
                                              {fu.status === "Closed" && parseInt(fu.saleAmount) > 0 && (
                                                  <div className="mt-5 flex items-center gap-2 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-800 text-[13px] font-bold px-4 py-2.5 rounded-xl w-max shadow-sm">
                                                      <TrendingUp size={18} className="text-emerald-600" />
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
                      <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50/50 rounded-3xl border border-slate-200 border-dashed ml-[-24px] sm:ml-[-32px]">
                        <History size={40} className="mb-4 opacity-20" />
                        <p className="text-[14px] font-bold uppercase tracking-widest text-slate-500">No Records Found</p>
                        <p className="text-[13px] font-medium text-slate-400 mt-1">Try adjusting your filters.</p>
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

// KPI Dashboard Card
function KPICard({ title, value, icon, accent = "bg-white border-slate-200/80 text-slate-800 hover:border-slate-300 hover:shadow-md transition-all duration-300" }) {
    return (
        <div className={`rounded-3xl p-5 border shadow-sm flex flex-col justify-between group ${accent}`}>
            <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 group-hover:scale-110 group-hover:text-slate-600 transition-all duration-300">
                    {icon}
                </div>
            </div>
            <p className="text-2xl md:text-3xl font-extrabold tracking-tight leading-none break-words">{value}</p>
        </div>
    );
}

// Detail Row for Information Cards
function DetailRow({ icon, label, value }) {
  return (
      <div className="flex flex-col gap-2 group w-full">
          <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="text-slate-400">{icon}</span> {label}
          </label>
          <div className="min-h-[44px] flex items-center pt-1 border-b border-transparent group-hover:border-slate-100 transition-colors">
              {value ? (
                  <span className="text-[15px] font-semibold text-slate-800 break-words w-full">
                      {value}
                  </span>
              ) : (
                  <div className="flex items-center gap-2 text-slate-400 bg-slate-50/50 px-3 py-1.5 rounded-lg text-sm border border-slate-100 w-max">
                      <span className="italic">Not specified</span>
                  </div>
              )}
          </div>
      </div>
  );
}

const DayNote = ({ day, text }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:border-[#00a884]/30 transition-colors">
        <div className="text-[11px] font-bold text-[#00a884] uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <Clock size={12}/> Day {day} Log
        </div>
        <p className="text-[13px] text-slate-600 font-medium leading-relaxed">{text}</p>
    </div>
);

const TimelinePagination = ({ current, total, onChange }) => {
    if (total <= 1) return null;

    return (
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <button 
                onClick={() => onChange(current - 1)} 
                disabled={current === 1}
                className="flex items-center gap-1 px-4 py-2 text-[13px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
                <ChevronLeft size={16} /> Prev
            </button>
            
            <div className="flex items-center gap-2">
                {[...Array(total)].map((_, i) => {
                    const page = i + 1;
                    const isActive = page === current;
                    if (total > 5 && Math.abs(page - current) > 1 && page !== 1 && page !== total) {
                        if (page === 2 || page === total - 1) return <span key={page} className="text-slate-400 text-xs px-1 font-bold">...</span>;
                        return null;
                    }

                    return (
                        <button 
                            key={page}
                            onClick={() => onChange(page)}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl text-[13px] font-extrabold transition-all shadow-sm ${isActive ? 'bg-gradient-to-tr from-[#00a884] to-emerald-500 text-white border-transparent' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}
                        >
                            {page}
                        </button>
                    )
                })}
            </div>

            <button 
                onClick={() => onChange(current + 1)} 
                disabled={current === total}
                className="flex items-center gap-1 px-4 py-2 text-[13px] font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
                Next <ChevronRight size={16} />
            </button>
        </div>
    );
};