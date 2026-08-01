"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Building,
  Building2,
  UserCheck,
  Activity,
  Filter,
  RefreshCw,
  Tag,
  User,
  CheckCircle,
  Clock,
  Lock,
} from "lucide-react";

export default function DashboardFilters({
  visible = [], // Filter identifiers to mount on the current workspace tab
  dateRange,
  setDateRange,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  branchId,
  setBranchId,
  department,
  setDepartment,
  role,
  setRole,
  associateStatus,
  setAssociateStatus,
  leadType,
  setLeadType,
  associateId,
  setAssociateId,
  leadStatus,
  setLeadStatus,
  waitingTime,
  setWaitingTime,
  branches = [],
  associates = [],
  isSuperAdmin,
  loading,
  onRefresh,
}) {
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    setLastUpdated(
      new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }, [loading]);

  const showFilter = (key) => visible.includes(key);

  const currentBranchName = branches.find((b) => b._id === branchId || b.name === branchId)?.name || branchId;

  // Dynamically calculate grid columns based on number of visible filters
  const gridColsClass = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
    7: "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7",
    8: "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8",
  }[visible.length] || "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-6";

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-4 shadow-sm mb-6 select-none print:hidden">
      <div className="flex flex-col gap-4">
        {/* Header toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-50 text-[#00a884] border border-emerald-100 rounded-[8px] flex items-center justify-center shadow-sm">
              <Filter size={16} />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-800 text-[13px] leading-tight font-sans">Workspace Filters</h4>
              <p className="text-[10px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">
                Active Context Constraints
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150 shadow-inner">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                Live Sync Active
              </span>
              <span className="text-[9px] font-black text-slate-455 leading-none">
                Updated {lastUpdated}
              </span>
            </div>

            <button
              onClick={onRefresh}
              className="p-1.5 text-slate-455 hover:text-[#00a884] hover:bg-emerald-55 rounded-lg border border-slate-200 hover:border-[#00a884]/20 transition-all shadow-sm cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-[#00a884]" : ""} />
            </button>
          </div>
        </div>

        {/* Filter Inputs Grid with auto-adapting column widths */}
        <div className={`grid ${gridColsClass} gap-3 items-end w-full`}>
          {/* 1. Date Range */}
          {showFilter("dateRange") && (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={11} className="text-slate-400" /> Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 outline-none hover:bg-slate-100 hover:border-slate-350 cursor-pointer shadow-sm w-full h-[34px]"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="7days">7 Days</option>
                <option value="30days">30 Days</option>
                <option value="thisMonth">This Month</option>
                <option value="lastMonth">Last Month</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          )}

          {/* 2. Branch Selector */}
          {showFilter("branchId") && (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <Building size={11} className="text-slate-400" /> Branch
              </label>
              {isSuperAdmin ? (
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 outline-none hover:bg-slate-100 hover:border-slate-350 cursor-pointer shadow-sm w-full h-[34px]"
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => (
                    <option key={b._id} value={b._id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="relative w-full">
                  <select
                    disabled
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-450 outline-none shadow-sm w-full h-[34px] appearance-none pr-8 cursor-not-allowed select-none"
                  >
                    <option>{currentBranchName || branchId}</option>
                  </select>

                </div>
              )}
            </div>
          )}

          {/* 3. Department */}
          {showFilter("department") && (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <Building2 size={11} className="text-slate-400" /> Dept
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 outline-none hover:bg-slate-100 hover:border-slate-350 cursor-pointer shadow-sm w-full h-[34px]"
              >
                <option value="all">All Depts</option>
                <option value="telecalling">Telecalling</option>
                <option value="support">Support</option>
                <option value="sales">Sales</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>
          )}

          {/* 4. Role */}
          {showFilter("role") && (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <UserCheck size={11} className="text-slate-400" /> Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 outline-none hover:bg-slate-100 hover:border-slate-350 cursor-pointer shadow-sm w-full h-[34px]"
              >
                <option value="all">All Roles</option>
                <option value="sales">Sales Officer</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>
          )}

          {/* 5. Associate Status */}
          {showFilter("associateStatus") && (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <Activity size={11} className="text-slate-400" /> Associate Status
              </label>
              <select
                value={associateStatus}
                onChange={(e) => setAssociateStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 outline-none hover:bg-slate-100 hover:border-slate-350 cursor-pointer shadow-sm w-full h-[34px]"
              >
                <option value="all">All Status</option>
                <option value="online">🟢 Online</option>
                <option value="busy">🟡 Busy</option>
                <option value="offline">🔴 Offline</option>
              </select>
            </div>
          )}

          {/* 6. Lead Type */}
          {showFilter("leadType") && (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <Tag size={11} className="text-slate-400" /> Lead Type
              </label>
              <select
                value={leadType}
                onChange={(e) => setLeadType(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 outline-none hover:bg-slate-100 hover:border-slate-350 cursor-pointer shadow-sm w-full h-[34px]"
              >
                <option value="all">All Types</option>
                <option value="Direct Lead">Direct Lead</option>
                <option value="MD Camp">MD Camp</option>
                <option value="Product Lead">Product Lead</option>
                <option value="Therapy">Therapy</option>
              </select>
            </div>
          )}

          {/* 7. Associate */}
          {showFilter("associateId") && (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <User size={11} className="text-slate-400" /> Associate
              </label>
              <select
                value={associateId}
                onChange={(e) => setAssociateId(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 outline-none hover:bg-slate-100 hover:border-slate-350 cursor-pointer shadow-sm w-full h-[34px]"
              >
                <option value="all">All Users</option>
                {associates.map((a) => (
                  <option key={a.id || a._id} value={a.id || a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 8. Lead Status */}
          {showFilter("leadStatus") && (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle size={11} className="text-slate-400" /> Lead Status
              </label>
              <select
                value={leadStatus}
                onChange={(e) => setLeadStatus(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 outline-none hover:bg-slate-100 hover:border-slate-350 cursor-pointer shadow-sm w-full h-[34px]"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="followUp">Follow Up</option>
                <option value="closed">Closed</option>
                <option value="notInterested">Not Interested</option>
                <option value="converted">Converted</option>
              </select>
            </div>
          )}

          {/* 9. Waiting Time */}
          {showFilter("waitingTime") && (
            <div className="flex flex-col gap-1 w-full">
              <label className="text-[9px] font-black text-slate-450 uppercase tracking-wider flex items-center gap-1">
                <Clock size={11} className="text-slate-400" /> Waiting Time
              </label>
              <select
                value={waitingTime}
                onChange={(e) => setWaitingTime(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-extrabold text-slate-700 outline-none hover:bg-slate-100 hover:border-slate-350 cursor-pointer shadow-sm w-full h-[34px]"
              >
                <option value="all">All Wait Times</option>
                <option value="0-5">0–5 mins</option>
                <option value="5-15">5–15 mins</option>
                <option value="15-30">15–30 mins</option>
                <option value="30+">30+ mins</option>
              </select>
            </div>
          )}
        </div>

        {/* Custom date range selection */}
        {showFilter("dateRange") && dateRange === "custom" && (
          <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-150 shadow-inner animate-slide-down">
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest">Start Date</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#00a884] shadow-sm transition-all"
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black text-slate-450 uppercase tracking-widest">End Date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#00a884] shadow-sm transition-all"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
