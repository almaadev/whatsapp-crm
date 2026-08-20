"use client";

import { useSession } from "next-auth/react";
import DashboardPage from "@/shared/components/layout/DashboardPage";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import KPICard from "@/shared/components/ui/KpiCard";
import { AnimatedCount } from "@/shared/hooks/useCountUp";
import { useAuth } from "@/shared/hooks/useAuth";
import { useDashboardState } from "@/features/admin/hooks/useDashboardState";
import DashboardTabs from "@/shared/components/ui/DashboardTabs";

import {
  Users,
  TrendingUp,
  Edit2,
  Save,
  XCircle,
  Shield,
  Filter,
  Headset,
  Clock,
  CheckCircle,
  Calendar,
  Search,
  ArrowUpDown,
  Building,
} from "lucide-react";

import { usePresenceStore } from "@/features/presence/stores/presenceStore";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const { user, isLoading, isAdmin, isSuperAdmin: isSuperAdminUser } = useAuth();

  const isAuthorized = isAdmin;

  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);

  const { state, setters, derived, actions } = useDashboardState(
    user ? { user } : session,
    isAuthorized,
    isSuperAdminUser,
  );

  // --- Render Gates ---
  if (
    status === "loading" ||
    isLoading ||
    !state.isInitialized ||
    (!isAuthorized && status !== "unauthenticated")
  ) {
    return <LoadingScreen message="Verifying Access & Preferences..." />;
  }

  if (!isAuthorized) {
    return (
      <AccessDenied
        title="Clearance Required"
        message="This command center is restricted to administrative personnel."
      />
    );
  }

  const companyProgress =
    state.analytics.totalTarget > 0
      ? Math.min(
          100,
          Math.round(
            (state.analytics.totalAchieved / state.analytics.totalTarget) * 100,
          ),
        )
      : 0;
  const companyConversion =
    state.analytics.totalLeads > 0
      ? Math.round(
          (state.analytics.totalAchieved / state.analytics.totalLeads) * 100,
        )
      : 0;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const years = [2024, 2025, 2026];

  return (
    <DashboardPage
      title={
        state.filterView === "sales"
          ? "Sales Overview"
          : state.filterView === "doctor"
            ? "Doctor Overview"
            : "Global Overview"
      }
      subtitle="Administrative monitoring and performance dashboard for all associates and branches."
      icon={Shield}
      headerChildren={
        <>
          {isSuperAdminUser && (
            <div className="hidden lg:flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
              <button
                onClick={() => setters.setFilterView("all")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${state.filterView === "all" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
              >
                Global
              </button>
              <button
                onClick={() => setters.setFilterView("sales")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${state.filterView === "sales" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
              >
                Sales Team
              </button>
              <button
                onClick={() => setters.setFilterView("doctor")}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${state.filterView === "doctor" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
              >
                Doctor Team
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Calendar size={16} className="text-slate-400 ml-2" />
            <select
              value={state.selectedMonth}
              onChange={(e) => setters.setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer py-1 pl-1 pr-2"
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
            <div className="w-px h-4 bg-slate-300"></div>
            <select
              value={state.selectedYear}
              onChange={(e) => setters.setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer py-1 pl-2 pr-1"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {isSuperAdminUser && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 shadow-sm">
              <Building size={16} className="text-slate-400 ml-2" />
              <select
                value={state.selectedBranch}
                onChange={(e) => setters.setSelectedBranch(e.target.value)}
                className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer py-1 pl-1 pr-2 max-w-[150px] truncate"
              >
                <option value="all">All Branches</option>
                {state.branches?.map((b) => (
                  <option key={b.id || b._id} value={b.id || b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      }
    >
      <DashboardTabs activeTab="overview" />

      {/* Mobile Filter Pill */}
      {isSuperAdminUser && (
        <div className="lg:hidden flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner w-full">
          <button
            onClick={() => setters.setFilterView("all")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${state.filterView === "all" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
          >
            Global
          </button>
          <button
            onClick={() => setters.setFilterView("sales")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${state.filterView === "sales" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
          >
            Sales
          </button>
          <button
            onClick={() => setters.setFilterView("doctor")}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${state.filterView === "doctor" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-slate-700"}`}
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
                {months[state.selectedMonth - 1]} {state.selectedYear}{" "}
                Performance
              </span>
            </div>
            <h2 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-2">
              Team Goal Attainment
            </h2>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl md:text-6xl font-extrabold text-white tracking-tight">
                <AnimatedCount end={state.analytics.totalAchieved} />
              </span>
              <span className="text-xl md:text-2xl text-slate-500 font-medium">
                / {state.analytics.totalTarget} Target
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
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                Target Progress
              </p>
            </div>
            <div className="w-px h-16 bg-white/10 hidden md:block"></div>
            <div className="flex flex-col items-start md:items-end">
              <div className="flex items-center gap-2 text-blue-400 mb-1">
                <CheckCircle size={28} />
                <span className="text-4xl font-extrabold tracking-tight">
                  <AnimatedCount end={companyConversion} />%
                </span>
              </div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">
                Conversion Rate
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. KPI Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        <KPICard
          title="Total Leads"
          value={state.analytics.totalLeads}
          icon={<Headset size={20} />}
          color="blue"
          sub="Acquired this month"
          loading={state.loading}
        />
        <KPICard
          title="Pending Action"
          value={state.analytics.totalPending}
          icon={<Clock size={20} />}
          color="rose"
          sub="Overdue > 48 hours"
          alert={state.analytics.totalPending > 0}
          loading={state.loading}
        />
        <KPICard
          title="Active Pipeline"
          value={state.analytics.totalFollowUp}
          icon={<Filter size={20} />}
          color="amber"
          sub="Healthy follow-ups"
          loading={state.loading}
        />
        <KPICard
          title="Successfully Converted"
          value={state.analytics.totalAchieved}
          icon={<CheckCircle size={20} />}
          color="emerald"
          sub="Deals closed this month"
          loading={state.loading}
        />
      </div>

      {/* 3. Associate Performance Matrix */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 rounded-t-2xl">
          <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
            <Users size={18} className="text-[#00a884]" /> Performance Matrix
          </h3>
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search associate or branch..."
              value={state.searchQuery}
              onChange={(e) => setters.setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all shadow-sm"
            />
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
              <tr>
                <th
                  className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => actions.handleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Associate Identity <ArrowUpDown size={12} />
                  </div>
                </th>
                <th
                  className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => actions.handleSort("branch")}
                >
                  <div className="flex items-center gap-1">
                    Branch <ArrowUpDown size={12} />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => actions.handleSort("pendingCount")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Pending <ArrowUpDown size={12} />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => actions.handleSort("followUpCount")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Active Pipeline <ArrowUpDown size={12} />
                  </div>
                </th>
                <th
                  className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => actions.handleSort("achievedCount")}
                >
                  <div className="flex items-center justify-center gap-1 text-[#00a884]">
                    Converted <ArrowUpDown size={12} />
                  </div>
                </th>

                <th className="px-6 py-4 text-center">Monthly Target</th>
                <th
                  className="px-6 py-4 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                  onClick={() => actions.handleSort("progress")}
                >
                  <div className="flex items-center justify-center gap-1">
                    Progress <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="px-6 py-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {state.loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan="9" className="px-6 py-5">
                      <div className="w-full h-8 bg-slate-100 rounded-lg animate-pulse"></div>
                    </td>
                  </tr>
                ))
              ) : derived.processedRoster.length === 0 ? (
                <tr>
                  <td
                    colSpan="9"
                    className="p-8 text-center text-slate-500 font-bold"
                  >
                    No associates match criteria.
                  </td>
                </tr>
              ) : (
                derived.processedRoster.map((associate) => {
                  const isTopPerformer =
                    associate.progress >= 100 && associate.target > 0;
                  const isCritical = associate.pendingCount > 10;
                  const isOnline = onlineUserIds.has(associate.id?.toString());

                  return (
                    <tr
                      key={associate.id}
                      className={`hover:bg-slate-50/80 transition-colors group ${isTopPerformer ? "bg-emerald-50/20" : ""}`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm border ${isTopPerformer ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600 border-slate-200"}`}
                            >
                              {associate.name.charAt(0).toUpperCase()}
                            </div>
                            {isOnline && (
                              <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full ring-2 ring-white bg-emerald-500"></span>
                            )}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                              {associate.name}
                              {isTopPerformer && (
                                <CheckCircle
                                  size={12}
                                  className="text-[#00a884]"
                                />
                              )}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {associate.department} /{" "}
                              {associate.role.replace("_", " ")}
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
                        <span
                          className={`font-bold px-2 py-1 rounded-md ${isCritical ? "bg-rose-100 text-rose-700" : "text-slate-600"}`}
                        >
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
                        {state.editingId === associate.id ? (
                          <input
                            type="number"
                            value={state.tempTarget}
                            onChange={(e) =>
                              setters.setTempTarget(e.target.value)
                            }
                            className="w-20 border border-[#00a884] rounded-lg px-2 py-1.5 text-center focus:ring-2 focus:ring-[#00a884]/20 outline-none text-sm font-bold bg-white shadow-sm"
                            autoFocus
                          />
                        ) : (
                          <span className="font-bold text-slate-700">
                            {associate.target}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full rounded-full transition-all duration-1000 ${isTopPerformer ? "bg-[#00a884]" : "bg-blue-500"}`}
                              style={{
                                width: `${Math.min(associate.progress, 100)}%`,
                              }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-bold text-slate-500">
                            {associate.progress}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {state.editingId === associate.id ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => actions.saveEdit(associate.id)}
                              className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition shadow-sm"
                            >
                              <Save size={14} />
                            </button>
                            <button
                              onClick={() => setters.setEditingId(null)}
                              className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition shadow-sm"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => actions.startEdit(associate)}
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
    </DashboardPage>
  );
}
