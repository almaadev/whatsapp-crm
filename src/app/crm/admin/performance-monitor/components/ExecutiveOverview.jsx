"use client";

import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";

import {
  Users,
  AlertCircle,
  CheckCircle,
  Activity,
  UserX,
  Clock,
  ArrowRight,
} from "lucide-react";
import DashboardSection from "./DashboardSection";
import LeaderboardCard from "./LeaderboardCard";

export default function ExecutiveOverview({
  summary = {},
  branchHealth = [],
  leaderboard = [],
  recentActivities = [],
  loading,
  onNavigateToTab,
}) {
  const formatMedal = (rank) => {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    return "🥉";
  };

  const getEventIcon = (type) => {
    if (type === "lead_closed") {
      return (
        <span className="w-7 h-7 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full flex items-center justify-center shrink-0">
          <CheckCircle size={13} />
        </span>
      );
    }
    if (type === "lead_followup") {
      return (
        <span className="w-7 h-7 bg-amber-50 text-amber-600 border border-amber-100 rounded-full flex items-center justify-center shrink-0">
          <Clock size={13} />
        </span>
      );
    }
    return (
      <span className="w-7 h-7 bg-blue-50 text-blue-600 border border-blue-100 rounded-full flex items-center justify-center shrink-0">
        <Users size={13} />
      </span>
    );
  };

  return (
    <div className="space-y-6 select-none">
      {/* 1. Executive Summary Grid */}
      <DashboardSection title="Executive Summary" subtitle="Today's operations snapshot">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryMiniCard
            title="Received Today"
            value={summary.todayReceived}
            icon={<Users size={16} />}
            color="blue"
            loading={loading}
          />
          <SummaryMiniCard
            title="Assigned Today"
            value={summary.todayAssigned}
            icon={<Users size={16} />}
            color="emerald"
            loading={loading}
          />
          <SummaryMiniCard
            title="Active Pending"
            value={summary.todayPending}
            icon={<AlertCircle size={16} />}
            color="rose"
            loading={loading}
          />
          <SummaryMiniCard
            title="Closed Today"
            value={summary.todayClosed}
            icon={<CheckCircle size={16} />}
            color="emerald"
            loading={loading}
          />
          <SummaryMiniCard
            title="Busy Associates"
            value={summary.busyCount}
            icon={<Activity size={16} />}
            color="amber"
            loading={loading}
          />
          <SummaryMiniCard
            title="Offline Associates"
            value={summary.offlineCount}
            icon={<UserX size={16} />}
            color="slate"
            loading={loading}
          />
          <SummaryMiniCard
            title="Waiting Clients"
            value={summary.waitingCount}
            icon={<Clock size={16} />}
            color="rose"
            loading={loading}
          />
          <SummaryMiniCard
            title="Avg Client Wait"
            value={summary.avgWaitingTimeText}
            icon={<Clock size={16} />}
            color="blue"
            loading={loading}
          />

          {/* New Leads Closed Card */}
          <div className="bg-white border border-slate-200 rounded-[12px] p-3.5 shadow-sm hover:shadow transition-shadow col-span-2 sm:col-span-1 lg:col-span-2 select-none">
            <div className="flex justify-between items-start mb-2.5">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">
                  New Leads Closed
                </p>
              </div>
              <div className="w-6.5 h-6.5 bg-emerald-50 text-emerald-600 border border-emerald-100/50 rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle size={13} />
              </div>
            </div>
            {loading ? (
              <div className="animate-pulse space-y-1.5 py-1">
                <div className="w-full h-3 bg-slate-100 rounded" />
                <div className="w-3/4 h-2 bg-slate-100 rounded" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="border-r border-slate-100 pr-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">Today</span>
                  <span className="text-sm font-extrabold text-slate-850 block">{summary.todayNewLeadsClosed || 0}</span>
                </div>
                <div className="border-r border-slate-100 px-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">This Month</span>
                  <span className="text-sm font-extrabold text-slate-850 block">{summary.thisMonthNewLeadsClosed || 0}</span>
                </div>
                <div className="pl-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">Selected</span>
                  <span className="text-sm font-extrabold text-[#00a884] block">{summary.selectedNewLeadsClosed || 0}</span>
                </div>
              </div>
            )}
          </div>

          {/* Existing Leads Closed Card */}
          <div className="bg-white border border-slate-200 rounded-[12px] p-3.5 shadow-sm hover:shadow transition-shadow col-span-2 sm:col-span-1 lg:col-span-2 select-none">
            <div className="flex justify-between items-start mb-2.5">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">
                  Existing Leads Closed
                </p>
              </div>
              <div className="w-6.5 h-6.5 bg-blue-50 text-blue-600 border border-blue-100/50 rounded-lg flex items-center justify-center shrink-0">
                <CheckCircle size={13} />
              </div>
            </div>
            {loading ? (
              <div className="animate-pulse space-y-1.5 py-1">
                <div className="w-full h-3 bg-slate-100 rounded" />
                <div className="w-3/4 h-2 bg-slate-100 rounded" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="border-r border-slate-100 pr-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">Today</span>
                  <span className="text-sm font-extrabold text-slate-850 block">{summary.todayExistingLeadsClosed || 0}</span>
                </div>
                <div className="border-r border-slate-100 px-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">This Month</span>
                  <span className="text-sm font-extrabold text-slate-850 block">{summary.thisMonthExistingLeadsClosed || 0}</span>
                </div>
                <div className="pl-1">
                  <span className="text-[8px] font-bold text-slate-400 uppercase block">Selected</span>
                  <span className="text-sm font-extrabold text-blue-600 block">{summary.selectedExistingLeadsClosed || 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </DashboardSection>

      {/* 2. Standings, Snapshot, and Timeline Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Top Performers & Snapshot */}
        <div className="xl:col-span-1 space-y-6">
          <DashboardSection title="Top Performers" subtitle="Highest scoring associates today">
            <div className="space-y-4">
              {leaderboard.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-450 font-bold border border-dashed border-slate-200 rounded-xl">
                  No performer details available.
                </div>
              ) : (
                leaderboard.map((item) => (
                  <LeaderboardCard
                    key={item.rank}
                    rank={item.rank}
                    name={item.name}
                    score={item.score}
                    role={item.role}
                    branch={item.branch}
                    medal={formatMedal(item.rank)}
                  />
                ))
              )}
            </div>
          </DashboardSection>

          {/* Compact Branch snapshot */}
          <div className="bg-white border border-slate-200 rounded-[12px] p-4 shadow-sm hover:shadow transition-shadow">
            <h4 className="text-[10px] font-black text-slate-450 uppercase tracking-widest border-b border-slate-100 pb-2 mb-3">
              📍 Compact Branch Snapshot
            </h4>
            <div className="space-y-2.5">
              {branchHealth.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-2">No branch statistics loaded.</p>
              ) : (
                branchHealth.slice(0, 5).map((b) => (
                  <div key={b.branchId} className="flex justify-between items-center text-xs pb-1">
                    <span className="font-extrabold text-slate-700 truncate max-w-[120px]">{b.branchName}</span>
                    <span className="font-black text-[#00a884] shrink-0 text-[11px]">
                      {b.closedToday} Closed • {b.targetProgress}% Target
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>


        </div>

        {/* Right Column: Recent Critical Activities Timeline */}
        <div className="xl:col-span-2">
          <DashboardSection title="Critical Activities log" subtitle="Chronological associate pipeline logs">
            <div className="bg-white border border-slate-200 rounded-[12px] p-4 shadow-sm space-y-4 max-h-[480px] overflow-y-auto">
              {recentActivities.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-bold">
                  No activity events registered for the selected filters.
                </div>
              ) : (
                recentActivities.slice(0, 10).map((act, idx) => (
                  <div key={idx} className="flex gap-3 text-xs leading-tight pb-3.5 border-b border-slate-50 last:border-b-0 last:pb-0">
                    {getEventIcon(act.eventType)}
                    <div className="space-y-1 w-full min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <p className="font-extrabold text-slate-700 truncate">
                          {act.performedByName || act.associateName || "System"}{" "}
                          <span className="font-medium text-slate-500">
                            {act.action === "Closed"
                              ? "closed customer"
                              : act.action === "Follow Up"
                              ? "updated follow up date"
                              : act.action}
                          </span>{" "}
                          <span className="font-black text-slate-800">
                            {resolveCustomerDisplayName({ customerName: act.customerName, phone: act.phone })}
                          </span>
                        </p>
                        <span className="text-[9px] font-black text-slate-400 shrink-0 uppercase">
                          {new Date(act.timestamp).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {act.notes && (
                        <p className="text-[11px] text-slate-450 font-bold bg-slate-50 p-2 rounded-lg border border-slate-100 truncate italic">
                          {act.notes}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-400 font-extrabold flex gap-2">
                        <span>📍 {act.branch || "Global"}</span>
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DashboardSection>
        </div>

      </div>
    </div>
  );
}

// Summary Mini Card Helper
function SummaryMiniCard({ title, value, icon, color, loading }) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };

  const formattedVal =
    value === undefined || value === null || value === "" || value === "0 / 0" ? "0" : value;

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-3 shadow-sm flex items-center justify-between h-[64px] w-full hover:shadow transition-shadow">
      {loading ? (
        <div className="w-full animate-pulse space-y-1">
          <div className="w-16 h-2 bg-slate-100 rounded" />
          <div className="w-8 h-4 bg-slate-150 rounded" />
        </div>
      ) : (
        <>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider leading-none">
              {title}
            </p>
            <p className="text-[18px] font-black text-slate-800 tracking-tight leading-none mt-1.5">
              {formattedVal}
            </p>
          </div>
          <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 shadow-sm ${colorClasses[color] || colorClasses.slate}`}>
            {icon}
          </div>
        </>
      )}
    </div>
  );
}
