"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { toast } from "react-toastify";
import { twilioTemplateService } from "@/features/templates/services/twilioTemplateService";
import Link from "next/link";
import {
  LayoutTemplate, ShieldAlert, Loader2, Menu, CheckCircle2,
  Clock, AlertCircle, ExternalLink, Database,
  RefreshCw, Info, XCircle, Search, ChevronLeft, ChevronRight, Signal, PauseCircle, Trash2, Plus
} from "lucide-react";

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

export default function TemplateManager() {
  const { data: session, status } = useSession();
  const { setMobileOpen } = useCrmLayout();
  
  // --- UI & API STATE ---
  const [templates, setTemplates] = useState([]);
  const [apiState, setApiState] = useState({ loading: true, error: null });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);

  // --- FILTER & PAGINATION STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const isAuthorized = session?.user?.role === "superAdmin" || session?.user?.department === "admin";

  const loadTemplatesFromTwilio = useCallback(async (showLoadingUI = true) => {
    if (showLoadingUI) setApiState({ loading: true, error: null });
    try {
      const data = await twilioTemplateService.getTemplates();
      const normalized = data.map(t => ({ 
          ...t, 
          normalizedStatus: normalizeStatus(t.whatsapp?.status) 
      }));
      setTemplates(normalized);
      setApiState({ loading: false, error: null });
    } catch (err) {
      setApiState({ loading: false, error: err.message });
      toast.error("Failed to load templates from Twilio.");
    }
  }, []);

  useEffect(() => {
    if (isAuthorized && status === "authenticated") loadTemplatesFromTwilio(true);
  }, [isAuthorized, status, loadTemplatesFromTwilio]);

  const handleRefresh = async () => {
      if (isSyncing) return;
      setIsSyncing(true);
      const loadingId = toast.loading("Syncing live data from Twilio...");
      try {
          await loadTemplatesFromTwilio(false);
          toast.update(loadingId, { render: `Templates synchronized!`, type: "success", isLoading: false, autoClose: 2000 });
      } catch (err) {
          toast.update(loadingId, { render: "Sync failed.", type: "error", isLoading: false, autoClose: 2000 });
      } finally {
          setIsSyncing(false);
      }
  };

  const handleDeleteTemplate = async (template) => {
    const isConfirmed = window.confirm(`Are you sure you want to permanently delete "${template.name}"?`);
    if (!isConfirmed) return;
    
    setIsDeleting(template.sid);
    const loadingId = toast.loading("Deleting template from Twilio...");
    
    try {
        await twilioTemplateService.deleteTemplate(template.sid);
        toast.update(loadingId, { render: "Template deleted successfully.", type: "success", isLoading: false, autoClose: 2000 });
        setTemplates(prev => prev.filter(t => t.sid !== template.sid));
        await loadTemplatesFromTwilio(false);
    } catch (err) {
        toast.update(loadingId, { render: err.message || "Failed to delete template.", type: "error", isLoading: false, autoClose: 3000 });
    } finally {
        setIsDeleting(null);
    }
  };

  const renderChannelEligibility = (tpl) => {
    const normalizedStatus = tpl.normalizedStatus;
    const rejectionReason = tpl.whatsapp?.rejection_reason;

    if (normalizedStatus === "approved") {
        return (
            <div className="flex flex-col gap-1.5 min-w-[200px]">
                <div className="flex items-start gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-700 leading-tight">WhatsApp business initiated</span></div>
                <div className="flex items-start gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-700 leading-tight">WhatsApp user initiated</span></div>
                <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-sm">Approved</span>
            </div>
        );
    }
    if (normalizedStatus === "rejected") {
        return (
            <div className="flex flex-col gap-1.5 min-w-[200px]">
                <div className="flex items-start gap-2 opacity-60"><Info size={15} className="text-rose-500 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-500 line-through leading-tight">WhatsApp business initiated</span></div>
                <div className="flex items-start gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-700 leading-tight">WhatsApp user initiated</span></div>
                <div className="flex flex-col gap-1 mt-1 bg-rose-50 p-2 rounded-lg border border-rose-100 max-w-[300px]">
                    <span className="inline-flex items-center w-max text-[10px] font-bold uppercase tracking-widest text-rose-700">Rejected</span>
                    {rejectionReason && <p className="text-[11px] text-rose-600 font-medium leading-snug break-words whitespace-pre-wrap">{rejectionReason}</p>}
                </div>
            </div>
        );
    }
    if (normalizedStatus === "pending") {
         return (
            <div className="flex flex-col gap-1.5 min-w-[200px]">
                <div className="flex items-start gap-2"><Clock size={15} className={`text-amber-500 shrink-0 mt-0.5 ${isSyncing ? "animate-spin" : ""}`} strokeWidth={2.5} /><span className="text-[12.5px] text-slate-700 leading-tight">WhatsApp business initiated</span></div>
                <div className="flex items-start gap-2"><CheckCircle2 size={15} className="text-slate-300 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-700 leading-tight">WhatsApp user initiated</span></div>
                <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shadow-sm">Pending Approval</span>
            </div>
        );
    }
    if (normalizedStatus === "paused") {
         return (
            <div className="flex flex-col gap-1.5 min-w-[200px]">
                <div className="flex items-start gap-2 opacity-60"><PauseCircle size={15} className="text-orange-500 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-500 line-through leading-tight">WhatsApp business initiated</span></div>
                <div className="flex items-start gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-700 leading-tight">WhatsApp user initiated</span></div>
                <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 shadow-sm">Paused (Quality)</span>
            </div>
        );
    }

    if(normalizedStatus === "received") {
          return (
            <div className="flex flex-col gap-1.5 min-w-[200px]">
                <div className="flex items-start gap-2"><Signal size={15} className={`text-green-500 shrink-0 mt-0.5`} strokeWidth={2.5} /><span className="text-[12.5px] text-slate-700 leading-tight">Received from WhatsApp</span></div>
                <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 shadow-sm">Received</span>
            </div>
        );
    }
    if (normalizedStatus === "disabled") {
         return (
            <div className="flex flex-col gap-1.5 min-w-[200px]">
                <div className="flex items-start gap-2 opacity-60"><XCircle size={15} className="text-rose-500 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-500 line-through leading-tight">WhatsApp business initiated</span></div>
                <div className="flex items-start gap-2"><CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-700 leading-tight">WhatsApp user initiated</span></div>
                <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 shadow-sm">Disabled by Meta</span>
            </div>
        );
    }
    return (
        <div className="flex flex-col gap-1.5 min-w-[200px] opacity-70">
            <div className="flex items-start gap-2"><AlertCircle size={15} className="text-slate-400 shrink-0 mt-0.5" strokeWidth={2.5} /><span className="text-[12.5px] text-slate-500 italic leading-tight">Not Submitted</span></div>
            <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">Draft</span>
        </div>
    );
  };

  const filterCounts = useMemo(() => {
      const counts = { ALL: templates.length, APPROVED: 0, RECEIVED: 0, PENDING: 0, REJECTED: 0, DRAFT: 0, PAUSED: 0, DISABLED: 0 };
      templates.forEach(t => {
          const s = t.normalizedStatus.toUpperCase();
          if (counts[s] !== undefined) counts[s]++;
      });
      return counts;
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    let filtered = templates;
    if (activeFilter !== "ALL") filtered = filtered.filter(t => t.normalizedStatus.toUpperCase() === activeFilter);
    if (searchQuery.trim() !== "") {
        const q = searchQuery.toLowerCase().trim();
        filtered = filtered.filter(t => 
            (t.name && t.name.toLowerCase().includes(q)) || 
            (t.sid && t.sid.toLowerCase().includes(q)) ||
            (t.whatsapp?.category && t.whatsapp.category.toLowerCase().includes(q)) ||
            (t.language && t.language.toLowerCase().includes(q))
        );
    }
    return filtered;
  }, [templates, activeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  
  const currentTemplates = useMemo(() => {
      const startIndex = (safeCurrentPage - 1) * itemsPerPage;
      return filteredTemplates.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTemplates, safeCurrentPage, itemsPerPage]);

  useEffect(() => {
     if (currentPage !== safeCurrentPage) setCurrentPage(safeCurrentPage);
  }, [safeCurrentPage, currentPage]);

  useEffect(() => {
     setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  if (status === "loading") return <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm"><Loader2 className="animate-spin mr-2" size={20} /> Verifying Access...</div>;
  if (!isAuthorized) return <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative"><div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center"><ShieldAlert size={80} className="text-rose-400 mb-6" /><h2 className="text-3xl font-extrabold text-slate-800">Clearance Required</h2></div></div>;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[#f8fafc]">
        <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-20 shadow-sm gap-4 select-none">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2"><Database className="text-[#00a884]" size={24} /> WhatsApp Template Library</h1>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 ml-1">Create and manage your WhatsApp templates</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div id="template-library-section" className="max-w-[1400px] mx-auto bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/80 overflow-hidden flex flex-col">
            
            {/* Header & Controls */}
            <div className="p-5 md:p-6 lg:px-8 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <h3 className="font-extrabold text-slate-900 flex items-center gap-2.5 text-[20px] tracking-tight">
                  All Templates
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-1">Manage, track, and sync your WhatsApp campaign assets.</p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                        type="text" placeholder="Search templates..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none transition-all placeholder:text-slate-400 text-slate-700"
                    />
                </div>
                
                <button onClick={handleRefresh} disabled={apiState.loading || isSyncing} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-100 transition active:scale-95 disabled:opacity-50 text-slate-500 flex items-center gap-2 shrink-0">
                    <RefreshCw size={18} className={`${apiState.loading || isSyncing ? "animate-spin text-emerald-500" : ""}`} />
                </button>

                {/* NEW ROUTING BUTTON */}
                <Link href="/crm/admin/automation&templates/whatsapp-templates/create" className="py-2.5 px-4 bg-[#00a884] rounded-xl shadow-md hover:bg-[#008f6f] transition active:scale-95 text-sm font-bold text-white flex items-center gap-2 shrink-0">
                    <Plus size={18} />
                    <span className="hidden sm:inline">Create Template</span>
                </Link>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="px-5 md:px-6 lg:px-8 py-4 bg-slate-50/50 border-b border-slate-100 overflow-x-auto hide-scrollbar">
                <div className="flex items-center gap-2 w-max">
                    {["ALL", "APPROVED", "PENDING","RECEIVED" , "REJECTED", "PAUSED", "DISABLED", "DRAFT"].map((filter) => {
                        const count = filter === "ALL" ? templates.length : filterCounts[filter] || 0;
                        return (
                            <button key={filter} onClick={() => setActiveFilter(filter)} className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${ activeFilter === filter ? "bg-slate-800 text-white shadow-md shadow-slate-200" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100" }`}>
                                {filter}
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === filter ? "bg-slate-600 text-slate-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[400px] relative bg-white">
              {apiState.loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                  <Loader2 size={40} className="animate-spin text-[#00a884] mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Loading Library from Twilio...</p>
                </div>
              ) : apiState.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                  <ShieldAlert size={40} className="text-rose-500 mb-4" />
                  <p className="text-sm font-bold text-rose-600">{apiState.error}</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 md:p-24 text-center">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100 shadow-sm"><Database size={32} className="text-slate-300" /></div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Your WhatsApp Template Library is Empty</h4>
                    <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-6">Your Twilio Content Library is completely empty. Create a template to get started.</p>
                </div>
              ) : currentTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 md:p-24 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100"><Search size={24} className="text-slate-400" /></div>
                    <h4 className="text-lg font-bold text-slate-800 mb-1">No matches found</h4>
                    <p className="text-sm text-slate-500 max-w-sm">We couldn't find any templates matching "{searchQuery}" or your current filter criteria.</p>
                    <button onClick={() => { setSearchQuery(""); setActiveFilter("ALL"); }} className="mt-5 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition">Clear all filters</button>
                </div>
              ) : (
                <>
                  {/* MOBILE VIEW (CARDS) */}
                  <div className="md:hidden flex flex-col divide-y divide-slate-100">
                      {currentTemplates.map((tpl) => (
                          <div key={tpl._id || tpl.sid} className="p-5 flex flex-col gap-4 hover:bg-slate-50/50 transition-colors">
                              <div className="flex justify-between items-start gap-3">
                                  <div className="min-w-0 flex-1">
                                      <h4 className="font-extrabold text-slate-900 text-[15px] mb-1.5 break-words leading-snug">{tpl.name}</h4>
                                      <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{tpl.sid}</span>
                                          <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{tpl.language === "en" ? "EN" : tpl.language === "ta" ? "TA" : tpl.language}</span>
                                      </div>
                                  </div>
                                  <button onClick={() => handleDeleteTemplate(tpl)} disabled={isDeleting === tpl.sid || isDeleting === tpl._id} className="p-2 -mr-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0">
                                      {(isDeleting === tpl.sid || isDeleting === tpl._id) ? <Loader2 size={16} className="animate-spin text-rose-500" /> : <Trash2 size={16} />}
                                  </button>
                              </div>
                              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-2 text-slate-600 w-max">
                                  {tpl.templateType === "TEXT" && <LayoutTemplate size={14} className="text-slate-400 shrink-0" />}
                                  {tpl.templateType === "WHATSAPP_CARD" && <LayoutTemplate size={14} className="text-slate-400 shrink-0" />}
                                  {tpl.templateType === "CALL_TO_ACTION" && <ExternalLink size={14} className="text-slate-400 shrink-0" />}
                                  <span className="text-[12px] font-semibold">{tpl.templateType === "TEXT" ? "Text" : tpl.templateType === "WHATSAPP_CARD" ? "WhatsApp Card" : "Action / Quick Reply"}</span>
                              </div>
                              <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">WhatsApp Status</p>
                                  {renderChannelEligibility(tpl)}
                              </div>
                          </div>
                      ))}
                  </div>

                  {/* DESKTOP VIEW (TABLE) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                        <thead className="bg-white text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 font-bold">Template Details</th>
                            <th className="px-6 py-4 font-bold">Format</th>
                            <th className="px-6 py-4 font-bold">WhatsApp Status</th>
                            <th className="px-6 py-4 w-12"></th> 
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                        {currentTemplates.map((tpl) => (
                            <tr key={tpl._id || tpl.sid} className="hover:bg-slate-50/60 transition-colors group">
                            
                            <td className="px-6 py-5 align-top">
                                <div className="font-extrabold text-slate-900 text-[14.5px] mb-1.5 whitespace-normal line-clamp-2 max-w-[280px] leading-snug">{tpl.name}</div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{tpl.sid}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{tpl.language === "en" ? "EN" : tpl.language === "ta" ? "TA" : tpl.language}</span>
                                </div>
                            </td>
                            
                            <td className="px-6 py-5 align-top">
                                <div className="flex items-center gap-2 text-slate-600 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg w-max shadow-sm">
                                {tpl.templateType === "TEXT" && <LayoutTemplate size={14} className="text-slate-400 shrink-0" />}
                                {tpl.templateType === "WHATSAPP_CARD" && <LayoutTemplate size={14} className="text-slate-400 shrink-0" />}
                                {tpl.templateType === "CALL_TO_ACTION" && <ExternalLink size={14} className="text-slate-400 shrink-0" />}
                                <span className="text-[12.5px] font-semibold">
                                    {tpl.templateType === "TEXT" && "Text Message"}
                                    {tpl.templateType === "WHATSAPP_CARD" && "WhatsApp Card"}
                                    {tpl.templateType === "CALL_TO_ACTION" && "Action / Reply"}
                                </span>
                                </div>
                            </td>

                            <td className="px-6 py-5 align-top whitespace-normal max-w-[300px]">
                                {renderChannelEligibility(tpl)}
                            </td>
                            
                            <td className="px-6 py-5 align-top text-right">
                                <button onClick={() => handleDeleteTemplate(tpl)} disabled={isDeleting === tpl.sid || isDeleting === tpl._id} className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100 border border-transparent hover:border-rose-100 shadow-sm" title="Delete Template">
                                    {(isDeleting === tpl.sid || isDeleting === tpl._id) ? <Loader2 size={18} className="animate-spin text-rose-500" /> : <Trash2 size={18} />}
                                </button>
                            </td>

                            </tr>
                        ))}
                        </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Pagination Footer */}
            {!apiState.loading && filteredTemplates.length > 0 && (
                <div className="p-4 md:p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-500">
                        Showing <span className="font-bold text-slate-700">{(safeCurrentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-700">{Math.min(safeCurrentPage * itemsPerPage, filteredTemplates.length)}</span> of <span className="font-bold text-slate-700">{filteredTemplates.length}</span> templates
                    </p>
                    
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage === 1} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"><ChevronLeft size={18} /></button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1)
                                .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                                .map((p, i, arr) => (
                                    <React.Fragment key={p}>
                                        {i > 0 && arr[i - 1] !== p - 1 && <span className="px-2 text-slate-400">...</span>}
                                        <button onClick={() => setCurrentPage(p)} className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${safeCurrentPage === p ? 'bg-slate-800 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200'}`}>{p}</button>
                                    </React.Fragment>
                                ))
                            }
                        </div>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage === totalPages} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"><ChevronRight size={18} /></button>
                    </div>
                </div>
            )}
          </div>
        </main>
    </div>
  );
}