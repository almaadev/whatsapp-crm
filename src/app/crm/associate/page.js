"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useAuth } from "@/shared/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { usePathStore } from "@/features/chat/stores/pathStore";
import {
    Users, Clock, CheckCircle2, Target, Calendar,
    Filter, Search, ArrowRight, UserCircle,
    Activity, Tag, MessageSquare, Menu, AlertCircle, RefreshCw, X, History
} from "lucide-react";
import { useCountUp } from "@/shared/hooks/useCountUp";
import { reportRepository } from "@/shared/api/repositories/reportRepository";
import { formatDurationHuman } from "@/shared/hooks/useAssociateSession";
import { formatISTTime, formatISTDate } from "@/shared/utils/dateRangeResolver";

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTING & NAVIGATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function navigateToLead(router, setPath, currentPath, phone) {
    const safePhone = phone?.replace("whatsapp:", "")?.trim();
    if (!safePhone) return;
    
    setPath(currentPath);
    router.push(`/crm/leads/${encodeURIComponent(safePhone)}`);
}



// ─────────────────────────────────────────────────────────────────────────────
//  UI UTILITIES & COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ displayStatus, latestStatus }) => {
    let base = "bg-slate-100 text-slate-600 border-slate-200";
    if (displayStatus?.includes("Closed") || latestStatus === "Closed")
        base = "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (latestStatus === "New")
        base = "bg-blue-50 text-blue-700 border-blue-200";
    else if (latestStatus === "Follow Up")
        base = "bg-amber-50 text-amber-700 border-amber-200";
    else if (latestStatus === "Not Interested")
        base = "bg-rose-50 text-rose-700 border-rose-200";

    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${base} whitespace-nowrap`}>
            {displayStatus || latestStatus || "Unknown"}
        </span>
    );
};

const AttendanceCard = ({ associateSession, onViewHistory }) => {
    const isOnline = associateSession?.isOnline;
    const loginTimeStr = associateSession?.loginAt
        ? new Date(associateSession.loginAt).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        })
        : "-";

    return (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-3.5 sm:p-4 border border-slate-700/80 shadow-md relative overflow-hidden group transition-all">
            <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl opacity-15 -mr-8 -mt-8 pointer-events-none ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            
            <div className="relative z-10 flex flex-col gap-2.5">
                {/* Header Row */}
                <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Clock size={13} className="text-[#00a884]" /> Today's Attendance
                    </h3>
                    
                    <div className="flex items-center gap-2">
                        {isOnline ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                ONLINE
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                                OFFLINE
                            </span>
                        )}

                        <button
                            onClick={onViewHistory}
                            className="px-2.5 py-1 text-[11px] font-extrabold bg-white/10 hover:bg-white/20 text-white border border-white/15 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                            <History size={12} />
                            <span>My History</span>
                        </button>
                    </div>
                </div>

                {/* Compact Inline Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 pt-2 border-t border-slate-800/80 items-center">
                    <div className="flex items-baseline justify-between sm:justify-start sm:gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Logged In</span>
                        <span className="text-xs sm:text-sm font-extrabold text-white font-mono">{loginTimeStr}</span>
                    </div>

                    <div className="flex items-baseline justify-between sm:justify-start sm:gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Online</span>
                        <span className="text-sm sm:text-base font-black font-mono text-emerald-400 tracking-tight">
                            {associateSession?.formattedTimer || "00:00:00"}
                        </span>
                    </div>

                    <div className="flex items-baseline justify-between sm:justify-start sm:gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">Offline Break</span>
                        <span className="text-xs sm:text-sm font-bold font-mono text-amber-400">
                            {associateSession?.formattedOffline || "00:00:00"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SelfAttendanceModal = ({ isOpen, onClose }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState("30days");
    const [error, setError] = useState(null);

    const fetchHistory = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/associate-session/history?dateRange=${dateRange}`);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || "Failed to fetch attendance history");
            setHistory(data.sessions || []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [dateRange]);

    useEffect(() => {
        if (isOpen) fetchHistory();
    }, [isOpen, fetchHistory]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
                <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <History size={18} className="text-[#00a884]" />
                        <h3 className="font-extrabold text-base">My Attendance & Session History</h3>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Self Session Logs</span>
                    <select
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                        className="py-1 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    >
                        <option value="today">Today</option>
                        <option value="7days">Last 7 Days</option>
                        <option value="30days">Last 30 Days</option>
                    </select>
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                            <RefreshCw className="animate-spin text-[#00a884]" size={24} />
                            <span className="text-xs font-bold uppercase tracking-widest">Loading History...</span>
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center text-rose-500 font-bold text-sm">{error}</div>
                    ) : history.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs font-bold">No attendance records found for this period.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                    <th className="py-3 px-3">Date</th>
                                    <th className="py-3 px-3">Login (IST)</th>
                                    <th className="py-3 px-3">Logout (IST)</th>
                                    <th className="py-3 px-3">Online</th>
                                    <th className="py-3 px-3">Offline Break</th>
                                    <th className="py-3 px-3">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-bold">
                                {history.map((sess) => (
                                    <tr key={sess._id} className="hover:bg-slate-50">
                                        <td className="py-3 px-3 text-slate-700">{formatISTDate(sess.loginAt)}</td>
                                        <td className="py-3 px-3 text-slate-800">{formatISTTime(sess.loginAt)}</td>
                                        <td className="py-3 px-3 text-slate-800">{formatISTTime(sess.logoutAt)}</td>
                                        <td className="py-3 px-3 font-mono text-emerald-600">{formatDurationHuman(sess.totalOnlineSeconds)}</td>
                                        <td className="py-3 px-3 font-mono text-amber-600">{formatDurationHuman(sess.totalOfflineSeconds)}</td>
                                        <td className="py-3 px-3 uppercase text-[10px]">
                                            <span className={`px-2 py-0.5 rounded-full font-bold ${
                                                sess.status === 'online' ? 'bg-emerald-100 text-emerald-800' :
                                                sess.status === 'offline' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                                {sess.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-100 text-right">
                    <button onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

const MetricCard = ({ title, value, icon, color, subtitle, alert }) => {
    const colorMap = {
        blue: "from-blue-100 border-blue-200 text-blue-600",
        rose: "from-rose-100 border-rose-200 text-rose-600",
        amber: "from-amber-100 border-amber-200 text-amber-600",
    };

    return (
        <div className={`bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs relative overflow-hidden group transition-all hover:border-${color}-300 ${alert ? "ring-2 ring-rose-400 border-rose-400" : ""}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${colorMap[color].split(" ")[0]} to-transparent opacity-40 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110`} />
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{title}</h3>
                    <span className="text-xl sm:text-2xl font-extrabold text-slate-800">
                        <AnimatedCount end={value} />
                    </span>
                    <p className={`text-[11px] font-semibold mt-1 ${alert ? "text-rose-500 animate-pulse" : "text-slate-400"}`}>
                        {subtitle}
                    </p>
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                    {icon}
                </div>
            </div>
        </div>
    );
};

const AnimatedCount = ({ end }) => {
    const count = useCountUp(end);
    return <>{count}</>;
};

const SkeletonCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs h-[90px] sm:h-[95px] animate-pulse flex justify-between items-start">
                <div className="space-y-2 w-1/2">
                    <div className="h-2.5 bg-slate-200 rounded w-full" />
                    <div className="h-6 bg-slate-200 rounded w-2/3" />
                    <div className="h-2 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="w-8 h-8 sm:w-9 sm:h-9 bg-slate-100 rounded-xl" />
            </div>
        ))}
    </div>
);

const SkeletonRows = () => (
    <>
        {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="animate-pulse border-b border-slate-100">
                <td className="px-4 sm:px-6 py-3">
                    <div className="flex gap-3">
                        <div className="w-8 h-8 bg-slate-200 rounded-full shrink-0" />
                        <div className="space-y-1.5 flex-1">
                            <div className="w-24 h-3 bg-slate-200 rounded" />
                            <div className="w-32 h-2 bg-slate-100 rounded" />
                        </div>
                    </div>
                </td>
                <td className="px-4 sm:px-6 py-3">
                    <div className="w-20 h-4 bg-slate-200 rounded-full mb-1" />
                    <div className="w-24 h-2.5 bg-slate-100 rounded" />
                </td>
                <td className="px-4 sm:px-6 py-3 hidden md:table-cell">
                    <div className="w-24 h-3 bg-slate-200 rounded mb-1" />
                    <div className="w-16 h-2 bg-slate-100 rounded" />
                </td>
                <td className="px-4 sm:px-6 py-3 hidden lg:table-cell">
                    <div className="w-32 h-3 bg-slate-200 rounded mb-1" />
                    <div className="w-20 h-2.5 bg-slate-100 rounded" />
                </td>
                <td className="px-4 sm:px-6 py-3 text-right">
                    <div className="w-7 h-7 bg-slate-200 rounded-full inline-block" />
                </td>
            </tr>
        ))}
    </>
);

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AssociateDashboard() {
    const router = useRouter();
    const pathname = usePathname();
    const { setPath } = usePathStore();
    const { data: session, status } = useSession();
    const { user, isLoading } = useAuth();
    
    const { setMobileOpen, associateSession } = useCrmLayout();
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [historyModalOpen, setHistoryModalOpen] = useState(false);

    // --- Dashboard State ---
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [dashboardData, setDashboardData] = useState({ stats: null, leads: [] });
    
    // --- API & UI States ---
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [retryCount, setRetryCount] = useState(0);
    
    // --- Filters ---
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("All");
    const [statusFilter, setStatusFilter] = useState("All");
    const [ownershipFilter, setOwnershipFilter] = useState("All");

    const activeUser = user || session?.user;
    const userRole = activeUser?.role || "associate";
    const userName = activeUser?.name || "Associate";

    // Auth Guard
    useEffect(() => {
        if (status === "loading" || isLoading) return;

        if ((status === "unauthenticated" && !user) || (!user && !session)) {
            router.replace("/");
            return;
        }

        const currentUser = user || session?.user;
        if (!currentUser) return;

        const allowedDepartments = ["telecalling", "support", "admin", "sales", "doctor"];
        const userDept = currentUser.department?.toLowerCase();

        if (!allowedDepartments.includes(userDept)) {
            router.replace("/crm/admin");
        } else {
            setIsAuthorized(true);
        }
    }, [status, isLoading, user, session, router]);

    // Data Fetching
    useEffect(() => {
        if (!isAuthorized) return;

        const controller = new AbortController();
        const signal = controller.signal;

        const fetchDashboard = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const { data } = await reportRepository.getAssociateDashboard(`month=${selectedMonth}&year=${selectedYear}`, { signal });
                setDashboardData(data);
            } catch (err) {
                if (err.name === "CanceledError" || err.code === "ERR_CANCELED") return;
                console.error("Dashboard fetch error:", err);
                setError(err.response?.data?.message || err.message || "An unexpected error occurred.");
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        };
        
        fetchDashboard();
        
        return () => controller.abort();
    }, [selectedMonth, selectedYear, isAuthorized, retryCount]);

    // Derived Computations
    const filteredLeads = useMemo(() => {
        return dashboardData.leads.filter((lead) => {
            const matchesSearch = lead.name.toLowerCase().includes(searchQuery.toLowerCase()) || lead.phone.includes(searchQuery);
            const leadType = lead.latestFollowUp?.leadType || "Direct Lead";
            const matchesType = typeFilter === "All" || leadType === typeFilter;

            let matchesStatus = true;
            if (statusFilter !== "All") {
                if (statusFilter === "Closed") matchesStatus = lead.isClosed;
                else matchesStatus = lead.latestFollowUp?.status === statusFilter;
            }

            const matchesOwnership = ownershipFilter === "All" || lead.currentHandler === userName;

            return matchesSearch && matchesType && matchesStatus && matchesOwnership;
        });
    }, [dashboardData.leads, searchQuery, typeFilter, statusFilter, ownershipFilter, userName]);

    const setQuickFilter = (type) => {
        const d = new Date();
        if (type === "thisMonth") {
            setSelectedMonth(d.getMonth() + 1);
            setSelectedYear(d.getFullYear());
        } else if (type === "lastMonth") {
            let m = d.getMonth();
            let y = d.getFullYear();
            if (m === 0) { m = 12; y -= 1; }
            setSelectedMonth(m);
            setSelectedYear(y);
        }
    };

    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const years = [2024, 2025, 2026, 2027];
    const lastMonth = (() => { const m = new Date().getMonth(); return m === 0 ? 12 : m; })();
    const isThisMonth = selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear();
    const isLastMonth = selectedMonth === lastMonth && selectedYear === new Date().getFullYear();

    if (!isAuthorized || status === "loading") {
        return (
            <div className="flex items-center justify-center w-screen bg-slate-50 text-slate-400">
                <RefreshCw className="animate-spin mr-2" size={24} />
                <span className="font-bold tracking-widest uppercase text-sm">Loading Session...</span>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
            <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
                {/* ── HEADER ── */}
                <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 z-20 shrink-0 shadow-xs select-none">
                    <div className="flex items-center gap-3">
                        <button className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                            <Menu size={18} />
                        </button>
                        <div>
                            <h1 className="text-lg sm:text-xl font-extrabold text-slate-800 tracking-tight leading-tight">Performance Hub</h1>
                            <p className="text-xs font-medium text-slate-500 hidden sm:block">Track your pipeline and lifecycle metrics.</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-0.5 sm:pb-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 w-max sm:w-auto min-w-0">
                            <button onClick={() => setQuickFilter("lastMonth")} className={`px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-white rounded-lg transition-all whitespace-nowrap min-h-[32px] ${isLastMonth ? "bg-white text-[#00a884] shadow-xs" : "text-slate-600 hover:bg-white"}`}>Last Month</button>
                            <button onClick={() => setQuickFilter("thisMonth")} className={`px-2.5 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[32px] ${isThisMonth ? "bg-white text-[#00a884] shadow-xs" : "text-slate-600 hover:bg-white"}`}>This Month</button>
                            <div className="w-px h-4 bg-slate-300 mx-0.5 shrink-0" />
                            <div className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-1.5">
                                <Calendar size={12} className="text-slate-400 shrink-0" />
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer min-h-[32px]">
                                    {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                </select>
                                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent text-xs font-bold text-slate-700 outline-none cursor-pointer min-h-[32px]">
                                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── SCROLLABLE BODY ── */}
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 lg:p-6 custom-scrollbar">
                    <div className="max-w-7xl mx-auto space-y-4 sm:space-y-5">

                        {error ? (
                            <div className="flex flex-col items-center justify-center bg-white border border-rose-200 rounded-2xl p-6 sm:p-8 shadow-xs text-center">
                                <AlertCircle size={36} className="text-rose-500 mb-3" />
                                <h3 className="text-base font-bold text-slate-800 mb-1">Failed to load dashboard data</h3>
                                <p className="text-xs text-slate-500 mb-4">{error}</p>
                                <button onClick={() => setRetryCount(c => c + 1)} className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all">
                                    <RefreshCw size={14} /> Try Again
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* ── ATTENDANCE CARD WITH HISTORY ACTION ── */}
                                <AttendanceCard associateSession={associateSession} onViewHistory={() => setHistoryModalOpen(true)} />

                                {/* ── SELF ATTENDANCE HISTORY MODAL ── */}
                                <SelfAttendanceModal isOpen={historyModalOpen} onClose={() => setHistoryModalOpen(false)} />

                                {/* ── KPI CARDS ── */}
                                {loading ? <SkeletonCards /> : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                                        <MetricCard title="New Leads Acquired" value={dashboardData.stats?.total || 0} icon={<Users size={16} className="text-blue-500 sm:w-4.5 sm:h-4.5" />} color="blue" subtitle="First interaction this month" />
                                        <MetricCard title="Pending Actions" value={dashboardData.stats?.pending || 0} icon={<Clock size={16} className="text-rose-500 sm:w-4.5 sm:h-4.5" />} color="rose" subtitle="Overdue > 48 hours" alert={dashboardData.stats?.pending > 0} />
                                        <MetricCard title="Active Follow-ups" value={dashboardData.stats?.followUp || 0} icon={<Activity size={16} className="text-amber-500 sm:w-4.5 sm:h-4.5" />} color="amber" subtitle="Touched by you this month" />
                                        
                                        <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-xs relative overflow-hidden group hover:border-emerald-300 transition-all">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-100 to-transparent opacity-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
                                            <div className="flex justify-between items-start relative z-10">
                                                <div>
                                                    <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Monthly Goal</h3>
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-xl sm:text-2xl font-extrabold text-slate-800"><AnimatedCount end={dashboardData.stats?.achieved || 0} /></span>
                                                        <span className="text-xs font-bold text-slate-400">/ {dashboardData.stats?.target || 0}</span>
                                                    </div>
                                                    <p className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1"><CheckCircle2 size={11} /> Closed by you</p>
                                                </div>
                                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-4 border-emerald-100 flex items-center justify-center relative shrink-0">
                                                    <Target size={15} className="text-emerald-500" />
                                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                                        <circle cx="16" cy="16" r="16" fill="none" strokeWidth="3" className="stroke-emerald-500" strokeDasharray="100" strokeDashoffset={100 - (100 * Math.min((dashboardData.stats?.achieved || 0) / Math.max(dashboardData.stats?.target || 1, 1), 1))} strokeLinecap="round" transform="translate(2,2)" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── ACTIVITY TABLE ── */}
                                <div className="bg-white rounded-2xl shadow-xs border border-slate-200 flex flex-col">
                                    <div className="p-3.5 sm:p-4 border-b border-slate-100 flex flex-col gap-2.5 bg-slate-50/50 rounded-t-2xl">
                                        <div className="flex items-center justify-between gap-2">
                                            <h2 className="text-sm sm:text-base font-extrabold text-slate-800">Your Leads Activity</h2>
                                            <Filter size={14} className="text-slate-400 sm:hidden" />
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
                                            <div className="relative w-full sm:w-56">
                                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input type="text" placeholder="Search name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] w-full transition-all min-h-[36px]" />
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <select value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value)} className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer hover:bg-slate-50 min-h-[36px]">
                                                    <option value="All">All Touched Leads</option>
                                                    <option value="Mine">Assigned to Me</option>
                                                </select>
                                                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none cursor-pointer hover:bg-slate-50 min-h-[36px]">
                                                    <option value="All">All Statuses</option>
                                                    <option value="Follow Up">Follow Up</option>
                                                    <option value="Closed">Closed</option>
                                                    <option value="New">New</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse min-w-[540px]">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                    <th className="px-4 sm:px-5 py-2.5 sm:py-3">Customer</th>
                                                    <th className="px-4 sm:px-5 py-2.5 sm:py-3">Status</th>
                                                    <th className="px-4 sm:px-5 py-2.5 sm:py-3 hidden md:table-cell">Timeline</th>
                                                    <th className="px-4 sm:px-5 py-2.5 sm:py-3 hidden lg:table-cell">Latest Note</th>
                                                    <th className="px-4 sm:px-5 py-2.5 sm:py-3 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {loading ? <SkeletonRows /> : filteredLeads.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="px-5 py-8 text-center text-slate-400 font-medium text-xs">
                                                            No leads match the current filters for this month.
                                                        </td>
                                                    </tr>
                                                ) : filteredLeads.map((lead, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                                        <td className="px-4 sm:px-5 py-2.5 sm:py-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-200">
                                                                    {lead.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-slate-800 text-xs truncate max-w-[100px] sm:max-w-none">{lead.name}</div>
                                                                    <div className="text-[10px] font-mono text-slate-500 truncate">{lead.phone.replace("whatsapp:", "")}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-5 py-2.5 sm:py-3">
                                                            <div className="flex flex-col items-start gap-0.5">
                                                                <StatusBadge displayStatus={lead.status} latestStatus={lead.latestFollowUp?.status} />
                                                                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md mt-0.5">
                                                                    <UserCircle size={10} />
                                                                    <span className={lead.currentHandler === userName ? "text-[#00a884]" : ""}>{lead.currentHandler}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-5 py-2.5 sm:py-3 hidden md:table-cell">
                                                            <div className="flex flex-col gap-0.5 text-xs">
                                                                <div className="flex items-center gap-1 font-bold text-slate-700 text-xs">
                                                                    <Activity size={12} className="text-blue-500" /> 
                                                                    {lead.followUpCount} Closure{lead.followUpCount !== 1 ? 's' : ''}
                                                                </div>
                                                                <div className="text-slate-500 text-[11px] font-medium">
                                                                    Last: {lead.latestFollowUp?.date ? new Date(lead.latestFollowUp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "N/A"}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-5 py-2.5 sm:py-3 max-w-[200px] hidden lg:table-cell">
                                                            <div className="flex items-start gap-1.5">
                                                                <MessageSquare size={12} className="text-slate-400 mt-0.5 shrink-0" />
                                                                <p className="text-xs text-slate-600 truncate font-medium" title={lead.latestFollowUp?.overAllRemarks || "No remarks"}>
                                                                    {lead.latestFollowUp?.overAllRemarks || <span className="italic text-slate-400">No remarks</span>}
                                                                </p>
                                                            </div>
                                                            <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                                <Tag size={9} /> {lead.latestFollowUp?.leadType || "Direct Lead"}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-5 py-2.5 sm:py-3 text-right">
                                                            <button
                                                                onClick={() => navigateToLead(router, setPath, pathname, lead.phone)}
                                                                className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 hover:bg-[#00a884] hover:text-white transition-all group-hover:shadow-xs"
                                                                aria-label={`View ${lead.name}`}
                                                            >
                                                                <ArrowRight size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}