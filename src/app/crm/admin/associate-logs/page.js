"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { getSocket } from "@/features/chat/services/socketService";
import { isAdminAuthorized, isSuperAdmin as checkSuperAdmin } from "@/shared/utils/auth";
import {
  Clock,
  Filter,
  Search,
  Activity,
  Menu,
  AlertCircle,
  RefreshCw,
  X,
  ChevronRight,
  Building2,
  LogOut,
  Wifi,
  WifiOff,
  History,
  TrendingUp,
} from "lucide-react";
import { branchService } from "@/features/branches/services/branchService";
import { formatDurationHuman } from "@/shared/hooks/useAssociateSession";
import { formatISTTime, formatISTDate } from "@/shared/utils/dateRangeResolver";



const StatusBadge = ({ status }) => {
  if (status === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs animate-pulse">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        ONLINE
      </span>
    );
  }
  if (status === "offline") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-200 shadow-xs">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
        OFFLINE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
      <span className="w-2 h-2 rounded-full bg-slate-400" />
      LOGGED OUT
    </span>
  );
};

const LogoutReasonBadge = ({ reason }) => {
  if (!reason) return <span className="text-slate-400 text-xs font-medium">-</span>;

  if (reason === "manual_logout") {
    return (
      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
        Manual Logout
      </span>
    );
  }
  if (reason === "session_timeout") {
    return (
      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
        Session Timeout
      </span>
    );
  }
  if (reason === "forced_logout") {
    return (
      <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
        Forced Logout
      </span>
    );
  }
  return (
    <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
      {reason}
    </span>
  );
};

