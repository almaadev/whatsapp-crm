"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Loader2, Menu, Calendar, 
    ArrowUpRight, ArrowDownLeft, CheckCircle2, 
    XCircle, Clock, Search, DownloadCloud, 
    Paperclip, MessageCircle, RefreshCw, ChevronLeft, 
    ChevronRight, BarChart3, SlidersHorizontal, FileText, FileJson,
    Smartphone, Globe, ShieldAlert, AlertTriangle
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";

export default function MessageLogsPage() {
    const { data: session, status } = useSession();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    
    // --- DATA STATES ---
    const [loading, setLoading] = useState(true);
    const [fetching, setFetching] = useState(false);
    const [messageData, setMessageData] = useState({ messages: [], analytics: {} });

    // --- API FILTER STATES ---
    const [fetchLimit, setFetchLimit] = useState("500");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [apiStatusFilter, setApiStatusFilter] = useState("all"); 
    const [activeDateChip, setActiveDateChip] = useState("all");

    // --- CLIENT UI STATES ---
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedRows, setExpandedRows] = useState({});
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    
    const [clientDirection, setClientDirection] = useState("all");
    const [clientMediaOnly, setClientMediaOnly] = useState(false);
    const [clientFailedOnly, setClientFailedOnly] = useState(false);

    // 👇 FIX: Added missing Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    const isAuthorized = session?.user?.role === 'superAdmin' || session?.user?.department === 'admin' || session;

    // --- UTILITIES ---
    const getFormattedDateTime = (date) => {
        const d = new Date(date);
        const pad = (n) => n.toString().padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const formatSafeDate = useCallback((dateString) => {
        if (!dateString) return <span className="text-slate-300">-</span>;
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return <span className="text-slate-300">-</span>;
            
            const datePart = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            const timePart = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
            
            return (
                <span className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 leading-tight">
                    <span>{datePart}</span>
                    <span className="hidden sm:inline text-slate-300">·</span>
                    <span className="text-[10px] sm:text-xs text-slate-400">{timePart}</span>
                </span>
            );
        } catch (e) {
            return <span className="text-slate-300">-</span>;
        }
    }, []);

    // --- FETCH DATA ---
    const fetchLogs = async (optStart = startDate, optEnd = endDate, optStatus = apiStatusFilter, optLimit = fetchLimit) => {
        setFetching(true);
        try {
            let url = `/api/message-logs?limit=${optLimit}`;
            if (optStart) url += `&startDate=${encodeURIComponent(optStart)}`;
            if (optEnd) url += `&endDate=${encodeURIComponent(optEnd)}`;
            if (optStatus !== "all") url += `&status=${encodeURIComponent(optStatus)}`;

            const res = await fetch(url);
            const data = await res.json();

            if (res.ok && data.success) {
                setMessageData({
                    messages: data.messages || [],
                    analytics: data.analytics || {}
                });
                setExpandedRows({});
                setCurrentPage(1); 
            } else {
                toast.error(data.error || "Failed to load logs");
            }
        } catch (error) {
            toast.error("Error connecting to server");
        } finally {
            setLoading(false);
            setFetching(false);
        }
    };

    useEffect(() => {
        if (status === "authenticated" && isAuthorized) fetchLogs();
    }, [status, isAuthorized]);

    // --- LIVE FILTERING TRIGGERS ---
    const applyDateChip = (chip) => {
        setActiveDateChip(chip);
        setCurrentPage(1);
        const today = new Date();
        let sDate = "", eDate = "";

        if (chip === "today") {
            const start = new Date(today); start.setHours(0, 0, 0, 0); sDate = getFormattedDateTime(start);
            const end = new Date(today); end.setHours(23, 59, 59, 999); eDate = getFormattedDateTime(end);
        } else if (chip === "yesterday") {
            const start = new Date(today); start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); sDate = getFormattedDateTime(start);
            const end = new Date(today); end.setDate(end.getDate() - 1); end.setHours(23, 59, 59, 999); eDate = getFormattedDateTime(end);
        } else if (chip === "last7") {
            const start = new Date(today); start.setDate(start.getDate() - 7); start.setHours(0, 0, 0, 0); sDate = getFormattedDateTime(start);
            const end = new Date(today); end.setHours(23, 59, 59, 999); eDate = getFormattedDateTime(end);
        } else if (chip === "last30") {
            const start = new Date(today); start.setDate(start.getDate() - 30); start.setHours(0, 0, 0, 0); sDate = getFormattedDateTime(start);
            const end = new Date(today); end.setHours(23, 59, 59, 999); eDate = getFormattedDateTime(end);
        }

        setStartDate(sDate);
        setEndDate(eDate);
        fetchLogs(sDate, eDate, apiStatusFilter, fetchLimit);
    };

    // --- CLIENT-SIDE PROCESSING ---
    const filteredMessages = useMemo(() => {
        return messageData.messages.filter(msg => {
            if (searchQuery) {
                const lowerQ = searchQuery.toLowerCase();
                const toMatch = msg.to ? msg.to.toLowerCase().includes(lowerQ) : false;
                const fromMatch = msg.from ? msg.from.toLowerCase().includes(lowerQ) : false;
                const bodyMatch = msg.body ? msg.body.toLowerCase().includes(lowerQ) : false;
                const sidMatch = msg.id ? msg.id.toLowerCase().includes(lowerQ) : false;
                if (!toMatch && !fromMatch && !bodyMatch && !sidMatch) return false;
            }
            if (clientDirection !== "all") {
                const isOut = msg.direction?.includes('outbound');
                if (clientDirection === "outbound" && !isOut) return false;
                if (clientDirection === "inbound" && isOut) return false;
            }
            if (clientMediaOnly && (msg.numMedia || msg.mediaCount || 0) === 0) return false;
            if (clientFailedOnly && !['failed', 'undelivered'].includes(msg.status?.toLowerCase())) return false;
            
            return true;
        });
    }, [messageData.messages, searchQuery, clientDirection, clientMediaOnly, clientFailedOnly]);

    const liveMetrics = useMemo(() => {
        let delivered = 0, failed = 0, inbound = 0, outbound = 0, media = 0;
        filteredMessages.forEach(m => {
            const s = m.status?.toLowerCase() || "";
            const isOut = m.direction?.includes('outbound');
            const mCount = m.numMedia || m.mediaCount || 0;
            if (['delivered', 'read'].includes(s)) delivered++;
            if (['failed', 'undelivered'].includes(s)) failed++;
            if (isOut) outbound++; else inbound++;
            if (mCount > 0) media++;
        });

        return { total: filteredMessages.length, delivered, failed, inbound, outbound, media };
    }, [filteredMessages]);

    const totalPages = Math.max(1, Math.ceil(filteredMessages.length / itemsPerPage));
    const paginatedMessages = filteredMessages.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // --- HANDLERS ---
    const toggleExpand = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

    const handleExport = (type) => {
        setShowExportMenu(false);
        if (filteredMessages.length === 0) return toast.warning("No data to export.");
        
        const toastId = toast.loading("Generating export...");

        setTimeout(() => {
            if (type === 'csv') {
                const headers = ["ID", "Timestamp", "Direction", "From", "To", "Message Content", "Status", "Media Attached"];
                const csvRows = filteredMessages.map(msg => {
                    const date = msg.timestamp || msg.dateSent ? new Date(msg.timestamp || msg.dateSent).toISOString() : "-"; 
                    const direction = msg.direction?.includes('outbound') ? 'Outbound' : 'Inbound';
                    const body = `"${(msg.body || "").replace(/"/g, '""')}"`;
                    return [msg.id, date, direction, msg.from || "-", msg.to || "-", body, msg.status || "-", msg.numMedia || msg.mediaCount || 0].join(",");
                });
                const csvContent = [headers.join(","), ...csvRows].join("\n");
                const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                downloadBlob(blob, `communication_logs_${new Date().getTime()}.csv`);
            } else if (type === 'json') {
                const blob = new Blob([JSON.stringify(filteredMessages, null, 2)], { type: "application/json" });
                downloadBlob(blob, `communication_logs_${new Date().getTime()}.json`);
            }
            toast.update(toastId, { render: "Export successful!", type: "success", isLoading: false, autoClose: 3000 });
        }, 800);
    };

    const downloadBlob = (blob, filename) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusBadge = (s) => {
        const statusStr = s?.toLowerCase() || "unknown";
        if (['delivered', 'read'].includes(statusStr)) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60"><CheckCircle2 size={12}/> {statusStr}</span>;
        if (['failed', 'undelivered'].includes(statusStr)) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold uppercase tracking-wider border border-rose-200/60"><XCircle size={12}/> {statusStr}</span>;
        if (['sent', 'accepted', 'queued'].includes(statusStr)) return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-200/60"><ArrowUpRight size={12}/> {statusStr}</span>;
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-200/60"><Clock size={12}/> {statusStr}</span>;
    };

    if (status === "loading") return <div className="flex h-screen items-center justify-center text-emerald-600 font-bold uppercase tracking-widest text-sm bg-slate-50"><Loader2 className="animate-spin mr-3"/> Authenticating...</div>;
    if (!session || !isAuthorized) {
        return (
            <div className="flex h-[100dvh] bg-slate-50 overflow-hidden relative">
                <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
                <div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center">
                    <ShieldAlert size={80} className="text-rose-400 mb-6" />
                    <h2 className="text-3xl font-extrabold text-slate-800">Clearance Required</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] bg-[#f8fafc] font-sans overflow-hidden text-slate-800 selection:bg-emerald-100 selection:text-emerald-900">
            {mobileMenuOpen && <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />}
            
            <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto custom-scrollbar relative">
                
                {/* --- HEADER (No Wallet, Just Metrics) --- */}
                <header className="px-4 py-6 md:px-6 lg:py-8 bg-white border-b border-slate-200 shrink-0 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
                    <div className="max-w-[1600px] mx-auto relative z-10 flex flex-col gap-6">
                        
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors">
                                    <Menu size={24} />
                                </button>
                                <div>
                                    <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 sm:gap-2.5">
                                        <BarChart3 className="text-emerald-500 hidden sm:block" size={28} /> 
                                        <span className="sm:hidden text-emerald-500"><BarChart3 size={24}/></span>
                                        Message Analytics
                                    </h1>
                                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Enterprise Communication Intelligence</p>
                                </div>
                            </div>
                        </div>

                        {/* Analytics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                            {[
                                { label: "Filtered Handled", val: liveMetrics.total || 0, color: "slate" },
                                { label: "Filtered Delivered", val: liveMetrics.delivered || 0, color: "emerald" },
                                { label: "Filtered Failed", val: liveMetrics.failed || 0, color: "rose" },
                                { label: "Rich Media", val: liveMetrics.media || 0, color: "amber" },
                                { label: "Outbound", val: liveMetrics.outbound || 0, color: "blue" },
                                { label: "Inbound", val: liveMetrics.inbound || 0, color: "indigo" },
                            ].map((stat, i) => (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                                    key={i} className={`bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col justify-between`}
                                >
                                    <div className={`absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-${stat.color}-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 pointer-events-none`}></div>
                                    <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 relative z-10">{stat.label}</p>
                                    <p className={`text-xl sm:text-2xl font-black text-${stat.color}-600 relative z-10 truncate`}>{typeof stat.val === 'number' ? stat.val.toLocaleString() : stat.val}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-4 md:p-6 lg:p-8 flex flex-col min-h-0">
                    <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-6 h-full min-h-0">

                        {/* --- FILTER TOOLBAR --- */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-2 sm:p-2.5 flex flex-col xl:flex-row gap-3 xl:gap-4 transition-all shrink-0">
                            
                            <div className="flex-1 flex flex-col lg:flex-row items-start lg:items-center gap-3 bg-slate-50/50 p-2 sm:p-3 rounded-xl border border-slate-100 w-full overflow-hidden">
                                
                                <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto hide-scrollbar pb-1 lg:pb-0">
                                    <Calendar size={16} className="text-slate-400 shrink-0 hidden md:block" />
                                    <div className="flex gap-1.5 shrink-0">
                                        {[
                                            { id: 'today', label: 'Today' },
                                            { id: 'yesterday', label: 'Yesterday' },
                                            { id: 'last7', label: '7D' },
                                            { id: 'last30', label: '30D' },
                                            { id: 'all', label: 'All' },
                                        ].map(chip => (
                                            <button 
                                                key={chip.id} type="button"
                                                onClick={() => applyDateChip(chip.id)}
                                                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${activeDateChip === chip.id ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                                            >
                                                {chip.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="hidden lg:block w-px h-6 bg-slate-200 shrink-0"></div>

                                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0">
                                    <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden flex-1 sm:flex-none">
                                        <input type="datetime-local" value={startDate} onChange={e => {setStartDate(e.target.value); setActiveDateChip("custom"); setCurrentPage(1);}} className="px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 outline-none w-full sm:w-[150px] bg-transparent" title="Start Date" />
                                        <div className="w-px bg-slate-200"></div>
                                        <input type="datetime-local" value={endDate} onChange={e => {setEndDate(e.target.value); setActiveDateChip("custom"); setCurrentPage(1);}} className="px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 outline-none w-full sm:w-[150px] bg-transparent" title="End Date" />
                                    </div>
                                    <select value={apiStatusFilter} onChange={e => {setApiStatusFilter(e.target.value); setCurrentPage(1);}} className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-lg px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 outline-none cursor-pointer">
                                        <option value="all">Any Status</option>
                                        <option value="delivered">Delivered</option>
                                        <option value="read">Read</option>
                                        <option value="failed">Failed</option>
                                        <option value="sent">Sent/Queued</option>
                                    </select>
                                </div>

                                <div className="flex items-center gap-2 w-full lg:w-auto mt-1 lg:mt-0 shrink-0 border-t lg:border-t-0 border-slate-200 pt-2 lg:pt-0">
                                    <select value={fetchLimit} onChange={e => setFetchLimit(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-bold text-slate-700 outline-none cursor-pointer">
                                        <option value="100">100</option>
                                        <option value="500">500</option>
                                        <option value="1000">1,000</option>
                                        <option value="all">All (if needed)</option>
                                    </select>
                                    <button onClick={() => fetchLogs()} disabled={fetching} className="flex-1 lg:flex-none px-4 py-2 sm:py-2 bg-slate-900 hover:bg-black text-white text-[11px] sm:text-xs font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                        {fetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} 
                                        Sync Server
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full xl:w-auto p-1 shrink-0">
                                <div className="relative group flex-1 xl:w-64 min-w-[200px]">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                    <input 
                                        type="text" placeholder="Search message, numbers..." 
                                        value={searchQuery} onChange={(e) => {setSearchQuery(e.target.value); setCurrentPage(1);}}
                                        className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                                    />
                                </div>
                                <button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className={`p-2.5 rounded-xl border transition-all shrink-0 ${showAdvancedFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                    <SlidersHorizontal size={18} />
                                </button>
                                <div className="relative shrink-0">
                                    <button onClick={() => setShowExportMenu(!showExportMenu)} disabled={filteredMessages.length === 0} className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50">
                                        <DownloadCloud size={18} />
                                    </button>
                                    <AnimatePresence>
                                        {showExportMenu && (
                                            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-2 w-36 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden py-1 z-50">
                                                <button onClick={() => handleExport('csv')} className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><FileText size={14} className="text-emerald-500"/> Export CSV</button>
                                                <button onClick={() => handleExport('json')} className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2"><FileJson size={14} className="text-blue-500"/> Export JSON</button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        {/* ADVANCED CLIENT FILTERS EXPANSION */}
                        <AnimatePresence>
                            {showAdvancedFilters && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden shrink-0">
                                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row flex-wrap gap-4 md:gap-6 md:items-center">
                                        <div className="space-y-2 w-full md:w-auto">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Message Direction</label>
                                            <div className="flex bg-slate-100 p-1 rounded-lg w-full md:w-auto">
                                                {['all', 'inbound', 'outbound'].map(dir => (
                                                    <button key={dir} onClick={() => {setClientDirection(dir); setCurrentPage(1);}} className={`flex-1 md:flex-none px-3 sm:px-4 py-1.5 rounded-md text-[11px] sm:text-xs font-bold capitalize transition-all ${clientDirection === dir ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-700'}`}>{dir}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full md:w-auto mt-2 md:mt-0">
                                            <label className="flex items-center gap-2 cursor-pointer group bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200">
                                                <input type="checkbox" checked={clientMediaOnly} onChange={e => {setClientMediaOnly(e.target.checked); setCurrentPage(1);}} className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 border-slate-300" />
                                                <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">Has Media Attachment</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer group bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-lg sm:rounded-none border sm:border-0 border-slate-200">
                                                <input type="checkbox" checked={clientFailedOnly} onChange={e => {setClientFailedOnly(e.target.checked); setCurrentPage(1);}} className="w-4 h-4 rounded text-rose-500 focus:ring-rose-500 border-slate-300" />
                                                <span className="text-sm font-semibold text-slate-600 group-hover:text-slate-900 transition-colors">Failed / Undelivered Only</span>
                                            </label>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* --- DATA PRESENTATION --- */}
                        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200 overflow-hidden flex flex-col flex-1 min-h-[400px]">
                            
                            {loading || fetching ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 sm:p-20 min-h-[300px]">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                        <Loader2 size={40} className="animate-spin text-emerald-500 relative z-10" />
                                    </div>
                                    <p className="mt-4 text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest animate-pulse">Syncing Twilio Logs...</p>
                                </div>
                            ) : filteredMessages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-8 sm:p-20 text-center min-h-[300px]">
                                    <div className="w-20 h-20 sm:w-24 sm:h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-100">
                                        <Search size={32} className="text-slate-300" />
                                    </div>
                                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-800">No logs found</h3>
                                    <p className="text-xs sm:text-sm font-medium text-slate-500 mt-2 max-w-sm px-4">We couldn't find any messages matching your current filter criteria.</p>
                                    <button onClick={() => {setSearchQuery(""); setApiStatusFilter("all"); setClientDirection("all"); setClientMediaOnly(false); setClientFailedOnly(false); setActiveDateChip("all"); setStartDate(""); setEndDate("");}} className="mt-6 text-sm font-bold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg transition-colors">Clear All Filters</button>
                                </div>
                            ) : (
                                <>
                                    {/* --- DESKTOP / LARGE TABLET VIEW --- */}
                                    <div className="hidden lg:block overflow-x-auto w-full flex-1">
                                        <table className="w-full text-left border-collapse whitespace-nowrap">
                                            <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md">
                                                <tr>
                                                    <th className="px-6 py-4 pl-8">Date Sent</th>
                                                    <th className="px-6 py-4">Participant</th>
                                                    <th className="px-6 py-4">Direction</th>
                                                    <th className="px-6 py-4">Status</th>
                                                    <th className="px-6 py-4">Content Preview</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 text-[13px] font-medium text-slate-700 relative">
                                                <AnimatePresence initial={false}>
                                                    {paginatedMessages.map((msg) => {
                                                        const isOutbound = msg.direction?.includes('outbound');
                                                        const isExpanded = expandedRows[msg.id];
                                                        const mediaCount = msg.numMedia || msg.mediaCount || 0;
                                                        const hasMedia = mediaCount > 0;
                                                        const previewWord = msg.body ? msg.body.split(" ").slice(0, 4).join(" ") + (msg.body.split(" ").length > 4 ? "..." : "") : "Media Only";

                                                        return (
                                                            <React.Fragment key={msg.id}>
                                                                <tr onClick={() => toggleExpand(msg.id)} className={`cursor-pointer transition-colors group ${isExpanded ? 'bg-slate-50/80' : 'hover:bg-slate-50/50'}`}>
                                                                    <td className="px-6 py-4 pl-8 text-slate-600 font-semibold">{formatSafeDate(msg.timestamp || msg.dateSent)}</td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-2.5">
                                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${isOutbound ? 'bg-indigo-50 border-indigo-100 text-indigo-500' : 'bg-emerald-50 border-emerald-100 text-emerald-500'}`}>
                                                                                {isOutbound ? <Smartphone size={12}/> : <Globe size={12}/>}
                                                                            </div>
                                                                            <span className="font-mono text-xs font-bold text-slate-800">{isOutbound ? msg.to : msg.from}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
                                                                            {isOutbound ? <ArrowUpRight size={14} className="text-indigo-400"/> : <ArrowDownLeft size={14} className="text-emerald-400"/>}
                                                                            {isOutbound ? "Outbound" : "Inbound"}
                                                                        </span>
                                                                    </td>
                                                                    <td className="px-6 py-4">{getStatusBadge(msg.status)}</td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="flex items-center gap-2 text-slate-600 max-w-[250px]">
                                                                            {hasMedia && <Paperclip size={14} className="text-slate-400 shrink-0"/>}
                                                                            <span className="truncate group-hover:text-emerald-600 transition-colors">{previewWord}</span>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                                
                                                                <AnimatePresence>
                                                                    {isExpanded && (
                                                                        <tr>
                                                                            <td colSpan="5" className="p-0 border-0">
                                                                                <motion.div 
                                                                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                                                    className="overflow-hidden bg-slate-50/80 border-b border-slate-100 shadow-inner"
                                                                                >
                                                                                    <div className="p-6 pl-8 flex gap-8">
                                                                                        <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm relative">
                                                                                            <div className="absolute top-0 left-6 -mt-2.5 px-2 bg-white text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-1">
                                                                                                <MessageCircle size={12}/> Message Content
                                                                                            </div>
                                                                                            <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap mt-2 word-break break-all">
                                                                                                {msg.body || <span className="text-slate-400 italic">No text content provided.</span>}
                                                                                            </div>
                                                                                        </div>
                                                                                        <div className="w-[300px] shrink-0 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                                                                                            <div>
                                                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Message SID</p>
                                                                                                <p className="font-mono text-[11px] text-slate-700 break-all bg-slate-50 p-2 rounded-lg border border-slate-100 selection:bg-emerald-200 select-all">{msg.id}</p>
                                                                                            </div>
                                                                                            <div className="grid grid-cols-1 gap-4">
                                                                                                <div>
                                                                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Media Count</p>
                                                                                                    <p className="text-sm font-black text-slate-700">{mediaCount}</p>
                                                                                                </div>
                                                                                            </div>
                                                                                            {msg.errorMessage && (
                                                                                                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl mt-2">
                                                                                                    <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1 flex items-center gap-1"><ShieldAlert size={12}/> Error Detail</p>
                                                                                                    <p className="text-xs font-medium text-rose-700 leading-tight">{msg.errorMessage}</p>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    </div>
                                                                                </motion.div>
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </AnimatePresence>
                                                            </React.Fragment>
                                                        );
                                                    })}
                                                </AnimatePresence>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* --- MOBILE / SMALL TABLET CARD VIEW --- */}
                                    <div className="lg:hidden flex flex-col p-3 sm:p-4 gap-3 sm:gap-4 bg-slate-50/50 flex-1 overflow-x-hidden">
                                        <AnimatePresence initial={false}>
                                            {paginatedMessages.map((msg) => {
                                                const isOutbound = msg.direction?.includes('outbound');
                                                const isExpanded = expandedRows[msg.id];
                                                const mediaCount = msg.numMedia || msg.mediaCount || 0;
                                                const hasMedia = mediaCount > 0;

                                                return (
                                                    <motion.div layout key={msg.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col w-full">
                                                        <div onClick={() => toggleExpand(msg.id)} className="p-4 flex flex-col gap-3 cursor-pointer select-none touch-manipulation w-full overflow-hidden">
                                                            <div className="flex justify-between items-start gap-2 w-full">
                                                                <div className="flex items-start gap-2.5 overflow-hidden flex-1 min-w-0">
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border mt-0.5 ${isOutbound ? 'bg-indigo-50 border-indigo-100 text-indigo-500' : 'bg-emerald-50 border-emerald-100 text-emerald-500'}`}>
                                                                        {isOutbound ? <ArrowUpRight size={14}/> : <ArrowDownLeft size={14}/>}
                                                                    </div>
                                                                    <div className="flex flex-col overflow-hidden min-w-0">
                                                                        <p className="font-mono text-[13px] font-bold text-slate-800 truncate block">{isOutbound ? msg.to : msg.from}</p>
                                                                        <div className="text-[10px] font-semibold text-slate-500 mt-0.5 whitespace-nowrap">{formatSafeDate(msg.timestamp || msg.dateSent)}</div>
                                                                    </div>
                                                                </div>
                                                                <div className="shrink-0 ml-2">{getStatusBadge(msg.status)}</div>
                                                            </div>
                                                            <div className={`text-[13px] text-slate-600 font-medium leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 break-words ${!isExpanded && 'line-clamp-2'}`}>
                                                                {hasMedia && !isExpanded && <Paperclip size={12} className="inline mr-1 text-slate-400"/>}
                                                                {msg.body || (hasMedia ? "Media Attachment" : "-")}
                                                            </div>
                                                        </div>
                                                        
                                                        <AnimatePresence>
                                                            {isExpanded && (
                                                                <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden bg-white border-t border-slate-100 w-full">
                                                                    <div className="p-4 space-y-3 bg-slate-50/50 w-full overflow-hidden">
                                                                        <div className="flex flex-col gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm w-full">
                                                                            <div className="grid grid-cols-1 gap-3 border-b border-slate-100 pb-3">
                                                                                <div>
                                                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Media Count</p>
                                                                                    <p className="text-xs font-bold text-slate-700">{mediaCount} items</p>
                                                                                </div>
                                                                            </div>
                                                                            <div className="w-full min-w-0">
                                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Twilio SID</p>
                                                                                <p className="text-[10px] font-mono text-slate-500 break-all bg-slate-50 p-2 rounded-lg border border-slate-100 mt-1 select-all w-full leading-relaxed">{msg.id}</p>
                                                                            </div>
                                                                        </div>
                                                                        {msg.errorMessage && (
                                                                            <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl text-[11px] sm:text-xs font-medium text-rose-700 leading-tight flex items-start gap-2.5 w-full">
                                                                                <AlertTriangle size={16} className="shrink-0 text-rose-500 mt-0.5"/>
                                                                                <span className="break-words w-full">{msg.errorMessage}</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </div>

                                    {/* --- PAGINATION FOOTER --- */}
                                    <div className="p-4 lg:p-5 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4 mt-auto shrink-0 relative">
                                        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                                            <div className="flex items-center gap-2 sm:gap-3">
                                                <span className="text-[11px] sm:text-xs font-bold text-slate-500 hidden sm:block">Rows:</span>
                                                <select 
                                                    value={itemsPerPage} onChange={(e) => {setItemsPerPage(Number(e.target.value)); setCurrentPage(1);}}
                                                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-100 transition"
                                                >
                                                    <option value={25}>25</option>
                                                    <option value={50}>50</option>
                                                    <option value={100}>100</option>
                                                    <option value={250}>250</option>
                                                </select>
                                            </div>
                                            <span className="text-[11px] sm:text-xs font-bold text-slate-500 sm:hidden">
                                                Showing {Math.min(currentPage * itemsPerPage, filteredMessages.length)} of {filteredMessages.length}
                                            </span>
                                        </div>

                                        <span className="hidden sm:block text-xs font-bold text-slate-500 text-center">
                                            Showing <span className="text-slate-800">{(currentPage - 1) * itemsPerPage + 1}</span>–<span className="text-slate-800">{Math.min(currentPage * itemsPerPage, filteredMessages.length)}</span> of <span className="text-slate-800">{filteredMessages.length}</span> logs
                                        </span>
                                        
                                        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center">
                                            <button 
                                                onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1}
                                                className="p-2 sm:p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm bg-white"
                                            >
                                                <ChevronLeft size={18} className="sm:w-4 sm:h-4"/>
                                            </button>
                                            <div className="px-4 sm:px-3 text-xs font-bold text-slate-700 bg-slate-50 rounded-lg py-2 sm:py-1.5 border border-slate-100 min-w-[80px] text-center">
                                                Page {currentPage} / {totalPages}
                                            </div>
                                            <button 
                                                onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages || totalPages === 0}
                                                className="p-2 sm:p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition shadow-sm bg-white"
                                            >
                                                <ChevronRight size={18} className="sm:w-4 sm:h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}