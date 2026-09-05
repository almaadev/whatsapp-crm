"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import { useSession } from "next-auth/react";
import { useAuth } from "@/shared/hooks/useAuth";

import DashboardPage from "@/shared/components/layout/DashboardPage";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import DashboardTabs from "@/shared/components/ui/DashboardTabs";
import { connectSocket } from "@/features/chat/services/socketService";
import { branchService } from "@/features/branches/services/branchService";
import { usePerformanceMonitorStore } from "@/features/admin/stores/performanceMonitorStore";
import { usePresenceStore } from "@/features/presence/stores/presenceStore";
import { toast } from "react-toastify";

import {
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  Activity,
  Building2,
  Filter,
  Calendar,
  Search,
  Award,
  ListTodo,
  ArrowUpDown,
  UserCheck,
  Download,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  
} from "lucide-react";

export default function PerformanceMonitor() {
  const { data: session, status } = useSession();
  const {
    user,
    isLoading,
    isAdmin,
    isSuperAdmin: isSuperAdminUser,
  } = useAuth();
  const isAuthorized = isAdmin;

  const {
    filters,
    analyticsData,
    isLoading: isStoreLoading,
    setFilter,
    fetchAnalytics,
    refresh,
  } = usePerformanceMonitorStore();

  const onlineUserIds = usePresenceStore((state) => state.onlineUserIds);
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);

  const [availableBranches, setAvailableBranches] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState("associateName");
  const [sortOrder, setSortOrder] = useState("asc");
  const [activeTab, setActiveTab] = useState("overview");

  // Expandable associate row tracking and lazy-loaded history cache
  const [expandedAssociates, setExpandedAssociates] = useState({});
  const [historyCache, setHistoryCache] = useState({});
  const [historyLoading, setHistoryLoading] = useState({});

  const toggleAssociateExpand = async (id) => {
    const isNowExpanded = !expandedAssociates[id];
    setExpandedAssociates((prev) => ({
      ...prev,
      [id]: isNowExpanded,
    }));

    // Lazy load timeline history from sub-endpoint
    if (isNowExpanded && !historyCache[id]) {
      setHistoryLoading((prev) => ({ ...prev, [id]: true }));
      try {
        const res = await fetch(
          `/api/admin/performance-monitor?action=associateCustomers&associateId=${id}&dateRange=${filters.dateRange}&startDate=${filters.startDate || ""}&endDate=${filters.endDate || ""}&branchId=${filters.branchId || "all"}`,
        );
        const data = await res.json();
        if (data.success) {
          setHistoryCache((prev) => ({
            ...prev,
            [id]: data.customers,
          }));
        } else {
          toast.error("Failed to load customer history.");
        }
      } catch (err) {
        console.error("Failed loading associate history:", err);
      } finally {
        setHistoryLoading((prev) => ({ ...prev, [id]: false }));
      }
    }
  };

  // Load branches
  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await branchService.getBranches({ limit: 1000 });
        if (res.success) {
          setAvailableBranches(res.branches || []);
        }
      } catch (err) {
        console.error("Failed to load branches:", err);
      }
    }
    if (isAuthorized) {
      loadBranches();
    }
  }, [isAuthorized]);

  // Sync Admin Branch
  useEffect(() => {
    if (user && !isSuperAdminUser && user.branch) {
      setFilter("branchId", user.branch.toString());
    }
  }, [user, isSuperAdminUser, setFilter]);

  // Initial Fetch
  useEffect(() => {
    if (isAuthorized) {
      fetchAnalytics();
    }
  }, [isAuthorized, fetchAnalytics]);

  // Real-time socket sync
  useEffect(() => {
    if (!isAuthorized) return;
    const socket = connectSocket();

    const handleRealTimeUpdate = () => {
      refresh();
    };

    socket.on("new_message", handleRealTimeUpdate);
    socket.on("customer_updated", handleRealTimeUpdate);
    socket.on("chat_lock_updated", handleRealTimeUpdate);
    socket.on("customer_branch_updated", handleRealTimeUpdate);
    socket.on("lead_status_changed", handleRealTimeUpdate);
    socket.on("lead_status_update", handleRealTimeUpdate);
    socket.on("followup_added", handleRealTimeUpdate);
    socket.on("performance_monitor_event", handleRealTimeUpdate);
    socket.on("presence_change", handleRealTimeUpdate);

    return () => {
      socket.off("new_message", handleRealTimeUpdate);
      socket.off("customer_updated", handleRealTimeUpdate);
      socket.off("chat_lock_updated", handleRealTimeUpdate);
      socket.off("customer_branch_updated", handleRealTimeUpdate);
      socket.off("lead_status_changed", handleRealTimeUpdate);
      socket.off("lead_status_update", handleRealTimeUpdate);
      socket.off("followup_added", handleRealTimeUpdate);
      socket.off("performance_monitor_event", handleRealTimeUpdate);
      socket.off("presence_change", handleRealTimeUpdate);
    };
  }, [isAuthorized, refresh]);

  // Filter & Sort Associates list
  const processedAssociates = useMemo(() => {
    if (!analyticsData?.associateAnalytics) return [];
    let list = [...analyticsData.associateAnalytics];

    // Text search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.associateName.toLowerCase().includes(q) ||
          a.branch.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q),
      );
    }

    // Sort order
    list.sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [analyticsData, searchQuery, sortKey, sortOrder]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  // Exporter tool generating CSV or Excel XML file format
  const handleExport = (moduleName, exportMode, formatType) => {
    try {
      toast.info(`Preparing ${moduleName} ${exportMode} export...`);
      let headers = [];
      let rows = [];
      let filename = `${moduleName}_performance_report_${exportMode}_${new Date().toISOString().split("T")[0]}`;

      if (moduleName === "overview") {
        headers = ["Operational Indicator Metric", "Value"];
        const dataObj = analyticsData?.associateAnalytics || [];
        const online = dataObj.filter((a) => a.status === "Online").length;
        const total = dataObj.length;
        const activeChats = dataObj.reduce(
          (sum, a) => sum + a.currentActiveChatCount,
          0,
        );
        const closed = analyticsData?.leadAnalytics?.closedLeads || 0;
        const pending = dataObj.reduce((sum, a) => sum + a.pendingFollowUps, 0);

        rows = [
          ["Online Associates", `${online} / ${total}`],
          ["Active Chats Count", activeChats],
          ["Conversions Closed", closed],
          ["Pending Follow Ups", pending],
        ];
      } else if (moduleName === "associate") {
        headers = [
          "Associate Name",
          "Branch",
          "Department",
          "Role",
          "Customers Handled Month",
          "New Leads Closed",
          "Existing Leads Closed",
          "Total Closed",
          "Follow Ups",
          "Pending Follow Ups",
          "Not Interested",
          "Average Response Time",
          "Status",
          "Active Chat Locks",
        ];
        const targetList =
          exportMode === "current"
            ? processedAssociates
            : analyticsData?.associateAnalytics || [];
        rows = targetList.map((a) => [
          `"${a.associateName}"`,
          `"${a.branch}"`,
          `"${a.department}"`,
          `"${a.role}"`,
          a.customersHandledMonth,
          a.newLeads,
          a.existingLeads,
          a.closed,
          a.followUps,
          a.pendingFollowUps,
          a.notInterested,
          `"${a.averageResponseTime}"`,
          `"${a.status}"`,
          a.currentActiveChatCount,
        ]);
      } else if (moduleName === "branch") {
        headers = [
          "Branch Name",
          "Total Associates",
          "Online Associates",
          "Customers Received",
          "Customers Assigned",
          "Customers Closed",
          "Pending Follow Ups",
          "Conversion Rate %",
        ];
        const targetList = analyticsData?.branchAnalytics || [];
        rows = targetList.map((b) => [
          `"${b.branchName}"`,
          b.totalAssociates,
          b.onlineAssociates,
          b.customersReceived,
          b.customersAssigned,
          b.customersClosed,
          b.pendingFollowUps,
          `${b.conversionRate}%`,
        ]);
      } else if (moduleName === "lead") {
        headers = ["Lead Pipeline Status Category", "Activity Count"];
        const l = analyticsData?.leadAnalytics || {};
        rows = [
          ["New Leads Closed", l.newLeads || 0],
          ["Existing Leads Closed", l.existingLeads || 0],
          ["Reopened Chats", l.reopenedLeads || 0],
          ["Closed Leads Total", l.closedLeads || 0],
          ["Not Interested Leads", l.notInterested || 0],
          ["Lost Leads Total", l.lostLeads || 0],
        ];
      } else if (moduleName === "leaderboard") {
        headers = [
          "Rank Standings",
          "Associate Name",
          "Role",
          "Branch",
          "Performance Score (pts)",
          "Closed Deals Count",
          "Follow Ups Count",
          "Customers Handled",
        ];
        const targetList = analyticsData?.topPerformers || [];
        rows = targetList.map((p, idx) => [
          idx + 1,
          `"${p.associateName}"`,
          `"${p.role}"`,
          `"${p.branch}"`,
          p.score,
          p.closed,
          p.followUps,
          p.customersHandledMonth,
        ]);
      }

      if (formatType === "csv") {
        const csvContent = [
          headers.join(","),
          ...rows.map((r) => r.join(",")),
        ].join("\n");
        const blob = new Blob([csvContent], {
          type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const rowsHTML = rows.map(
          (row) => `
          <tr>
            ${row.map((val) => `<td>${String(val).replace(/"/g, "")}</td>`).join("")}
          </tr>
        `,
        );
        const excelContent = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
          <body>
            <h2>${moduleName.toUpperCase()} Workspace Export</h2>
            <table border="1">
              <thead>
                <tr style="background-color: #0f172a; color: white; font-weight: bold;">
                  ${headers.map((h) => `<th>${h}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${rowsHTML.join("")}
              </tbody>
            </table>
          </body>
          </html>
        `;
        const blob = new Blob([excelContent], {
          type: "application/vnd.ms-excel",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `${filename}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      toast.success(`Export successful for ${moduleName}!`);
    } catch (err) {
      console.error("Export failure:", err);
      toast.error("Failed to generate export file.");
    }
  };

  // Derived dashboard variables
  const computedStats = useMemo(() => {
    const associates = analyticsData?.associateAnalytics || [];
    const online = associates.filter((a) => a.status === "Online").length;
    const busy = associates.filter((a) => a.currentActiveChatCount > 0).length;
    const closed = analyticsData?.leadAnalytics?.closedLeads || 0;
    const pending = associates.reduce((sum, a) => sum + a.pendingFollowUps, 0);

    const totalResponseWeight = associates.reduce(
      (sum, a) => sum + a.avgResponseSeconds * a.followUps,
      0,
    );
    const totalResponseCount = associates.reduce(
      (sum, a) => sum + (a.avgResponseSeconds > 0 ? a.followUps : 0),
      0,
    );
    const avgResponseSeconds =
      totalResponseCount > 0
        ? Math.round(totalResponseWeight / totalResponseCount)
        : 0;
    let averageResponseTime = "--";
    if (avgResponseSeconds > 0) {
      const m = Math.floor(avgResponseSeconds / 60);
      const s = avgResponseSeconds % 60;
      averageResponseTime = m > 0 ? `${m}m ${s}s` : `${s}s`;
    }

    const conversionRate =
      analyticsData?.branchAnalytics?.[0]?.conversionRate || 0;

    return {
      online,
      busy,
      closed,
      pending,
      averageResponseTime,
      conversionRate,
    };
  }, [analyticsData]);

  // Roster options
  const associatesOptions = useMemo(() => {
    if (!analyticsData?.associateAnalytics) return [];
    return analyticsData.associateAnalytics.map((a) => ({
      id: a.associateId,
      name: a.associateName,
    }));
  }, [analyticsData]);

  if (status === "loading" || isLoading) {
    return <LoadingScreen message="Loading Performance Monitor..." />;
  }

  if (!isAuthorized) {
    return (
      <AccessDenied
        title="Clearance Required"
        message="Only management can access the Performance Monitor."
      />
    );
  }

  const deptOptions = ["Telecalling", "Support", "Admin"];
  const roleOptions = ["Doctor", "Sales", "SuperAdmin"];

  const tabOptions = [
    { id: "overview", label: "Overview", icon: TrendingUp },
    { id: "associate", label: "Associate Analytics", icon: Users },
    { id: "branch", label: "Branch Analytics", icon: Building2 },
    { id: "lead", label: "Lead Analytics", icon: ListTodo },
    { id: "leaderboard", label: "Leaderboard", icon: Award },
  ];

  return (
    <DashboardPage
      title="Performance Monitor"
      subtitle="Enterprise Operations Dashboard & Associate Productivity Control Room"
      icon={TrendingUp}
    >
      <DashboardTabs activeTab="performance" />

      {/* Main Container */}
      <div className="max-w-[1800px] mx-auto py-4 px-6 space-y-4 select-none relative flex flex-col h-[calc(100vh-140px)] overflow-hidden">
        {/* GLOBAL STICKY FILTERS BAR */}
        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex flex-wrap gap-3 items-center justify-between sticky top-0 z-20">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Date Preset */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs font-semibold">
              <Calendar size={13} className="text-slate-400" />
              <select
                value={filters.dateRange}
                onChange={(e) => setFilter("dateRange", e.target.value)}
                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-xs"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="thisWeek">This Week</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="custom">Custom Date</option>
              </select>
            </div>

            {/* Custom Dates */}
            {filters.dateRange === "custom" && (
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilter("startDate", e.target.value)}
                  className="bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs font-bold outline-none"
                />
                <span className="text-slate-400 text-xs">to</span>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilter("endDate", e.target.value)}
                  className="bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs font-bold outline-none"
                />
              </div>
            )}

            {/* Branch (Super Admin only) */}
            {isSuperAdminUser ? (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs font-semibold">
                <Building2 size={13} className="text-slate-400" />
                <select
                  value={filters.branchId}
                  onChange={(e) => setFilter("branchId", e.target.value)}
                  className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer max-w-[120px] text-xs"
                >
                  <option value="all">All Branches</option>
                  {availableBranches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wider">
                Branch: {user?.branchName || "My Branch"}
              </div>
            )}

            {/* Department */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs font-semibold">
              <Filter size={13} className="text-slate-400" />
              <select
                value={filters.department}
                onChange={(e) => setFilter("department", e.target.value)}
                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-xs"
              >
                <option value="all">All Departments</option>
                {deptOptions.map((dept) => (
                  <option key={dept} value={dept.toLowerCase()}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Role */}
            {session?.user?.role === "superAdmin" ? (
              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs font-semibold">
                <ShieldCheck size={13} className="text-slate-400" />

                <select
                  value={filters.role}
                  onChange={(e) => setFilter("role", e.target.value)}
                  className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer max-w-[120px] text-xs"
                >
                  <option value="all">All Roles</option>

                  {roleOptions.map((role) => (
                    <option
                      key={role}
                      value={
                        role === "SuperAdmin"
                          ? "superAdmin"
                          : role.toLowerCase()
                      }
                    >
                      {role === "SuperAdmin" ? "Super Admin" : role}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-slate-100 border border-slate-200 px-2 py-1 rounded-xl text-xs font-bold text-slate-500 uppercase tracking-wider">
                Role:{" "}
                {user?.role === "superAdmin"
                  ? "Super Admin"
                  : user?.role || "My Role"}
              </div>
            )}

            {/* Associate Selector */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs font-semibold">
              <Users size={13} className="text-slate-400" />
              <select
                value={filters.associateId}
                onChange={(e) => setFilter("associateId", e.target.value)}
                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer max-w-[120px] text-xs"
              >
                <option value="all">All Associates</option>
                {associatesOptions.map((assoc) => (
                  <option key={assoc.id} value={assoc.id}>
                    {assoc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Lead Type */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-xl text-xs font-semibold">
              <ListTodo size={13} className="text-slate-400" />
              <select
                value={filters.leadType}
                onChange={(e) => setFilter("leadType", e.target.value)}
                className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-xs"
              >
                <option value="all">All Lead Types</option>
                <option value="direct lead">Direct Lead</option>
              </select>
            </div>
          </div>

          {/* Sync Action */}
          <button
            onClick={refresh}
            disabled={isStoreLoading}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <Activity
              size={11}
              className={isStoreLoading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {/* HORIZONTAL NAVIGATION TABS */}
        <div className="flex border-b border-slate-200">
          {tabOptions.map((t) => {
            const Icon = t.icon;
            const isTabActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-5 py-2.5 border-b-2 font-bold text-xs transition-all cursor-pointer ${
                  isTabActive
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-400 hover:text-slate-600 hover:border-slate-200"
                }`}
              >
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ACTIVE TAB VIEWS (Lazy loaded, scroll protected, high visual density) */}
        <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[calc(100vh-250px)] relative">
          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="p-4 space-y-4 flex flex-col h-full overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                  <TrendingUp size={16} className="text-[#00a884]" /> Quick Performance Snapshot
                </h3>
              </div>

              {/* 1. TOP KPI CARDS GRID */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-emerald-50 text-[#00a884] rounded-lg">
                    <UserCheck size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Online Staff
                    </p>
                    <h4 className="text-lg font-black text-slate-800">
                      {onlineUsers.length}
                    </h4>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Activity size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Busy Staff
                    </p>
                    <h4 className="text-lg font-black text-slate-800">
                      {computedStats.busy}
                    </h4>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <CheckCircle size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Closed Today
                    </p>
                    <h4 className="text-lg font-black text-slate-800">
                      {analyticsData?.leadAnalytics?.closedLeads || 0}
                    </h4>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Pending Follow Ups
                    </p>
                    <h4 className="text-lg font-black text-slate-800">
                      {computedStats.pending}
                    </h4>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Clock size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Avg Response
                    </p>
                    <h4 className="text-lg font-black text-slate-800">
                      {computedStats.averageResponseTime}
                    </h4>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Conversion Rate
                    </p>
                    <h4 className="text-lg font-black text-slate-800">
                      {computedStats.conversionRate}%
                    </h4>
                  </div>
                </div>
              </div>

              {/* 2. MIDDLE SNAPSHOT & TRENDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Top Performing Branch
                  </span>
                  <div className="flex items-center justify-between mt-2">
                    <h3 className="text-base font-extrabold text-slate-800">
                      {analyticsData?.branchAnalytics?.sort(
                        (a, b) => b.conversionRate - a.conversionRate,
                      )?.[0]?.branchName || "-"}
                    </h3>
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold">
                      {analyticsData?.branchAnalytics?.sort(
                        (a, b) => b.conversionRate - a.conversionRate,
                      )?.[0]?.conversionRate || 0}
                      % Conv
                    </span>
                  </div>
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Top Performing Associate
                  </span>
                  <div className="flex items-center justify-between mt-2">
                    <h3 className="text-base font-extrabold text-slate-800">
                      {analyticsData?.topPerformers?.[0]?.associateName || "-"}
                    </h3>
                    <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold">
                      {analyticsData?.topPerformers?.[0]?.score || 0} pts
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. BOTTOM COMPACT SVG CHARTS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SVG Chart 1: Conversions progress by Branch */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Branch Conversions
                  </h4>
                  <div className="space-y-2">
                    {analyticsData?.branchAnalytics?.map((b) => (
                      <div key={b.branchName} className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold">
                          <span>{b.branchName}</span>
                          <span>{b.customersClosed} Closed</span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-[#00a884] h-full transition-all"
                            style={{
                              width: `${Math.min(b.conversionRate, 100)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lead Pipeline Totals */}
                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Lead Funnel Distribution
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">New Leads</span>
                      <span className="font-bold text-slate-800">
                        {analyticsData?.leadAnalytics?.newLeads || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">Existing Leads</span>
                      <span className="font-bold text-slate-800">
                        {analyticsData?.leadAnalytics?.existingLeads || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">Follow Ups</span>
                      <span className="font-bold text-slate-800">
                        {analyticsData?.leadAnalytics?.followUps || 0}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-400">Closed Leads</span>
                      <span className="font-bold text-[#00a884]">
                        {analyticsData?.leadAnalytics?.closedLeads || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ASSOCIATE ANALYTICS */}
          {activeTab === "associate" && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
                <div className="relative w-64">
                  <Search
                    size={11}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search associate name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-[#00a884]"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExport("associate", "current", "csv")}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg flex items-center gap-1 border border-slate-200 cursor-pointer"
                  >
                    <Download size={9} /> CSV
                  </button>
                  <button
                    onClick={() =>
                      handleExport("associate", "current", "excel")
                    }
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg flex items-center gap-1 border border-slate-200 cursor-pointer"
                  >
                    <Download size={9} /> Excel
                  </button>
                  <div className="w-px h-3.5 bg-slate-350 mx-1"></div>
                  <button
                    onClick={() => handleExport("associate", "all", "csv")}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    Export All CSV
                  </button>
                  <button
                    onClick={() => handleExport("associate", "all", "excel")}
                    className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-[10px] rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    Export All Excel
                  </button>
                </div>
              </div>

              {/* Associate grid table view */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 text-[9px] uppercase font-bold tracking-wider border-b border-slate-200 sticky top-0 z-10 select-none">
                    <tr>
                      <th className="w-6 px-3"></th>
                      <th
                        onClick={() => handleSort("associateName")}
                        className="px-4 py-2.5 cursor-pointer hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-center gap-1">
                          Associate <ArrowUpDown size={8} />
                        </div>
                      </th>
                      <th className="px-4 py-2.5">Branch</th>
                      <th className="px-4 py-2.5">Role / Dept</th>
                      <th className="px-4 py-2.5 text-center">Handled Month</th>
                      <th className="px-4 py-2.5 text-center">New Closed</th>
                      <th className="px-4 py-2.5 text-center">Exist Closed</th>
                      <th className="px-4 py-2.5 text-center text-[#00a884]">
                        Closed
                      </th>
                      <th className="px-4 py-2.5 text-center">Follow Ups</th>
                      <th className="px-4 py-2.5 text-center text-rose-600">
                        Pending
                      </th>
                      <th className="px-4 py-2.5 text-center">Avg Resp</th>
                      <th className="px-4 py-2.5 text-center">Status</th>
                      <th className="px-4 py-2.5 text-right">Locked Chats</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {isStoreLoading ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i}>
                          <td colSpan="13" className="p-3">
                            <div className="w-full h-6 bg-slate-100 rounded-lg animate-pulse"></div>
                          </td>
                        </tr>
                      ))
                    ) : processedAssociates.length === 0 ? (
                      <tr>
                        <td
                          colSpan="13"
                          className="p-5 text-center text-slate-400 font-bold"
                        >
                          No associates matched current criteria.
                        </td>
                      </tr>
                    ) : (
                      processedAssociates.map((assoc) => {
                        const isExpanded =
                          !!expandedAssociates[assoc.associateId];
                        const historyData =
                          historyCache[assoc.associateId] || [];
                        const isHistoryLoading =
                          !!historyLoading[assoc.associateId];
                        const isOnline = onlineUserIds.has(
                          assoc.associateId?.toString(),
                        );

                        return (
                          <Fragment key={assoc.associateId}>
                            <tr
                              className="hover:bg-slate-50 transition-colors cursor-pointer"
                              onClick={() =>
                                toggleAssociateExpand(assoc.associateId)
                              }
                            >
                              <td className="px-3 py-2.5 text-center text-slate-400">
                                {isExpanded ? (
                                  <ChevronUp size={12} />
                                ) : (
                                  <ChevronDown size={12} />
                                )}
                              </td>
                              <td className="px-4 py-2.5 font-bold text-slate-800">
                                {assoc.associateName}
                              </td>
                              <td className="px-4 py-2.5 text-slate-600">
                                {assoc.branch}
                              </td>
                              <td className="px-4 py-2.5 text-slate-400 uppercase text-[9px] font-semibold">
                                {assoc.role} / {assoc.department}
                              </td>
                              <td className="px-4 py-2.5 text-center font-semibold text-slate-600">
                                {assoc.customersHandledMonth}
                              </td>
                              <td className="px-4 py-2.5 text-center text-slate-600">
                                {assoc.newLeads}
                              </td>
                              <td className="px-4 py-2.5 text-center text-slate-600">
                                {assoc.existingLeads}
                              </td>
                              <td className="px-4 py-2.5 text-center font-extrabold text-[#00a884]">
                                {assoc.closed}
                              </td>
                              <td className="px-4 py-2.5 text-center text-slate-600">
                                {assoc.followUps}
                              </td>
                              <td className="px-4 py-2.5 text-center font-bold text-rose-600">
                                {assoc.pendingFollowUps}
                              </td>
                              <td className="px-4 py-2.5 text-center text-slate-600">
                                {assoc.averageResponseTime}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${isOnline ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500"}`}
                                >
                                  {isOnline ? "Online" : "Offline"}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-right font-bold text-slate-700">
                                {assoc.currentActiveChatCount} locked
                              </td>
                            </tr>

                            {/* Expandable sub-row containing lazy loaded customer list */}
                            {isExpanded && (
                              <tr className="bg-slate-50/50">
                                <td colSpan="13" className="px-5 py-3">
                                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2">
                                    <h5 className="font-extrabold text-slate-800 flex items-center gap-1.5 text-xs pb-1 border-b border-slate-100">
                                      <Users
                                        size={12}
                                        className="text-[#00a884]"
                                      />{" "}
                                      Managed Customers & Handled History
                                    </h5>

                                    {isHistoryLoading ? (
                                      <div className="flex items-center justify-center py-4 text-slate-400 text-xs font-semibold">
                                        <Activity
                                          className="animate-spin mr-1.5"
                                          size={12}
                                        />{" "}
                                        Loading customer history...
                                      </div>
                                    ) : historyData.length === 0 ? (
                                      <p className="text-xs text-slate-400 text-center py-4 font-bold">
                                        No handled customer timeline logs.
                                      </p>
                                    ) : (
                                      <div className="overflow-x-auto max-h-48">
                                        <table className="w-full text-left border-collapse text-[10px]">
                                          <thead className="bg-slate-50 text-slate-500 uppercase text-[8px] font-bold tracking-wider sticky top-0 z-10 select-none border-b border-slate-200">
                                            <tr>
                                              <th className="px-3 py-2">
                                                Customer Name
                                              </th>
                                              <th className="px-3 py-2">
                                                Phone
                                              </th>
                                              <th className="px-3 py-2">
                                                Enquired For
                                              </th>
                                              <th className="px-3 py-2">
                                                Current Status
                                              </th>
                                              <th className="px-3 py-2">
                                                Activity Type
                                              </th>
                                              <th className="px-3 py-2 text-center">
                                                Handled Date & Time
                                              </th>
                                              <th className="px-3 py-2">
                                                Handled By
                                              </th>
                                              <th className="px-3 py-2">
                                                Branch
                                              </th>
                                              <th className="px-3 py-2">
                                                Remark
                                              </th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-slate-100">
                                            {historyData.map((row, index) => (
                                              <tr
                                                key={index}
                                                className="hover:bg-slate-50"
                                              >
                                                <td className="px-3 py-2 font-bold text-slate-800">
                                                  {row.customerName}
                                                </td>
                                                <td className="px-3 py-2 text-slate-500">
                                                  {row.phone}
                                                </td>
                                                <td className="px-3 py-2 text-slate-500">
                                                  {row.enquiredFor}
                                                </td>
                                                <td className="px-3 py-2">
                                                  <span
                                                    className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${row.currentStatus === "Closed" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600"}`}
                                                  >
                                                    {row.currentStatus}
                                                  </span>
                                                </td>
                                                <td className="px-3 py-2 font-semibold text-slate-700">
                                                  {row.activityType}
                                                </td>
                                                <td className="px-3 py-2 text-center text-slate-400">
                                                  {new Date(
                                                    row.handledAt,
                                                  ).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-slate-600">
                                                  {row.handledBy}
                                                </td>
                                                <td className="px-3 py-2 text-slate-500">
                                                  {row.branch}
                                                </td>
                                                <td
                                                  className="px-3 py-2 text-slate-400 max-w-xs truncate"
                                                  title={row.remark}
                                                >
                                                  {row.remark}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: BRANCH ANALYTICS */}
          {activeTab === "branch" && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
                <span className="text-xs font-bold text-slate-500">
                  Branch Performance Overview
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExport("branch", "current", "csv")}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg flex items-center gap-1 border border-slate-200 cursor-pointer"
                  >
                    <Download size={9} /> CSV
                  </button>
                  <button
                    onClick={() => handleExport("branch", "current", "excel")}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-lg flex items-center gap-1 border border-slate-200 cursor-pointer"
                  >
                    <Download size={9} /> Excel
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 text-[9px] uppercase font-bold tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-2.5">Branch Name</th>
                      <th className="px-6 py-2.5 text-center">Total Staff</th>
                      <th className="px-6 py-2.5 text-center">Online Staff</th>
                      <th className="px-6 py-2.5 text-center">
                        Customers Received
                      </th>
                      <th className="px-6 py-2.5 text-center">
                        Customers Assigned
                      </th>
                      <th className="px-6 py-2.5 text-center text-[#00a884]">
                        Customers Closed
                      </th>
                      <th className="px-6 py-2.5 text-center text-rose-600">
                        Pending Follow Ups
                      </th>
                      <th className="px-6 py-2.5 text-right">
                        Conversion Rate %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {analyticsData?.branchAnalytics?.map((branch) => (
                      <tr key={branch.branchName} className="hover:bg-slate-50">
                        <td className="px-6 py-2.5 font-bold text-slate-800">
                          {branch.branchName}
                        </td>
                        <td className="px-6 py-2.5 text-center text-slate-600 font-semibold">
                          {branch.totalAssociates}
                        </td>
                        <td className="px-6 py-2.5 text-center text-slate-600 font-semibold">
                          {branch.onlineAssociates}
                        </td>
                        <td className="px-6 py-2.5 text-center text-slate-600">
                          {branch.customersReceived}
                        </td>
                        <td className="px-6 py-2.5 text-center text-slate-600">
                          {branch.customersAssigned}
                        </td>
                        <td className="px-6 py-2.5 text-center font-extrabold text-[#00a884]">
                          {branch.customersClosed}
                        </td>
                        <td className="px-6 py-2.5 text-center font-bold text-rose-600">
                          {branch.pendingFollowUps}
                        </td>
                        <td className="px-6 py-2.5 text-right font-black text-slate-800">
                          {branch.conversionRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: LEAD ANALYTICS */}
          {activeTab === "lead" && (
            <div className="p-4 space-y-4 flex flex-col h-full overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                  <ListTodo size={16} className="text-slate-600" /> Pipeline
                  Conversions & Lead Analytics
                </h3>
              </div>

              {/* KPI Cards Row (Grid 4-col) */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 ">
                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <CheckCircle size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      New Leads Closed
                    </p>
                    <h4 className="text-lg font-black text-slate-700">
                      {analyticsData?.leadAnalytics?.newLeads || 0}
                    </h4>
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Existing Leads Closed
                    </p>
                    <h4 className="text-lg font-black text-slate-700">
                      {analyticsData?.leadAnalytics?.existingLeads || 0}
                    </h4>
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                    <Activity size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Reopened Leads
                    </p>
                    <h4 className="text-lg font-black text-slate-700">
                      {analyticsData?.leadAnalytics?.reopenedLeads || 0}
                    </h4>
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-emerald-50 text-[#00a884] rounded-lg">
                    <CheckCircle size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Closed Leads Total
                    </p>
                    <h4 className="text-lg font-black text-[#00a884]">
                      {analyticsData?.leadAnalytics?.closedLeads || 0}
                    </h4>
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                    <Filter size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Follow Ups Count
                    </p>
                    <h4 className="text-lg font-black text-slate-700">
                      {analyticsData?.leadAnalytics?.followUps || 0}
                    </h4>
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-lg">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Not Interested Leads
                    </p>
                    <h4 className="text-lg font-black text-rose-600">
                      {analyticsData?.leadAnalytics?.notInterested || 0}
                    </h4>
                  </div>
                </div>

                <div className="bg-slate-50/50 border border-slate-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-rose-100/30 text-rose-800 rounded-lg">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">
                      Lost Leads Total
                    </p>
                    <h4 className="text-lg font-black text-rose-800">
                      {analyticsData?.leadAnalytics?.lostLeads || 0}
                    </h4>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5 shadow-sm">
                  <div className="p-2 bg-[#00a884]/10 text-[#00a884] rounded-lg">
                    <TrendingUp size={18} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase font-bold text-emerald-700 tracking-wider font-extrabold">
                      Conversion Progress
                    </p>
                    <h4 className="text-lg font-extrabold text-[#00a884]">
                      {analyticsData?.branchAnalytics?.[0]?.conversionRate || 0}
                      %
                    </h4>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LEADERBOARD */}
          {activeTab === "leaderboard" && (
            <div className="flex flex-col h-full overflow-hidden">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs font-bold text-slate-500">
                  Leaderboard Rankings standings (Current Month)
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-500 text-[9px] uppercase font-bold tracking-wider border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-6 py-2.5 w-20">Rank</th>
                      <th className="px-6 py-2.5">Associate Name</th>
                      <th className="px-6 py-2.5">Role</th>
                      <th className="px-6 py-2.5">Branch</th>
                      <th className="px-6 py-2.5 text-center">Follow Ups</th>
                      <th className="px-6 py-2.5 text-center text-[#00a884]">
                        Closed Leads
                      </th>
                      <th className="px-6 py-2.5 text-right">Points Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {analyticsData?.topPerformers?.length === 0 ? (
                      <tr>
                        <td
                          colSpan="7"
                          className="p-5 text-center text-slate-400 font-bold"
                        >
                          No performance records found.
                        </td>
                      </tr>
                    ) : (
                      analyticsData?.topPerformers?.map((performer, idx) => (
                        <tr
                          key={performer.associateName}
                          className="hover:bg-slate-50 transition-colors"
                        >
                          <td className="px-6 py-2.5 font-extrabold text-slate-400">
                            #{idx + 1}
                          </td>
                          <td className="px-6 py-2.5 font-bold text-slate-800">
                            {performer.associateName}
                          </td>
                          <td className="px-6 py-2.5 text-slate-500 uppercase text-[9px] font-semibold">
                            {performer.role}
                          </td>
                          <td className="px-6 py-2.5 text-slate-600">
                            {performer.branch}
                          </td>
                          <td className="px-6 py-2.5 text-center font-semibold text-slate-600">
                            {performer.followUps}
                          </td>
                          <td className="px-6 py-2.5 text-center font-bold text-[#00a884]">
                            {performer.closed}
                          </td>
                          <td className="px-6 py-2.5 text-right font-black text-slate-800">
                            {performer.score} pts
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardPage>
  );
}
