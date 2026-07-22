"use client";

import React, { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useAuth } from "@/shared/hooks/useAuth";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { reportRepository } from "@/shared/api/repositories/reportRepository";
import {
  useMessageLogsState,
  downloadBlob,
} from "@/features/reports/hooks/useMessageLogsState";

import {
  Loader2,
  Menu,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  DownloadCloud,
  Paperclip,
  MessageCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  SlidersHorizontal,
  FileText,
  FileJson,
  Smartphone,
  Globe,
  ShieldAlert,
  AlertTriangle,
} from "lucide-react";

export default function MessageLogsPage() {
  const { data: session, status } = useSession();
  const { user, isLoading, hasModuleAccess } = useAuth();
  const { setMobileOpen } = useCrmLayout();

  const isAuthorized = hasModuleAccess("Messages log");

  const { state, setters, derived, actions } =
    useMessageLogsState(isAuthorized);

  const [expandedRows, setExpandedRows] = useState({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // --- UTILITIES ---
  const formatSafeDate = useCallback((dateString) => {
    if (!dateString) return <span className="text-slate-300">-</span>;
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime()))
        return <span className="text-slate-300">-</span>;

      const datePart = date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const timePart = date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      return (
        <span className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 leading-tight">
          <span>{datePart}</span>
          <span className="hidden sm:inline text-slate-300">·</span>
          <span className="text-[10px] sm:text-xs text-slate-400">
            {timePart}
          </span>
        </span>
      );
    } catch (e) {
      return <span className="text-slate-300">-</span>;
    }
  }, []);

  // --- DIRECT SERVER CSV EXPORT ---
  const handleDirectExport = async () => {
    setExportLoading(true);
    setShowExportModal(false);
    try {
      let queryStr = `limit=all`;
      if (state.startDate)
        queryStr += `&startDate=${encodeURIComponent(state.startDate)}`;
      if (state.endDate)
        queryStr += `&endDate=${encodeURIComponent(state.endDate)}`;
      if (state.apiStatusFilter !== "all")
        queryStr += `&status=${encodeURIComponent(state.apiStatusFilter)}`;
      if (state.searchQuery)
        queryStr += `&search=${encodeURIComponent(state.searchQuery)}`;
      if (state.clientDirection !== "all")
        queryStr += `&direction=${state.clientDirection}`;
      if (state.clientMediaOnly) queryStr += `&mediaOnly=true`;
      if (state.clientFailedOnly) queryStr += `&failedOnly=true`;

      const res = await reportRepository.exportMessageLogs(queryStr);

      const blob = res.data;
      downloadBlob(blob, `enterprise_message_archive_${Date.now()}.csv`);
      toast.success("Enterprise archive downloaded safely.");
    } catch (err) {
      toast.error("Export operation failed.");
    } finally {
      setExportLoading(false);
    }
  };

  // --- ACTION INTERCEPTORS ---
  const handleSyncClick = () => {
    if (state.fetchLimit === "all") {
      setShowExportModal(true);
    } else {
      actions.fetchLogs();
    }
  };

  // --- HANDLERS ---
  const toggleExpand = (id) =>
    setExpandedRows((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleStandardExport = (type) => {
    setShowExportMenu(false);
    if (derived.filteredMessages.length === 0)
      return toast.warning("No data to export.");

    const toastId = toast.loading("Generating export...");

    setTimeout(() => {
      if (type === "csv") {
        const headers = [
          "ID",
          "Timestamp",
          "Direction",
          "From",
          "To",
          "Message Content",
          "Status",
          "Media Attached",
        ];
        const csvRows = derived.filteredMessages.map((msg) => {
          const date =
            msg.timestamp || msg.dateSent
              ? new Date(msg.timestamp || msg.dateSent).toISOString()
              : "-";
          const direction = msg.direction?.includes("outbound")
            ? "Outbound"
            : "Inbound";
          const body = `"${(msg.body || "").replace(/"/g, '""')}"`;
          return [
            msg.id,
            date,
            direction,
            msg.from || "-",
            msg.to || "-",
            body,
            msg.status || "-",
            msg.numMedia || msg.mediaCount || 0,
          ].join(",");
        });
        const csvContent = [headers.join(","), ...csvRows].join("\n");
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        downloadBlob(blob, `communication_logs_${new Date().getTime()}.csv`);
      } else if (type === "json") {
        const blob = new Blob(
          [JSON.stringify(derived.filteredMessages, null, 2)],
          {
            type: "application/json",
          },
        );
        downloadBlob(blob, `communication_logs_${new Date().getTime()}.json`);
      }
      toast.update(toastId, {
        render: "Export successful!",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });
    }, 800);
  };

  const getStatusBadge = (s) => {
    const statusStr = s?.toLowerCase() || "unknown";
    if (["delivered", "read"].includes(statusStr))
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-200/60">
          <CheckCircle2 size={12} /> {statusStr}
        </span>
      );
    if (["failed", "undelivered"].includes(statusStr))
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold uppercase tracking-wider border border-rose-200/60">
          <XCircle size={12} /> {statusStr}
        </span>
      );
    if (["sent", "accepted", "queued"].includes(statusStr))
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-200/60">
          <ArrowUpRight size={12} /> {statusStr}
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-wider border border-amber-200/60">
        <Clock size={12} /> {statusStr}
      </span>
    );
  };

  const hasLogAccess = isAuthorized;

  if (!hasLogAccess) {
    return (
      <AccessDenied message="You do not have permission to access Message Logs." />
    );
  }

  const isDangerousQuery =
    !state.startDate && !state.endDate && !state.searchQuery;

  if (status === "loading" || isLoading)
    return (
      <div className="flex h-screen items-center justify-center text-emerald-600 font-bold uppercase tracking-widest text-sm bg-slate-50">
        <Loader2 className="animate-spin mr-3" /> Authenticating...
      </div>
    );
  if (!user && !session) return null;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
      {/* --- EXPORT LOADING OVERLAY --- */}
      <AnimatePresence>
        {exportLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-lg flex flex-col items-center justify-center text-white p-4"
          >
            <Loader2 size={56} className="animate-spin text-emerald-400 mb-6" />
            <h2 className="text-2xl font-black tracking-widest uppercase text-emerald-50 text-center">
              Preparing Enterprise Export
            </h2>
            <p className="text-sm font-medium text-slate-300 mt-3 text-center max-w-sm">
              Generating optimized CSV stream from the server.{" "}
              <br className="hidden sm:block" /> Please do not close this
              window.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- HIGH VOLUME WARNING MODAL --- */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 relative flex flex-col max-h-full"
            >
              <div className="p-5 sm:p-6 pb-0 overflow-y-auto custom-scrollbar">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`p-3 rounded-2xl shrink-0 ${isDangerousQuery ? "bg-rose-100 text-rose-600" : "bg-amber-100 text-amber-600"}`}
                  >
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-extrabold text-slate-900">
                      Enterprise Archive Retrieval
                    </h3>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                      High Volume Operation
                    </p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
                  You are attempting to retrieve a{" "}
                  <strong className="text-slate-900">
                    High-Volume Communication Archive
                  </strong>{" "}
                  from Twilio infrastructure. Large retrieval operations may
                  increase API load, take longer to process, and consume more
                  browser memory.
                </p>

                {isDangerousQuery && (
                  <div className="mt-4 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                    <h4 className="text-xs sm:text-sm font-bold text-rose-800 flex items-center gap-2 mb-1">
                      <ShieldAlert size={16} /> Warning: Unrestricted Archive
                    </h4>
                    <p className="text-[11px] sm:text-xs font-medium text-rose-700 leading-relaxed">
                      You have not applied any Date Range or Search filters.
                      Loading this directly into the UI may freeze low-memory
                      devices.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-5 sm:p-6 pt-5 shrink-0 flex flex-col gap-3 mt-auto bg-white border-t border-slate-100">
                <button
                  onClick={handleDirectExport}
                  className="w-full py-3 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
                >
                  <DownloadCloud size={18} /> Download CSV Instead{" "}
                  <span className="hidden sm:inline">(Recommended)</span>
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowExportModal(false)}
                    className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowExportModal(false);
                      actions.fetchLogs();
                    }}
                    className="py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs sm:text-sm transition-colors px-2"
                  >
                    Continue Fetch to UI
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto custom-scrollbar relative">
        {/* --- HEADER --- */}
        <header className="px-4 py-6 md:px-6 lg:py-8 bg-white border-b border-slate-200 shrink-0 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div className="max-w-[1600px] mx-auto relative z-10 flex flex-col gap-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="md:hidden p-2 -ml-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <Menu size={24} />
                </button>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2 sm:gap-2.5">
                    <BarChart3
                      className="text-emerald-500 hidden sm:block"
                      size={28}
                    />
                    <span className="sm:hidden text-emerald-500">
                      <BarChart3 size={24} />
                    </span>
                    Message Analytics
                  </h1>
                  <p className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                    Enterprise Communication Logs
                  </p>
                </div>
              </div>
            </div>

            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {[
                {
                  label: "Filtered Handled",
                  val: derived.liveMetrics.total || 0,
                  color: "slate",
                },
                {
                  label: "Filtered Delivered",
                  val: derived.liveMetrics.delivered || 0,
                  color: "emerald",
                },
                {
                  label: "Filtered Failed",
                  val: derived.liveMetrics.failed || 0,
                  color: "rose",
                },
                {
                  label: "Rich Media",
                  val: derived.liveMetrics.media || 0,
                  color: "amber",
                },
                {
                  label: "Outbound",
                  val: derived.liveMetrics.outbound || 0,
                  color: "blue",
                },
                {
                  label: "Inbound",
                  val: derived.liveMetrics.inbound || 0,
                  color: "indigo",
                },
              ].map((stat, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  key={i}
                  className={`bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col justify-between`}
                >
                  <div
                    className={`absolute top-0 right-0 w-16 h-16 sm:w-20 sm:h-20 bg-${stat.color}-50 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110 pointer-events-none`}
                  ></div>
                  <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 relative z-10">
                    {stat.label}
                  </p>
                  <p
                    className={`text-xl sm:text-2xl lg:text-3xl font-black text-${stat.color}-600 relative z-10 truncate`}
                  >
                    {typeof stat.val === "number"
                      ? stat.val.toLocaleString()
                      : stat.val}
                  </p>
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
                  <Calendar
                    size={16}
                    className="text-slate-400 shrink-0 hidden md:block"
                  />
                  <div className="flex gap-1.5 shrink-0">
                    {[
                      { id: "today", label: "Today" },
                      { id: "yesterday", label: "Yesterday" },
                      { id: "last7", label: "7D" },
                      { id: "last30", label: "30D" },
                      { id: "all", label: "All" },
                    ].map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => actions.applyDateChip(chip.id)}
                        className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[11px] sm:text-xs font-bold transition-all whitespace-nowrap ${state.activeDateChip === chip.id ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="hidden lg:block w-px h-6 bg-slate-200 shrink-0"></div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full lg:w-auto shrink-0">
                  <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden flex-1 sm:flex-none">
                    <input
                      type="datetime-local"
                      value={state.startDate}
                      onChange={(e) => {
                        setters.setStartDate(e.target.value);
                        setters.setActiveDateChip("custom");
                        setters.setCurrentPage(1);
                      }}
                      className="px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 outline-none w-full sm:w-[130px] bg-transparent"
                      title="Start Date"
                    />
                    <div className="w-px bg-slate-200"></div>
                    <input
                      type="datetime-local"
                      value={state.endDate}
                      onChange={(e) => {
                        setters.setEndDate(e.target.value);
                        setters.setActiveDateChip("custom");
                        setters.setCurrentPage(1);
                      }}
                      className="px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 outline-none w-full sm:w-[130px] bg-transparent"
                      title="End Date"
                    />
                  </div>
                  <select
                    value={state.apiStatusFilter}
                    onChange={(e) => {
                      setters.setApiStatusFilter(e.target.value);
                      setters.setCurrentPage(1);
                    }}
                    className="flex-1 sm:flex-none bg-white border border-slate-200 rounded-lg px-2 sm:px-3 py-2 text-[11px] sm:text-xs font-bold text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="all">Any Status</option>
                    <option value="delivered">Delivered</option>
                    <option value="read">Read</option>
                    <option value="received">Received</option>
                    <option value="sent">Sent</option>
                    <option value="queued">Queued</option>
                    <option value="failed">Failed</option>
                    <option value="undelivered">Undelivered</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto mt-1 lg:mt-0 shrink-0 border-t lg:border-t-0 border-slate-200 pt-2 lg:pt-0">
                  <div className="relative flex-1 lg:flex-none">
                    <select
                      value={state.fetchLimit}
                      onChange={(e) => setters.setFetchLimit(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-[11px] sm:text-xs font-bold text-slate-700 outline-none cursor-pointer appearance-none pr-8"
                    >
                      <option value="100">Fetch 100 limit</option>
                      <option value="500">Fetch 500 limit</option>
                      <option value="1000">Fetch 1k limit</option>
                      <option value="all" className="font-bold text-amber-600">
                        Max Allowed
                      </option>
                    </select>
                    {state.fetchLimit === "all" && (
                      <AlertTriangle
                        size={12}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none"
                      />
                    )}
                  </div>
                  <button
                    onClick={handleSyncClick}
                    disabled={state.fetching}
                    className="flex-1 lg:flex-none px-4 py-2 sm:py-2 bg-slate-900 hover:bg-black text-white text-[11px] sm:text-xs font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {state.fetching ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    Sync Server
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full xl:w-auto p-1 shrink-0">
                <div className="relative group flex-1 xl:w-64 min-w-[200px]">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors"
                  />
                  <input
                    type="text"
                    placeholder="Search message, numbers..."
                    value={state.searchQuery}
                    onChange={(e) => {
                      setters.setSearchQuery(e.target.value);
                      setters.setCurrentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
                  />
                </div>
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`p-2.5 rounded-xl border transition-all shrink-0 ${showAdvancedFilters ? "bg-emerald-50 border-emerald-200 text-emerald-600" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                >
                  <SlidersHorizontal size={18} />
                </button>
                <div className="relative shrink-0">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={derived.filteredMessages.length === 0}
                    className="p-2.5 bg-white rounded-xl border border-slate-200 text-slate-700 shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
                  >
                    <DownloadCloud size={18} />
                  </button>
                  <AnimatePresence>
                    {showExportMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50 overflow-hidden"
                      >
                        <button
                          onClick={() => handleStandardExport("csv")}
                          className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <FileText size={16} className="text-emerald-500" />{" "}
                          Export as CSV
                        </button>
                        <div className="h-px bg-slate-100 mx-2"></div>
                        <button
                          onClick={() => handleStandardExport("json")}
                          className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-3 transition-colors"
                        >
                          <FileJson size={16} className="text-blue-500" />{" "}
                          Export as JSON
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* --- ADVANCED FILTERS --- */}
            <AnimatePresence>
              {showAdvancedFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 flex flex-wrap gap-4 mt-2">
                    <div className="flex items-center gap-4 border-r border-slate-200 pr-4">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Direction
                      </span>
                      <div className="flex gap-2">
                        {["all", "inbound", "outbound"].map((dir) => (
                          <button
                            key={dir}
                            onClick={() => {
                              setters.setClientDirection(dir);
                              setters.setCurrentPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${state.clientDirection === dir ? "bg-slate-800 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
                          >
                            {dir === "all"
                              ? "Both"
                              : dir === "inbound"
                                ? "Inbound ⬇"
                                : "Outbound ⬆"}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-r border-slate-200 pr-4">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Content
                      </span>
                      <button
                        onClick={() => {
                          setters.setClientMediaOnly(!state.clientMediaOnly);
                          setters.setCurrentPage(1);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${state.clientMediaOnly ? "bg-amber-100 text-amber-700 border border-amber-200 shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        <Paperclip size={14} /> Has Media
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Status
                      </span>
                      <button
                        onClick={() => {
                          setters.setClientFailedOnly(!state.clientFailedOnly);
                          setters.setCurrentPage(1);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${state.clientFailedOnly ? "bg-rose-100 text-rose-700 border border-rose-200 shadow-sm" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"}`}
                      >
                        <ShieldAlert size={14} /> Failed Only
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* --- LOGS TABLE --- */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col min-h-0 overflow-hidden relative">
              {state.loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                  <Loader2
                    size={40}
                    className="animate-spin text-emerald-500 mb-4"
                  />
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-wider animate-pulse">
                    Connecting to Archives...
                  </p>
                </div>
              ) : derived.filteredMessages.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center bg-slate-50/50">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-200/60">
                    <MessageCircle size={32} className="text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">
                    No Logs Found
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm">
                    {state.searchQuery ||
                    state.apiStatusFilter !== "all" ||
                    state.clientDirection !== "all"
                      ? "Try adjusting your filters or search terms."
                      : "No communication logs match the current timeframe."}
                  </p>
                  {(state.searchQuery ||
                    state.apiStatusFilter !== "all" ||
                    state.clientDirection !== "all") && (
                    <button
                      onClick={() => {
                        setters.setSearchQuery("");
                        setters.setClientDirection("all");
                        setters.setClientMediaOnly(false);
                        setters.setClientFailedOnly(false);
                        setters.setApiStatusFilter("all");
                        setShowAdvancedFilters(false);
                      }}
                      className="mt-6 px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-sm shadow-sm transition-all"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto overflow-y-auto flex-1 custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                      <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md shadow-sm">
                        <tr>
                          <th className="py-4 px-5 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            Time
                          </th>
                          <th className="py-4 px-5 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            Dir
                          </th>
                          <th className="py-4 px-5 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            Contact
                          </th>
                          <th className="py-4 px-5 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            Status
                          </th>
                          <th className="py-4 px-5 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 w-1/3">
                            Message Preview
                          </th>
                          <th className="py-4 px-5 text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200 text-right rounded-tr-2xl">
                            Details
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {derived.paginatedMessages.map((msg, idx) => {
                          const isExpanded = expandedRows[msg.id || idx];
                          const isOutbound =
                            msg.direction?.includes("outbound");
                          const mCount = msg.numMedia || msg.mediaCount || 0;

                          return (
                            <React.Fragment key={msg.id || idx}>
                              <tr
                                className={`group hover:bg-slate-50/50 transition-colors cursor-pointer ${isExpanded ? "bg-slate-50/80" : ""}`}
                                onClick={() => toggleExpand(msg.id || idx)}
                              >
                                <td className="py-3 px-5 whitespace-nowrap">
                                  {formatSafeDate(
                                    msg.timestamp || msg.dateSent,
                                  )}
                                </td>
                                <td className="py-3 px-5 whitespace-nowrap">
                                  {isOutbound ? (
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md w-fit border border-blue-100/50">
                                      <ArrowUpRight size={14} /> OUT
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md w-fit border border-indigo-100/50">
                                      <ArrowDownLeft size={14} /> IN
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-5 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200/60 shrink-0">
                                      <Smartphone size={14} />
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-slate-700 font-mono tracking-tight">
                                        {msg.to}
                                      </span>
                                      <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                        from {msg.from}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-5 whitespace-nowrap">
                                  {getStatusBadge(msg.status)}
                                </td>
                                <td className="py-3 px-5">
                                  <div className="flex items-center gap-2">
                                    {mCount > 0 && (
                                      <div className="flex items-center gap-1 text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200/50 shrink-0">
                                        <Paperclip size={12} /> {mCount}
                                      </div>
                                    )}
                                    <span
                                      className={`text-sm truncate max-w-[200px] sm:max-w-xs md:max-w-md ${!msg.body ? "italic text-slate-400 font-medium" : "text-slate-600"}`}
                                    >
                                      {msg.body || "No text content"}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-5 text-right whitespace-nowrap">
                                  <button
                                    className={`p-1.5 rounded-lg transition-colors ${isExpanded ? "bg-slate-200 text-slate-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"}`}
                                  >
                                    {isExpanded ? (
                                      <ChevronLeft
                                        size={18}
                                        className="-rotate-90"
                                      />
                                    ) : (
                                      <ChevronRight size={18} />
                                    )}
                                  </button>
                                </td>
                              </tr>
                              {/* --- EXPANDED DETAILS --- */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan="6" className="p-0">
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{
                                          opacity: 1,
                                          height: "auto",
                                        }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="bg-slate-50/50 border-y border-slate-100 overflow-hidden"
                                      >
                                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 relative">
                                          <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-200 rounded-full"></div>

                                          <div className="pl-6">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                              <MessageCircle size={14} /> Full
                                              Message
                                            </h4>
                                            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                                              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                                {msg.body || (
                                                  <span className="italic text-slate-400">
                                                    Media only. No text content.
                                                  </span>
                                                )}
                                              </p>
                                            </div>
                                            {mCount > 0 && (
                                              <div className="mt-4 flex items-center gap-2">
                                                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-xs font-bold w-fit">
                                                  <Paperclip size={14} />
                                                  {mCount} Media File(s)
                                                  Attached
                                                </div>
                                              </div>
                                            )}
                                          </div>

                                          <div>
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                              <Globe size={14} /> Network
                                              Metadata
                                            </h4>
                                            <div className="bg-slate-800 rounded-xl p-4 shadow-inner text-slate-300 font-mono text-xs overflow-x-auto custom-scrollbar border border-slate-700">
                                              <div className="grid grid-cols-[100px_1fr] gap-y-2 gap-x-4 w-fit">
                                                <div className="text-slate-500">
                                                  SID:
                                                </div>
                                                <div className="text-emerald-400 break-all select-all">
                                                  {msg.id || msg.sid}
                                                </div>

                                                <div className="text-slate-500">
                                                  API Status:
                                                </div>
                                                <div>
                                                  <span
                                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${["delivered", "read"].includes(msg.status?.toLowerCase()) ? "bg-emerald-500/20 text-emerald-400" : ["failed", "undelivered"].includes(msg.status?.toLowerCase()) ? "bg-rose-500/20 text-rose-400" : "bg-blue-500/20 text-blue-400"}`}
                                                  >
                                                    {msg.status}
                                                  </span>
                                                </div>

                                                <div className="text-slate-500">
                                                  Raw Time:
                                                </div>
                                                <div>
                                                  {msg.timestamp ||
                                                    msg.dateSent}
                                                </div>

                                                <div className="text-slate-500">
                                                  Price:
                                                </div>
                                                <div>
                                                  {msg.price
                                                    ? `${msg.price} ${msg.priceUnit}`
                                                    : "N/A"}
                                                </div>

                                                {msg.errorMessage && (
                                                  <>
                                                    <div className="text-rose-400/70 mt-2 pt-2 border-t border-slate-700">
                                                      Error:
                                                    </div>
                                                    <div className="text-rose-400 mt-2 pt-2 border-t border-slate-700 break-words">
                                                      [{msg.errorCode}]{" "}
                                                      {msg.errorMessage}
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            </div>
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
                      </tbody>
                    </table>
                  </div>

                  {/* --- PAGINATION --- */}
                  <div className="border-t border-slate-200 px-4 py-3 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0 rounded-b-2xl">
                    <div className="text-xs sm:text-sm text-slate-500 font-medium">
                      Showing{" "}
                      <span className="font-bold text-slate-700">
                        {(state.currentPage - 1) * state.itemsPerPage + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-bold text-slate-700">
                        {Math.min(
                          state.currentPage * state.itemsPerPage,
                          derived.filteredMessages.length,
                        )}
                      </span>{" "}
                      of{" "}
                      <span className="font-bold text-slate-700">
                        {derived.filteredMessages.length}
                      </span>{" "}
                      logs
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() =>
                          setters.setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={state.currentPage === 1}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-1"
                      >
                        <ChevronLeft size={14} /> Prev
                      </button>
                      <button
                        onClick={() =>
                          setters.setCurrentPage((p) =>
                            Math.min(derived.totalPages, p + 1),
                          )
                        }
                        disabled={
                          state.currentPage === derived.totalPages ||
                          derived.totalPages === 0
                        }
                        className="px-3 py-1.5 sm:px-4 sm:py-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-50 transition-all flex items-center gap-1"
                      >
                        Next <ChevronRight size={14} />
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