export default function AdminAssociateLogsPage() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const { setMobileOpen } = useCrmLayout();

  const [activeTab, setActiveTab] = useState("logs"); // "logs" | "summary"
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState([]);
  const [branches, setBranches] = useState([]);
  const [associates, setAssociates] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSuperAdminUser = checkSuperAdmin(session?.user?.role);
  const isAuthorized = isAdminAuthorized(session?.user?.role, session?.user?.department);

  // Helper to extract effective initial branch ID
  const getInitialBranchId = useCallback(() => {
    if (isSuperAdminUser || !session?.user?.branch) return "All";
    if (typeof session.user.branch === "object") {
      return (session.user.branch._id || session.user.branch.id || session.user.branch).toString() || "All";
    }
    return session.user.branch.toString() || "All";
  }, [isSuperAdminUser, session?.user?.branch]);

  // Filters State
  const [dateRange, setDateRange] = useState("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedAssociate, setSelectedAssociate] = useState("All");
  const [selectedBranch, setSelectedBranch] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedLogoutReason, setSelectedLogoutReason] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  // Detail Modal State
  const [selectedSession, setSelectedSession] = useState(null);

  // Sync default branch selection for Branch Admin BEFORE making first API request
  const initialBranchSyncedRef = useRef(false);
  useEffect(() => {
    if (authStatus === "authenticated" && !initialBranchSyncedRef.current) {
      initialBranchSyncedRef.current = true;
      if (!isSuperAdminUser && session?.user?.branch) {
        const initBranch = getInitialBranchId();
        if (initBranch && initBranch !== "All") {
          setSelectedBranch(initBranch);
        }
      }
    }
  }, [authStatus, isSuperAdminUser, session?.user?.branch, getInitialBranchId]);

  // Auth Guard: Only Admin & SuperAdmin can access this monitoring page
  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus === "unauthenticated" || !session) {
      router.replace("/");
      return;
    }
    if (!isAuthorized) {
      router.replace("/crm/associate");
    }
  }, [authStatus, session, isAuthorized, router]);

  // Fetch Metadata Options (Branches & Associates)
  useEffect(() => {
    if (!isAuthorized) return;
    const fetchMetadata = async () => {
      try {
        const [bRes, aRes] = await Promise.all([
          branchService.getBranches({ limit: 1000 }).catch(() => null),
          fetch("/api/admin/users?role=associate").catch(() => null)
        ]);
        if (bRes && bRes.success) {
          setBranches(bRes.branches || []);
        }
        if (aRes && aRes.ok) {
          const aData = await aRes.json();
          // Filter out current Admin user from associate dropdown if not superAdmin
          let assocList = aData.users || aData.data || [];
          if (!isSuperAdminUser && session?.user?.id) {
            assocList = assocList.filter(u => (u._id || u.id)?.toString() !== session.user.id.toString());
          }
          setAssociates(assocList);
        }
      } catch (err) {
        console.error("Error fetching filter metadata:", err);
      }
    };
    fetchMetadata();
  }, [isAuthorized, isSuperAdminUser, session?.user?.id]);

  // Explicit Fetch Function
  const fetchData = useCallback(async () => {
    if (!isAuthorized || authStatus !== "authenticated") return;
    setLoading(true);
    setError(null);

    const effectiveBranch = !isSuperAdminUser ? getInitialBranchId() : selectedBranch;

    try {
      const queryParams = new URLSearchParams({
        dateRange,
        associateId: selectedAssociate,
        branchId: effectiveBranch,
        status: selectedStatus,
        logoutReason: selectedLogoutReason
      });

      if (dateRange === "custom") {
        if (customStart) queryParams.set("customStart", customStart);
        if (customEnd) queryParams.set("customEnd", customEnd);
      }

      if (activeTab === "logs") {
        const res = await fetch(`/api/admin/associate-logs?${queryParams.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || data.error || "Failed to fetch associate logs");
        }
        setLogs(data.logs || []);
      } else {
        const res = await fetch(`/api/admin/associate-logs/summary?${queryParams.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.message || data.error || "Failed to fetch daily summary");
        }
        setSummary(data.summary || []);
      }
    } catch (err) {
      console.error("Fetch associate logs error:", err);
      setError(err.message || "Error loading associate attendance data");
    } finally {
      setLoading(false);
    }
  }, [
    isAuthorized,
    authStatus,
    isSuperAdminUser,
    getInitialBranchId,
    activeTab,
    dateRange,
    customStart,
    customEnd,
    selectedAssociate,
    selectedBranch,
    selectedStatus,
    selectedLogoutReason
  ]);

  // Trigger API Fetch ONLY on mount & explicit filter changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime Socket Updates with Scoping Rules (EXCLUDES Admin's own session)
  useEffect(() => {
    if (!isAuthorized) return;
    const socket = getSocket();
    if (!socket) return;

    const handleSessionUpdated = (payload) => {
      if (!payload || !payload.associateId) return;

      const assocIdStr = (
        payload.associateId._id ||
        payload.associateId.id ||
        payload.associateId
      ).toString();
      const currentUserId = session?.user?.id?.toString();

      // Branch Admin RBAC Guard for Socket Events
      if (!isSuperAdminUser) {
        // EXCLUDE current Admin's own session from monitoring table updates!
        if (assocIdStr === currentUserId) {
          return;
        }

        const payloadBranchStr = payload.branchId ? payload.branchId.toString() : null;
        const adminBranchStr = getInitialBranchId();

        if (!payloadBranchStr || !adminBranchStr || payloadBranchStr !== adminBranchStr) {
          return; // Ignore updates for associates outside Admin's branch
        }
      }

      const sessIdStr = payload.sessionId ? payload.sessionId.toString() : null;

      // 1. Update Logs List in Local State (In-place update)
      setLogs((prevLogs) => {
        const existingIdx = prevLogs.findIndex(
          (l) => (sessIdStr && l._id?.toString() === sessIdStr) ||
                 (l.associateId?._id?.toString() === assocIdStr && l.status !== "logged_out")
        );

        if (existingIdx !== -1) {
          const updated = [...prevLogs];
          const target = { ...updated[existingIdx] };

          if (payload.status) target.status = payload.status;
          if (payload.logoutAt) target.logoutAt = payload.logoutAt;
          if (payload.logoutReason) target.logoutReason = payload.logoutReason;
          if (payload.lastHeartbeatAt) target.lastHeartbeatAt = payload.lastHeartbeatAt;
          if (typeof payload.totalOnlineSeconds === "number") {
            target.totalOnlineSeconds = payload.totalOnlineSeconds;
          }
          if (typeof payload.totalOfflineSeconds === "number") {
            target.totalOfflineSeconds = payload.totalOfflineSeconds;
          }

          updated[existingIdx] = target;
          return updated;
        }

        return prevLogs;
      });

      // 2. Update Daily Summary in Local State (In-place update)
      setSummary((prevSummary) => {
        const existingIdx = prevSummary.findIndex(
          (s) => s.associateId?.toString() === assocIdStr
        );

        if (existingIdx !== -1) {
          const updated = [...prevSummary];
          const target = { ...updated[existingIdx] };

          if (payload.status) target.currentStatus = payload.status;
          if (payload.logoutAt) target.lastLogoutAt = payload.logoutAt;
          if (typeof payload.totalOnlineSeconds === "number") {
            target.totalOnlineSeconds = payload.totalOnlineSeconds;
          }
          if (typeof payload.totalOfflineSeconds === "number") {
            target.totalOfflineSeconds = payload.totalOfflineSeconds;
          }

          updated[existingIdx] = target;
          return updated;
        }

        return prevSummary;
      });
    };

    socket.on("associate_session_updated", handleSessionUpdated);

    return () => {
      socket.off("associate_session_updated", handleSessionUpdated);
    };
  }, [isAuthorized, isSuperAdminUser, session?.user?.id, getInitialBranchId]);

  // Local 1-second timer increment for active online sessions
  useEffect(() => {
    const timer = setInterval(() => {
      setLogs((prevLogs) => {
        let hasActiveOnline = false;
        const updated = prevLogs.map((log) => {
          if (log.status === "online") {
            hasActiveOnline = true;
            return {
              ...log,
              totalOnlineSeconds: (log.totalOnlineSeconds || 0) + 1
            };
          }
          return log;
        });
        return hasActiveOnline ? updated : prevLogs;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Client Search Filter with Defensive Admin Self Exclusion
  const filteredLogs = useMemo(() => {
    let list = logs;
    if (!isSuperAdminUser && session?.user?.id) {
      const currentUserId = session.user.id.toString();
      list = list.filter((l) => {
        const assocIdStr = l.associateId?._id?.toString() || l.associateId?.toString();
        return assocIdStr !== currentUserId;
      });
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((log) => {
      const name = (log.associateId?.name || log.associateId?.preferredName || "").toLowerCase();
      const email = (log.associateId?.email || "").toLowerCase();
      const branch = (log.branchId?.name || log.branchName || "").toLowerCase();
      return name.includes(q) || email.includes(q) || branch.includes(q);
    });
  }, [logs, searchQuery, isSuperAdminUser, session?.user?.id]);

  const filteredSummary = useMemo(() => {
    let list = summary;
    if (!isSuperAdminUser && session?.user?.id) {
      const currentUserId = session.user.id.toString();
      list = list.filter((s) => {
        const assocIdStr = s.associateId?.toString();
        return assocIdStr !== currentUserId;
      });
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((sum) => {
      const name = (sum.associateName || "").toLowerCase();
      const email = (sum.email || "").toLowerCase();
      const branch = (sum.branchName || "").toLowerCase();
      return name.includes(q) || email.includes(q) || branch.includes(q);
    });
  }, [summary, searchQuery, isSuperAdminUser, session?.user?.id]);

  // Derived KPI Stats
  const kpiStats = useMemo(() => {
    const list = filteredLogs;
    const total = list.length;
    const onlineCount = list.filter((l) => l.status === "online").length;
    const offlineCount = list.filter((l) => l.status === "offline").length;
    const loggedOutCount = list.filter((l) => l.status === "logged_out").length;

    let totalOnlineSec = 0;
    let totalOfflineSec = 0;

    list.forEach((l) => {
      totalOnlineSec += l.totalOnlineSeconds || 0;
      totalOfflineSec += l.totalOfflineSeconds || 0;
    });

    return {
      total,
      onlineCount,
      offlineCount,
      loggedOutCount,
      formattedOnlineTotal: formatDurationHuman(totalOnlineSec),
      formattedOfflineTotal: formatDurationHuman(totalOfflineSec)
    };
  }, [filteredLogs]);

  if (authStatus === "loading" || !isAuthorized) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-slate-50 text-slate-400">
        <RefreshCw className="animate-spin mr-2" size={24} />
        <span className="font-bold tracking-widest uppercase text-sm">Verifying Credentials...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-slate-50">
      {/* ── HEADER ── */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-20 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
                Associate Attendance & Session Logs
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                Realtime
              </span>
            </div>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Audit staff login sessions, online duration, offline breaks, and token timeouts across branches.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "logs" ? "bg-white text-[#00a884] shadow-xs" : "text-slate-600 hover:bg-white/50"
            }`}
          >
            <History size={14} />
            <span>Session Logs</span>
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "summary" ? "bg-white text-[#00a884] shadow-xs" : "text-slate-600 hover:bg-white/50"
            }`}
          >
            <TrendingUp size={14} />
            <span>Daily Summary</span>
          </button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Currently Online</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">{kpiStats.onlineCount}</h3>
              <p className="text-xs text-slate-400 mt-1 font-semibold">Active staff working sessions</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Wifi size={24} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Currently Offline</p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">{kpiStats.offlineCount}</h3>
              <p className="text-xs text-slate-400 mt-1 font-semibold">Network / internet disconnected</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <WifiOff size={24} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Logged Out Today</p>
              <h3 className="text-2xl font-black text-slate-700 mt-1">{kpiStats.loggedOutCount}</h3>
              <p className="text-xs text-slate-400 mt-1 font-semibold">Completed sessions</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
              <LogOut size={24} />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Staff Online Time</p>
              <h3 className="text-2xl font-black text-[#00a884] mt-1">{kpiStats.formattedOnlineTotal}</h3>
              <p className="text-xs text-slate-400 mt-1 font-semibold">Excludes offline breaks</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#00a884]">
              <Clock size={24} />
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-[#00a884]" />
              <h3 className="text-sm font-extrabold text-slate-800">Filter Staff Attendance Records</h3>
            </div>
            <button
              onClick={fetchData}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Search</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Associate or branch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-2 w-full bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#00a884]"
                />
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Date Range</label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#00a884]"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="custom">Custom Date</option>
              </select>
            </div>

            {/* Branch Filter */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                disabled={!isSuperAdminUser}
                className={`w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#00a884] ${
                  !isSuperAdminUser ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {isSuperAdminUser ? (
                  <>
                    <option value="All">All Branches</option>
                    {branches.map((b) => {
                      const bId = (b._id || b.id)?.toString();
                      return (
                        <option key={bId} value={bId}>
                          {b.name}
                        </option>
                      );
                    })}
                  </>
                ) : (
                  (() => {
                    const filtered = branches.filter(
                      (b) => (b._id || b.id)?.toString() === selectedBranch?.toString()
                    );
                    if (filtered.length > 0) {
                      return filtered.map((b) => {
                        const bId = (b._id || b.id)?.toString();
                        return (
                          <option key={bId} value={bId}>
                            {b.name}
                          </option>
                        );
                      });
                    }
                    // Fallback while loading
                    const fallbackName = typeof session?.user?.branch === "object" && session?.user?.branch?.name
                      ? session.user.branch.name
                      : "My Branch";
                    return <option value={selectedBranch}>{fallbackName}</option>;
                  })()
                )}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#00a884]"
              >
                <option value="All">All Statuses</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="logged_out">Logged Out</option>
              </select>
            </div>

            {/* Logout Reason Filter */}
            <div>
              <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">Logout Reason</label>
              <select
                value={selectedLogoutReason}
                onChange={(e) => setSelectedLogoutReason(e.target.value)}
                className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#00a884]"
              >
                <option value="All">All Reasons</option>
                <option value="manual_logout">Manual Logout</option>
                <option value="session_timeout">Session Timeout</option>
                <option value="forced_logout">Forced Logout</option>
              </select>
            </div>
          </div>

          {/* Custom Date Inputs */}
          {dateRange === "custom" && (
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">From Date</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold uppercase text-slate-400 mb-1">To Date</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── CONTENT TABLE ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {error ? (
            <div className="p-8 text-center text-rose-500">
              <AlertCircle size={36} className="mx-auto mb-2" />
              <p className="font-bold">{error}</p>
            </div>
          ) : loading ? (
            <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
              <RefreshCw className="animate-spin text-[#00a884]" size={32} />
              <span className="font-bold text-xs uppercase tracking-widest">Loading Attendance Records...</span>
            </div>
          ) : activeTab === "logs" ? (
            /* SESSION LOGS TABLE */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-4">Associate</th>
                    <th className="px-5 py-4">Branch</th>
                    <th className="px-5 py-4">Login Time (IST)</th>
                    <th className="px-5 py-4">Logout Time (IST)</th>
                    <th className="px-5 py-4">Logout Reason</th>
                    <th className="px-5 py-4">Online Time</th>
                    <th className="px-5 py-4">Offline Time</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-12 text-center text-slate-400 font-bold text-sm">
                        No staff session logs match the current criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const assoc = log.associateId;
                      const assocName = assoc?.name || assoc?.preferredName || "Unknown Associate";
                      const branchName = log.branchId?.name || log.branchName || "Unassigned";

                      return (
                        <tr
                          key={log._id}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                          onClick={() => setSelectedSession(log)}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0 border border-teal-200">
                                {assocName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-800 text-sm">{assocName}</div>
                                <div className="text-[11px] text-slate-400 font-medium">{assoc?.email || ""}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700">
                              <Building2 size={12} className="text-slate-400" />
                              {branchName}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-700 text-xs">{formatISTTime(log.loginAt)}</div>
                            <div className="text-[10px] text-slate-400">{formatISTDate(log.loginAt)}</div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-700 text-xs">{formatISTTime(log.logoutAt)}</div>
                            {log.logoutAt && <div className="text-[10px] text-slate-400">{formatISTDate(log.logoutAt)}</div>}
                          </td>
                          <td className="px-5 py-4">
                            <LogoutReasonBadge reason={log.logoutReason} />
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-xs text-emerald-600">
                            {formatDurationHuman(log.totalOnlineSeconds)}
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-xs text-amber-600">
                            {formatDurationHuman(log.totalOfflineSeconds)}
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge status={log.status} />
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSession(log);
                              }}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-[#00a884] hover:text-white transition-all"
                            >
                              <ChevronRight size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* DAILY SUMMARY TABLE */
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-4">Associate</th>
                    <th className="px-5 py-4">Branch</th>
                    <th className="px-5 py-4">First Login</th>
                    <th className="px-5 py-4">Last Logout</th>
                    <th className="px-5 py-4">Total Sessions</th>
                    <th className="px-5 py-4">Total Online Time</th>
                    <th className="px-5 py-4">Total Offline Time</th>
                    <th className="px-5 py-4">Current Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSummary.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="p-12 text-center text-slate-400 font-bold text-sm">
                        No daily staff attendance summary data available.
                      </td>
                    </tr>
                  ) : (
                    filteredSummary.map((sum) => (
                      <tr key={sum.associateId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0 border border-blue-200">
                              {sum.associateName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-800 text-sm">{sum.associateName}</div>
                              <div className="text-[11px] text-slate-400 font-medium">{sum.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 font-bold text-xs text-slate-700">{sum.branchName}</td>
                        <td className="px-5 py-4 font-bold text-xs text-slate-700">{formatISTTime(sum.firstLoginAt)}</td>
                        <td className="px-5 py-4 font-bold text-xs text-slate-700">{formatISTTime(sum.lastLogoutAt)}</td>
                        <td className="px-5 py-4 font-bold text-xs text-slate-700">{sum.totalSessions}</td>
                        <td className="px-5 py-4 font-mono font-bold text-xs text-emerald-600">
                          {formatDurationHuman(sum.totalOnlineSeconds)}
                        </td>
                        <td className="px-5 py-4 font-mono font-bold text-xs text-amber-600">
                          {formatDurationHuman(sum.totalOfflineSeconds)}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={sum.currentStatus} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── SESSION TIMELINE DETAIL DRAWER ── */}
      {selectedSession && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right">
            <div>
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
                <div>
                  <h3 className="font-extrabold text-base">Session Details & Timeline</h3>
                  <p className="text-xs text-slate-400">ID: {selectedSession._id}</p>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-5 space-y-6">
                {/* Associate Info Card */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#00a884] text-white flex items-center justify-center font-black text-sm">
                      {(selectedSession.associateId?.name || "A").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm">
                        {selectedSession.associateId?.name || selectedSession.associateId?.preferredName || "Unknown"}
                      </h4>
                      <p className="text-xs text-slate-500">{selectedSession.associateId?.email}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase">Branch</span>
                      <span className="font-bold text-slate-700">
                        {selectedSession.branchId?.name || selectedSession.branchName || "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-bold uppercase">Current Status</span>
                      <StatusBadge status={selectedSession.status} />
                    </div>
                  </div>
                </div>

                {/* Duration Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl text-center">
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                      Total Online Time
                    </span>
                    <span className="text-lg font-black text-emerald-700 font-mono">
                      {formatDurationHuman(selectedSession.totalOnlineSeconds)}
                    </span>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl text-center">
                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
                      Total Offline Break
                    </span>
                    <span className="text-lg font-black text-amber-700 font-mono">
                      {formatDurationHuman(selectedSession.totalOfflineSeconds)}
                    </span>
                  </div>
                </div>

                {/* Timeline Visualization */}
                <div>
                  <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <History size={14} className="text-[#00a884]" /> Chronological Activity Timeline
                  </h4>

                  <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {/* Event: Login */}
                    <div className="relative">
                      <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                      <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-xs">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-emerald-700">Logged In</span>
                          <span className="text-slate-500">{formatISTTime(selectedSession.loginAt)}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{formatISTDate(selectedSession.loginAt)}</p>
                      </div>
                    </div>

                    {/* Segments Offline & Online Breaks */}
                    {(selectedSession.segments || []).map((seg, idx) => (
                      <div key={idx} className="space-y-4">
                        {seg.offlineAt && (
                          <div className="relative">
                            <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                            <div className="bg-amber-50/60 border border-amber-200 p-3 rounded-xl shadow-xs">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-amber-800">Went Offline</span>
                                <span className="text-slate-600">{formatISTTime(seg.offlineAt)}</span>
                              </div>
                              <p className="text-[11px] text-amber-700 mt-0.5">
                                Network / Internet Disconnected
                              </p>
                            </div>
                          </div>
                        )}

                        {seg.onlineAt && (
                          <div className="relative">
                            <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-blue-100" />
                            <div className="bg-blue-50/60 border border-blue-200 p-3 rounded-xl shadow-xs">
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className="text-blue-800">Back Online</span>
                                <span className="text-slate-600">{formatISTTime(seg.onlineAt)}</span>
                              </div>
                              <p className="text-[11px] text-blue-700 mt-0.5">Heartbeat Resumed</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Event: Logout */}
                    {selectedSession.logoutAt && (
                      <div className="relative">
                        <div className="absolute -left-[23px] top-0 w-4 h-4 rounded-full bg-slate-700 ring-4 ring-slate-200" />
                        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xs">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span>Logged Out</span>
                            <span>{formatISTTime(selectedSession.logoutAt)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-between">
                            <p className="text-[11px] text-slate-400">Reason:</p>
                            <LogoutReasonBadge reason={selectedSession.logoutReason} />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 text-right">
              <button
                onClick={() => setSelectedSession(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
