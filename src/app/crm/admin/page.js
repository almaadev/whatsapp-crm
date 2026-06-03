"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";

import Link from "next/link";
import {
  Users,
  TrendingUp,
  Briefcase,
  Edit2,
  Save,
  XCircle,
  ChevronRight,
  Shield,
  Menu,
  Filter,
  Headset,
  Clock,
  CheckCircle,
  ShieldAlert,
  Calendar,
  Search,
  ArrowUpDown,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";

// --- Utility: Animated Counter ---
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

const AnimatedCount = ({ end }) => {
  const count = useCountUp(end);
  return <>{count}</>;
};

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // 🚀 FIX: Prevent fetching until localStorage is read to avoid hydration errors
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [associates, setAssociates] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalLeads: 0,
    totalPending: 0,
    totalFollowUp: 0,
    totalAchieved: 0,
    totalTarget: 0,
  });

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState("");
  const [filterView, setFilterView] = useState("all"); 
  const [sortConfig, setSortConfig] = useState({
    key: "achievedCount",
    direction: "desc",
  });

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [tempTarget, setTempTarget] = useState(0);

  const isSuperAdmin = session?.user?.role === "superAdmin";
  const isAuthorized =
    isSuperAdmin ||
    (session?.user?.role === "sales" && session?.user?.department === "admin") ||
    (session?.user?.role === "doctor" && session?.user?.department === "admin");

  // 🚀 FIX 1: Read from LocalStorage on initial load
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedView = localStorage.getItem("dashboard_filterView");
      const storedMonth = localStorage.getItem("dashboard_selectedMonth");
      const storedYear = localStorage.getItem("dashboard_selectedYear");

      if (storedView) setFilterView(storedView);
      if (storedMonth) setSelectedMonth(Number(storedMonth));
      if (storedYear) setSelectedYear(Number(storedYear));
      
      setIsInitialized(true);
    }
  }, []);

  // 🚀 FIX 2: Save to LocalStorage whenever filters change
  useEffect(() => {
    if (isInitialized && typeof window !== "undefined") {
      localStorage.setItem("dashboard_filterView", filterView);
      localStorage.setItem("dashboard_selectedMonth", selectedMonth.toString());
      localStorage.setItem("dashboard_selectedYear", selectedYear.toString());
    }
  }, [filterView, selectedMonth, selectedYear, isInitialized]);

  // Data Fetching Logic
  const fetchData = async () => {
    setLoading(true);
    // 🚀 FIX 3: Clear old data immediately to prevent flashing ghost data
    setAssociates([]); 
    
    try {
      let endpoint = "";

      // Role-Based Dynamic Routing
      if (isSuperAdmin) {
        if (filterView === "sales") endpoint = "/api/admin/sales-admin-roster";
        else if (filterView === "doctor") endpoint = "/api/admin/doctor-admin-roster";
        else endpoint = "/api/admin/super-admin-roster";
      } else if (session?.user?.role === "sales" && session?.user?.department === "admin") {
        endpoint = "/api/admin/sales-admin-roster";
      } else if (session?.user?.role === "doctor" && session?.user?.department === "admin") {
        endpoint = "/api/admin/doctor-admin-roster";
      }

      if (!endpoint) {
        setLoading(false);
        return;
      }

      const res = await fetch(`${endpoint}?month=${selectedMonth}&year=${selectedYear}`);
      const data = await res.json();

      if (data.success) {
        setAssociates(data.roster || []);
        setAnalytics(data.analytics || {
          totalLeads: 0, totalPending: 0, totalFollowUp: 0, totalAchieved: 0, totalTarget: 0,
        });
      } else {
        console.error("API Error Response:", data.error);
        toast.error(data.error || "Failed to load dashboard metrics.");
      }
    } catch (err) {
      console.error("Dashboard Data Error:", err);
      toast.error("Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  // 🚀 FIX 4: Refetch data only after initialization is complete
  useEffect(() => {
    if (isAuthorized && isInitialized) {
      fetchData();
    }
  }, [isAuthorized, selectedMonth, selectedYear, filterView, isInitialized]);

  // --- Sorting & Filtering Logic ---
  const processedRoster = useMemo(() => {
    let result = [...associates];

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(lower) ||
          a.branch.toLowerCase().includes(lower),
      );
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key])
          return sortConfig.direction === "asc" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key])
          return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [associates, searchQuery, sortConfig]);

  const handleSort = (key) => {
    let direction = "desc";
    if (sortConfig.key === key && sortConfig.direction === "desc") direction = "asc";
    setSortConfig({ key, direction });
  };

  // --- Handlers ---
  const saveEdit = async (id) => {
    const associate = associates.find((a) => a.id === id);
    if (!associate) return;

    setAssociates((prev) =>
      prev.map((a) => (a.id === id ? { ...a, target: Number(tempTarget) } : a)),
    );
    setEditingId(null);

    try {
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: id,
          target: tempTarget,
          leads: associate.totalLeads,
          achieved: associate.achievedCount,
        }),
      });
      toast.success("Target updated successfully");
    } catch (error) {
      toast.error("Failed to update target");
    }
  };

  const startEdit = (associate) => {
    setEditingId(associate.id);
    setTempTarget(associate.target);
  };

  // --- Render Gates ---
  if (status === "loading" || !isInitialized || (!isAuthorized && status !== "unauthenticated")) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm">
        <Loader2 className="animate-spin mr-2" size={20} /> Verifying Access & Preferences...
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex h-[100dvh] bg-slate-50 overflow-hidden relative">
        <Sidebar
          role={session?.user?.role}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />
        <div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center">
          <ShieldAlert size={80} className="text-rose-400 mb-6" />
          <h2 className="text-3xl font-extrabold text-slate-800">Clearance Required</h2>
          <p className="text-slate-500 mt-2 font-medium">
            This command center is restricted to administrative personnel.
          </p>
        </div>
      </div>
    );
  }

  const companyProgress =
    analytics.totalTarget > 0
      ? Math.min(100, Math.round((analytics.totalAchieved / analytics.totalTarget) * 100))
      : 0;
  const companyConversion =
    analytics.totalLeads > 0
      ? Math.round((analytics.totalAchieved / analytics.totalLeads) * 100)
      : 0;

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const years = [2024, 2025, 2026];

  return (
    <div className="flex h-[100dvh] bg-[#f8fafc] font-sans overflow-hidden">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {/* --- HEADER --- */}
        <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 shadow-sm gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <Shield className="text-[#00a884]" size={24} />{" "}
                {filterView === "sales"
                  ? "Sales Overview"
                  : filterView === "doctor"
                    ? "Doctor Overview"
                    : "Global Overview"}
              </h1>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5 ml-1">
                Command Center
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
            {/* Segmented Control - Super Admin Only */}
            {isSuperAdmin && (
              <div className="hidden lg:flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
                <button
                  onClick={() => setFilterView("all")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filterView === "all" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Global
                </button>
                <button
                  onClick={() => setFilterView("sales")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filterView === "sales" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Sales HQ
                </button>
                <button
                  onClick={() => setFilterView("doctor")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${filterView === "doctor" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Medical
                </button>
              </div>
            )}

            <Link
              href="/crm/admin/reports"
              className="hidden sm:flex items-center gap-2 text-slate-600 hover:text-[#00a884] font-bold text-sm bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 hover:border-[#00a884]/30 transition-all shadow-sm group"
            >
              <Briefcase size={16} /> Reports{" "}
              <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>

            {/* Time Intelligence Filter */}
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
              <Calendar size={16} className="text-slate-400 ml-2" />
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer py-1 pl-1 pr-2"
              >
                {months.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <div className="w-px h-4 bg-slate-300"></div>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer py-1 pl-2 pr-1"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </header>

        {/* --- SCROLLABLE CONTENT --- */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-[1400px] mx-auto space-y-6 md:space-y-8">
            {/* Mobile Filter Pill */}
            {isSuperAdmin && (
              <div className="lg:hidden flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner w-full">
                <button
                  onClick={() => setFilterView("all")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filterView === "all" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Global
                </button>
                <button
                  onClick={() => setFilterView("sales")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filterView === "sales" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Sales
                </button>
                <button
                  onClick={() => setFilterView("doctor")}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${filterView === "doctor" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Medical
                </button>
              </div>
            )}

            {/* 1. Global Performance Hero */}
            <div className="bg-slate-900 rounded-[2rem] shadow-xl p-8 md:p-10 text-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-96 h-96 bg-[#00a884] rounded-full mix-blend-screen filter blur-[100px] opacity-20 animate-pulse group-hover:opacity-30 transition-opacity duration-1000"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-10"></div>

              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                  <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full mb-4">
                    <span className="w-2 h-2 rounded-full bg-[#00a884] animate-pulse"></span>
                    <span className="text-xs font-bold uppercase tracking-widest text-emerald-50">
                      {months[selectedMonth - 1]} {selectedYear} Performance
                    </span>
                  </div>
                  <h2 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-2">
                    Team Goal Attainment
                  </h2>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl md:text-6xl font-extrabold text-white tracking-tight">
                      <AnimatedCount end={analytics.totalAchieved} />
                    </span>
                    <span className="text-xl md:text-2xl text-slate-500 font-medium">
                      / {analytics.totalTarget} Target
                    </span>
                  </div>
                </div>

                <div className="flex gap-8">
                  <div className="flex flex-col items-start md:items-end">
                    <div className="flex items-center gap-2 text-emerald-400 mb-1">
                      <TrendingUp size={28} />
                      <span className="text-4xl font-extrabold tracking-tight">
                        <AnimatedCount end={companyProgress} />%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Target Progress</p>
                  </div>
                  <div className="w-px h-16 bg-white/10 hidden md:block"></div>
                  <div className="flex flex-col items-start md:items-end">
                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                      <CheckCircle size={28} />
                      <span className="text-4xl font-extrabold tracking-tight">
                        <AnimatedCount end={companyConversion} />%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Conversion Rate</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. KPI Widgets */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
              <KPICard title="Total Leads" value={analytics.totalLeads} icon={<Headset size={20} />} color="blue" sub="Acquired this month" loading={loading} />
              <KPICard title="Pending Action" value={analytics.totalPending} icon={<Clock size={20} />} color="rose" sub="Overdue > 48 hours" alert={analytics.totalPending > 0} loading={loading} />
              <KPICard title="Active Pipeline" value={analytics.totalFollowUp} icon={<Filter size={20} />} color="amber" sub="Healthy follow-ups" loading={loading} />
              <KPICard title="Successfully Converted" value={analytics.totalAchieved} icon={<CheckCircle size={20} />} color="emerald" sub="Deals closed this month" loading={loading} />
            </div>

            {/* 3. Associate Performance Matrix */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 rounded-t-2xl">
                <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                  <Users size={18} className="text-[#00a884]" /> Performance Matrix
                </h3>
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search associate or branch..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("name")}>
                        <div className="flex items-center gap-1">Associate Identity <ArrowUpDown size={12} /></div>
                      </th>
                      <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("branch")}>
                        <div className="flex items-center gap-1">Branch <ArrowUpDown size={12} /></div>
                      </th>
                      <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("pendingCount")}>
                        <div className="flex items-center justify-center gap-1">Pending <ArrowUpDown size={12} /></div>
                      </th>
                      <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("followUpCount")}>
                        <div className="flex items-center justify-center gap-1">Active Pipeline <ArrowUpDown size={12} /></div>
                      </th>
                      <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("achievedCount")}>
                        <div className="flex items-center justify-center gap-1 text-[#00a884]">Converted <ArrowUpDown size={12} /></div>
                      </th>

                      <th className="px-6 py-4 text-center">Monthly Target</th>
                      <th className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort("progress")}>
                        <div className="flex items-center justify-center gap-1">Progress <ArrowUpDown size={12} /></div>
                      </th>
                      <th className="px-6 py-4 text-right">Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan="9" className="px-6 py-5">
                            <div className="w-full h-8 bg-slate-100 rounded-lg animate-pulse"></div>
                          </td>
                        </tr>
                      ))
                    ) : processedRoster.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-8 text-center text-slate-500 font-bold">
                          No associates match criteria.
                        </td>
                      </tr>
                    ) : (
                      processedRoster.map((associate) => {
                        const isTopPerformer = associate.progress >= 100 && associate.target > 0;
                        const isCritical = associate.pendingCount > 10;

                        return (
                          <tr key={associate.id} className={`hover:bg-slate-50/80 transition-colors group ${isTopPerformer ? "bg-emerald-50/20" : ""}`}>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm shrink-0 border ${isTopPerformer ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 border-slate-200"}`}>
                                  {associate.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                    {associate.name}
                                    {isTopPerformer && <CheckCircle size={12} className="text-[#00a884]" />}
                                  </div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                                    {associate.department} / {associate.role.replace("_", " ")}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider">
                                {associate.branch}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`font-bold px-2 py-1 rounded-md ${isCritical ? "bg-rose-100 text-rose-700" : "text-slate-600"}`}>
                                {associate.pendingCount}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-600">
                              {associate.followUpCount}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-extrabold text-xs border border-emerald-200 shadow-sm">
                                {associate.achievedCount}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-center">
                              {editingId === associate.id ? (
                                <input
                                  type="number"
                                  value={tempTarget}
                                  onChange={(e) => setTempTarget(e.target.value)}
                                  className="w-20 border border-[#00a884] rounded-lg px-2 py-1.5 text-center focus:ring-2 focus:ring-[#00a884]/20 outline-none text-sm font-bold bg-white shadow-sm"
                                  autoFocus
                                />
                              ) : (
                                <span className="font-bold text-slate-700">{associate.target}</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col items-center gap-1.5">
                                <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                                  <div
                                    className={`h-full rounded-full transition-all duration-1000 ${isTopPerformer ? "bg-[#00a884]" : "bg-blue-500"}`}
                                    style={{ width: `${Math.min(associate.progress, 100)}%` }}
                                  ></div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500">{associate.progress}%</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              {editingId === associate.id ? (
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => saveEdit(associate.id)} className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition shadow-sm">
                                    <Save size={14} />
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition shadow-sm">
                                    <XCircle size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => startEdit(associate)}
                                  className="p-2 text-slate-900  hover:text-[#00a884] hover:bg-emerald-50 rounded-lg transition-all opacity-50 group-hover:opacity-100 focus:opacity-100"
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}

// --- Sub Component: KPI Card ---
const KPICard = ({ title, value, icon, color, sub, alert, loading }) => {
  const styles = {
    rose: "from-rose-100/50 text-rose-600 border-rose-200",
    amber: "from-amber-100/50 text-amber-600 border-amber-200",
    emerald: "from-emerald-100/50 text-emerald-600 border-emerald-200",
    blue: "from-blue-100/50 text-blue-600 border-blue-200",
  };

  return (
    <div className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden transition-all hover:shadow-md hover:border-${color}-300 group ${alert ? "ring-1 ring-rose-400" : ""}`}>
      <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${styles[color].split(" ")[0]} to-transparent opacity-50 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-125`}></div>
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">{title}</h3>
          {loading ? (
            <div className="w-16 h-8 bg-slate-100 rounded-lg animate-pulse my-1"></div>
          ) : (
            <span className="text-3xl font-extrabold text-slate-800 tracking-tight">
              <AnimatedCount end={value} />
            </span>
          )}
          <p className={`text-[10px] font-bold mt-2 uppercase tracking-wider ${alert ? "text-rose-500 animate-pulse" : "text-slate-400"}`}>
            {sub}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 border ${styles[color].split(" ").slice(1).join(" ")}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};