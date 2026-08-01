"use client";

import {
  Building2,
  Users,
  Activity,
  Clock,
  CheckCircle,
  UserX,
} from "lucide-react";
import DashboardSection from "./DashboardSection";
import BranchOperationsTable from "./BranchOperationsTable";

export default function BranchPerformance({
  branchHealth = [],
  isSuperAdmin,
  onInspectBranch,
  loading,
}) {
  return (
    <div className="space-y-6 select-none">
      {isSuperAdmin ? (
        <DashboardSection
          title="Branch Operations Matrix"
          subtitle="Clinics workload and pipeline performance indicators"
        >
          <BranchOperationsTable
            branches={branchHealth}
            loading={loading}
            onInspectBranch={onInspectBranch}
          />
        </DashboardSection>
      ) : (
        branchHealth && branchHealth[0] && (
          <DashboardSection
            title="My Branch Dashboard"
            subtitle={`Operational metrics for ${branchHealth[0].branchName} Branch`}
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <SummaryMiniCard
                title="Branch Name"
                value={branchHealth[0].branchName}
                icon={<Building2 size={16} />}
                color="blue"
                loading={loading}
              />
              <SummaryMiniCard
                title="Online Associates"
                value={branchHealth[0].onlineCount}
                icon={<Users size={16} />}
                color="emerald"
                loading={loading}
              />
              <SummaryMiniCard
                title="Busy Associates"
                value={branchHealth[0].busyCount}
                icon={<Activity size={16} />}
                color="amber"
                loading={loading}
              />
              <SummaryMiniCard
                title="Offline Associates"
                value={branchHealth[0].offlineCount}
                icon={<UserX size={16} />}
                color="slate"
                loading={loading}
              />
              <SummaryMiniCard
                title="Customers Managed"
                value={branchHealth[0].customersManaged}
                icon={<Users size={16} />}
                color="blue"
                loading={loading}
              />
              <SummaryMiniCard
                title="Customers Waiting"
                value={branchHealth[0].waitingCount}
                icon={<Clock size={16} />}
                color="rose"
                loading={loading}
              />
              <SummaryMiniCard
                title="Pending Follow Ups"
                value={branchHealth[0].pendingFollowUps}
                icon={<Clock size={16} />}
                color="blue"
                loading={loading}
              />
              <SummaryMiniCard
                title="Closed Today"
                value={branchHealth[0].closedToday}
                icon={<CheckCircle size={16} />}
                color="emerald"
                loading={loading}
              />
              <SummaryMiniCard
                title="Avg Response Time"
                value={branchHealth[0].avgReplyTimeText}
                icon={<Clock size={16} />}
                color="blue"
                loading={loading}
              />
              <SummaryMiniCard
                title="Branch Target"
                value={branchHealth[0].branchTarget}
                icon={<Users size={16} />}
                color="emerald"
                loading={loading}
              />
              <SummaryMiniCard
                title="Today's Conversion"
                value={branchHealth[0].closedToday}
                icon={<CheckCircle size={16} />}
                color="emerald"
                loading={loading}
              />
            </div>
          </DashboardSection>
        )
      )}
    </div>
  );
}

// Local helper card component
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
