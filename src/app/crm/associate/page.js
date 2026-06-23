"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { useCrmLayout } from "@/components/layout/CrmShell";
import { usePathStore } from "@/stores/pathStore";
import {
    Users, Clock, CheckCircle2, Target, Calendar,
    Filter, Search, ArrowRight, UserCircle,
    Activity, Tag, MessageSquare, Menu, AlertCircle, RefreshCw
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
//  ROUTING & NAVIGATION UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function navigateToLead(router, setPath, currentPath, phone) {
    const safePhone = phone?.replace("whatsapp:", "")?.trim();
    if (!safePhone) return;
    
    // Atomic path memory and navigation
    setPath(currentPath);
    router.push(`/crm/leads/${encodeURIComponent(safePhone)}`);
}

// ─────────────────────────────────────────────────────────────────────────────
//  UI UTILITIES & COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function useCountUp(end, duration = 1000) {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let startTime = null;
        const animate = (currentTime) => {
            if (!startTime) startTime = currentTime;
            const progress = Math.min((currentTime - startTime) / duration, 1);
            setCount(Math.floor(progress * end));
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [end, duration]);
    return count;
}

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
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${base} whitespace-nowrap`}>
            {displayStatus || latestStatus || "Unknown"}
        </span>
    );
};

const MetricCard = ({ title, value, icon, color, subtitle, alert }) => {
    const colorMap = {
        blue: "from-blue-100 border-blue-200 text-blue-600",
        rose: "from-rose-100 border-rose-200 text-rose-600",
        amber: "from-amber-100 border-amber-200 text-amber-600",
    };

    return (
        <div className={`bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm relative overflow-hidden group transition-all hover:border-${color}-300 ${alert ? "ring-2 ring-rose-400 border-rose-400" : ""}`}>
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colorMap[color].split(" ")[0]} to-transparent opacity-40 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110`} />
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">{title}</h3>
                    <span className="text-2xl sm:text-3xl font-extrabold text-slate-800">
                        <AnimatedCount end={value} />
                    </span>
                    <p className={`text-xs font-semibold mt-2 ${alert ? "text-rose-500 animate-pulse" : "text-slate-400"}`}>
                        {subtitle}
                    </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm h-[120px] sm:h-[130px] animate-pulse flex justify-between items-start">
                <div className="space-y-3 w-1/2">
                    <div className="h-3 bg-slate-200 rounded w-full" />
                    <div className="h-8 bg-slate-200 rounded w-2/3" />
                    <div className="h-2 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-100 rounded-xl" />
            </div>
        ))}
    </div>
);

const SkeletonRows = () => (
    <>
        {[1, 2, 3, 4, 5].map((i) => (
            <tr key={i} className="animate-pulse border-b border-slate-100">
                <td className="px-4 sm:px-6 py-4">
                    <div className="flex gap-3">
                        <div className="w-9 h-9 bg-slate-200 rounded-full shrink-0" />
                        <div className="space-y-2 flex-1">
                            <div className="w-24 h-3 bg-slate-200 rounded" />
                            <div className="w-32 h-2 bg-slate-100 rounded" />
                        </div>
                    </div>
                </td>
                <td className="px-4 sm:px-6 py-4">
                    <div className="w-20 h-5 bg-slate-200 rounded-full mb-2" />
                    <div className="w-24 h-3 bg-slate-100 rounded" />
                </td>
                <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                    <div className="w-24 h-3 bg-slate-200 rounded mb-2" />
                    <div className="w-16 h-2 bg-slate-100 rounded" />
                </td>
                <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                    <div className="w-32 h-3 bg-slate-200 rounded mb-2" />
                    <div className="w-20 h-3 bg-slate-100 rounded" />
                </td>
                <td className="px-4 sm:px-6 py-4 text-right">
                    <div className="w-8 h-8 bg-slate-200 rounded-full inline-block" />
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
    
    const {setMobileOpen} = useCrmLayout()
    // --- Routing & Authorization State ---
    const [isAuthorized, setIsAuthorized] = useState(false);

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

    const userRole = session?.user?.role || "associate";
    const userName = session?.user?.name || "Associate";

    // ── 1. Centralized Routing & Auth Guard ──────────────────────────────────
    useEffect(() => {
        if (status === "loading") return;

        if (status === "unauthenticated" || !session) {
            router.replace("/");
            return;
        }

        // Strict Role Validation
        const allowedDepartments = ["telecalling", "support", "admin", "sales", "doctor"];
        const userDept = session.user?.department?.toLowerCase();

        if (!allowedDepartments.includes(userDept)) {
            router.replace("/crm/admin");
        } else {
            setIsAuthorized(true);
        }
    }, [status, session, router]);

    // ── 2. Data Fetching with Race Condition Protection ──────────────────────
    useEffect(() => {
        if (!isAuthorized) return;

        const controller = new AbortController();
        const signal = controller.signal;

        const fetchDashboard = async () => {
            setLoading(true);
            setError(null);
            
            try {
                const res = await fetch(`/api/associate/dashboard?month=${selectedMonth}&year=${selectedYear}`, { signal });
                if (!res.ok) throw new Error("Failed to sync dashboard data.");
                
                const data = await res.json();
                setDashboardData(data);
            } catch (err) {
                if (err.name === "AbortError") return; // Ignore stale request cancellations
                console.error("Dashboard fetch error:", err);
                setError(err.message || "An unexpected error occurred.");
            } finally {
                if (!signal.aborted) setLoading(false);
            }
        };
        
        fetchDashboard();
        
        // Cleanup: Abort stale requests if month/year changes rapidly
        return () => controller.abort();
    }, [selectedMonth, selectedYear, isAuthorized, retryCount]);

    // ── 3. Derived Computations ──────────────────────────────────────────────
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
    const isThisMonth = selectedMonth === new Date().getMonth() + 1 && selectedYear === new Date().getFullYear();

    // Prevent rendering dashboard flash before redirect finishes
    if (!isAuthorized || status === "loading") {
        return (
            <div className="flex items-center justify-center w-screen  bg-slate-50 text-slate-400">
                <RefreshCw className="animate-spin mr-2" size={24} />
                <span className="font-bold tracking-widest uppercase text-sm">Loading Session...</span>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
            {/* Mobile Overlay */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
                
                {/* ── HEADER ── */}
                <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 z-20 shrink-0 shadow-sm select-none">
                    <div className="flex items-center gap-3">
                        <button className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                            <Menu size={20} />
                        </button>
                        <div>
                            <h1 className="text-lg sm:text-2xl font-extrabold text-slate-800 tracking-tight leading-tight">Performance Hub</h1>
                            <p className="text-xs sm:text-sm font-medium text-slate-500 hidden sm:block">Track your pipeline and lifecycle metrics.</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0 pb-0.5 sm:pb-0">
                        <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-max sm:w-auto min-w-0">
                            <button onClick={() => setQuickFilter("lastMonth")} className="px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white rounded-lg transition-all whitespace-nowrap min-h-[36px]">Last Month</button>
                            <button onClick={() => setQuickFilter("thisMonth")} className={`px-3 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap min-h-[36px] ${isThisMonth ? "bg-white text-[#00a884] shadow-sm" : "text-slate-600 hover:bg-white"}`}>This Month</button>
                            <div className="w-px h-4 bg-slate-300 mx-0.5 shrink-0" />
                            <div className="flex items-center gap-1.5 sm:gap-2 px-1 sm:px-2">
                                <Calendar size={13} className="text-slate-400 shrink-0" />
                                <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none cursor-pointer min-h-[36px]">
                                    {months.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                                </select>
                                <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bg-transparent text-xs sm:text-sm font-bold text-slate-700 outline-none cursor-pointer min-h-[36px]">
                                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── SCROLLABLE BODY ── */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
                    <div className="max-w-7xl mx-auto space-y-6 sm:space-y-8">

                        {/* Error Fallback UI */}
                        {error ? (
                            <div className="flex flex-col items-center justify-center bg-white border border-rose-200 rounded-2xl p-8 sm:p-12 shadow-sm text-center">
                                <AlertCircle size={40} className="text-rose-500 mb-4" />
                                <h3 className="text-lg font-bold text-slate-800 mb-2">Failed to load dashboard data</h3>
                                <p className="text-sm text-slate-500 mb-6">{error}</p>
                                <button onClick={() => setRetryCount(c => c + 1)} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl flex items-center gap-2 transition-all">
                                    <RefreshCw size={16} /> Try Again
                                </button>
                            </div>
                        ) : (
                            <>
                                {/* ── KPI CARDS ── */}
                                {loading ? <SkeletonCards /> : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                                        <MetricCard title="New Leads Acquired" value={dashboardData.stats?.total || 0} icon={<Users size={18} className="text-blue-500 sm:w-5 sm:h-5" />} color="blue" subtitle="First interaction this month" />
                                        <MetricCard title="Pending Actions" value={dashboardData.stats?.pending || 0} icon={<Clock size={18} className="text-rose-500 sm:w-5 sm:h-5" />} color="rose" subtitle="Overdue > 48 hours" alert={dashboardData.stats?.pending > 0} />
                                        <MetricCard title="Active Follow-ups" value={dashboardData.stats?.followUp || 0} icon={<Activity size={18} className="text-amber-500 sm:w-5 sm:h-5" />} color="amber" subtitle="Touched by you this month" />
                                        
                                        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent opacity-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110" />
                                            <div className="flex justify-between items-start relative z-10">
                                                <div>
                                                    <h3 className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Monthly Goal</h3>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-2xl sm:text-3xl font-extrabold text-slate-800"><AnimatedCount end={dashboardData.stats?.achieved || 0} /></span>
                                                        <span className="text-sm font-bold text-slate-400">/ {dashboardData.stats?.target || 0}</span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-emerald-600 mt-2 flex items-center gap-1"><CheckCircle2 size={12} /> Closed by you</p>
                                                </div>
                                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-emerald-100 flex items-center justify-center relative shrink-0">
                                                    <Target size={18} className="text-emerald-500" />
                                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                                        <circle cx="20" cy="20" r="20" fill="none" strokeWidth="4" className="stroke-emerald-500" strokeDasharray="125" strokeDashoffset={125 - (125 * Math.min((dashboardData.stats?.achieved || 0) / Math.max(dashboardData.stats?.target || 1, 1), 1))} strokeLinecap="round" transform="translate(4,4)" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ── ACTIVITY TABLE ── */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col">
                                    <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/50 rounded-t-2xl">
                                        <div className="flex items-center justify-between gap-2">
                                            <h2 className="text-base sm:text-lg font-extrabold text-slate-800">Your Leads Activity</h2>
                                            <Filter size={15} className="text-slate-400 sm:hidden" />
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3">
                                            <div className="relative w-full sm:w-60">
                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input type="text" placeholder="Search name or phone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 pr-4 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] w-full transition-all min-h-[40px]" />
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <select value={ownershipFilter} onChange={(e) => setOwnershipFilter(e.target.value)} className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 outline-none cursor-pointer hover:bg-slate-50 min-h-[40px]">
                                                    <option value="All">All Touched Leads</option>
                                                    <option value="Mine">Assigned to Me</option>
                                                </select>
                                                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 outline-none cursor-pointer hover:bg-slate-50 min-h-[40px]">
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
                                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                    <th className="px-4 sm:px-6 py-3 sm:py-4">Customer</th>
                                                    <th className="px-4 sm:px-6 py-3 sm:py-4">Status</th>
                                                    <th className="px-4 sm:px-6 py-3 sm:py-4 hidden md:table-cell">Timeline</th>
                                                    <th className="px-4 sm:px-6 py-3 sm:py-4 hidden lg:table-cell">Latest Note</th>
                                                    <th className="px-4 sm:px-6 py-3 sm:py-4 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {loading ? <SkeletonRows /> : filteredLeads.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="5" className="px-6 py-12 text-center text-slate-400 font-medium text-sm">
                                                            No leads match the current filters for this month.
                                                        </td>
                                                    </tr>
                                                ) : filteredLeads.map((lead, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                                                            <div className="flex items-center gap-2 sm:gap-3">
                                                                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200">
                                                                    {lead.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-slate-800 text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{lead.name}</div>
                                                                    <div className="text-[10px] sm:text-xs font-mono text-slate-500 mt-0.5 truncate">{lead.phone.replace("whatsapp:", "")}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-3 sm:py-4">
                                                            <div className="flex flex-col items-start gap-1">
                                                                <StatusBadge displayStatus={lead.status} latestStatus={lead.latestFollowUp?.status} />
                                                                <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md mt-1">
                                                                    <UserCircle size={11} />
                                                                    <span className={lead.currentHandler === userName ? "text-[#00a884]" : ""}>{lead.currentHandler}</span>
                                                                </div>
                                                            </div>
                                                        </td>
<td className="px-4 sm:px-6 py-3 sm:py-4 hidden md:table-cell">
    <div className="flex flex-col gap-1 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Activity size={13} className="text-blue-500" /> 
            {/* 🚀 Changed text to reflect Closures */}
            {lead.followUpCount} Closure{lead.followUpCount !== 1 ? 's' : ''}
        </div>
        <div className="text-slate-500 font-medium">
            Last: {lead.latestFollowUp?.date ? new Date(lead.latestFollowUp.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "N/A"}
        </div>
    </div>
</td>
                                                        <td className="px-4 sm:px-6 py-3 sm:py-4 max-w-[200px] hidden lg:table-cell">
                                                            <div className="flex items-start gap-2">
                                                                <MessageSquare size={13} className="text-slate-400 mt-0.5 shrink-0" />
                                                                <p className="text-xs text-slate-600 truncate font-medium" title={lead.latestFollowUp?.overAllRemarks || "No remarks"}>
                                                                    {lead.latestFollowUp?.overAllRemarks || <span className="italic text-slate-400">No remarks</span>}
                                                                </p>
                                                            </div>
                                                            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                                                <Tag size={10} /> {lead.latestFollowUp?.leadType || "Direct Lead"}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-3 sm:py-4 text-right">
                                                            <button
                                                                onClick={() => navigateToLead(router, setPath, pathname, lead.phone)}
                                                                className="inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-[#00a884] hover:text-white transition-all group-hover:shadow-md"
                                                                aria-label={`View ${lead.name}`}
                                                            >
                                                                <ArrowRight size={15} />
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