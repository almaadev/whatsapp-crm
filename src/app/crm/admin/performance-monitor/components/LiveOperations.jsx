"use client";

import { Users, Activity, User, ShieldAlert, Clock, Lock } from "lucide-react";
import DashboardSection from "./DashboardSection";
import MetricCard from "./MetricCard";

export default function LiveOperations({
  liveOperations = {},
  presenceStatus,
  setPresenceStatus,
  statusFilter,
  setStatusFilter,
  loading,
}) {
  return (
    <div className="space-y-6 select-none">
      <DashboardSection
        title="Live Operations Tracker"
        subtitle="Real-time associate socket activity counters and queues"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Associates Online"
            value={liveOperations.onlineCount}
            icon={<Users size={20} />}
            color="emerald"
            sub="Currently logged in"
            active={presenceStatus === "online"}
            onClick={() => setPresenceStatus(presenceStatus === "online" ? "all" : "online")}
            loading={loading}
          />
          <MetricCard
            title="Busy Associates"
            value={liveOperations.busyCount}
            icon={<Activity size={20} />}
            color="amber"
            sub="In active conversations"
            active={presenceStatus === "busy" || statusFilter === "busy"}
            onClick={() => {
              setPresenceStatus(presenceStatus === "busy" ? "all" : "busy");
              setStatusFilter(statusFilter === "busy" ? "all" : "busy");
            }}
            loading={loading}
          />
          <MetricCard
            title="Idle Associates"
            value={liveOperations.idleCount}
            icon={<User size={20} />}
            color="blue"
            sub="Online but available"
            active={presenceStatus === "idle" || statusFilter === "idle"}
            onClick={() => {
              setPresenceStatus(presenceStatus === "idle" ? "all" : "idle");
              setStatusFilter(statusFilter === "idle" ? "all" : "idle");
            }}
            loading={loading}
          />
          <MetricCard
            title="Offline Associates"
            value={liveOperations.offlineCount}
            icon={<ShieldAlert size={20} />}
            color="slate"
            sub="No socket heartbeat"
            active={presenceStatus === "offline" || statusFilter === "offline"}
            onClick={() => {
              setPresenceStatus(presenceStatus === "offline" ? "all" : "offline");
              setStatusFilter(statusFilter === "offline" ? "all" : "offline");
            }}
            loading={loading}
          />
          <MetricCard
            title="Customers Waiting"
            value={liveOperations.waitingCount}
            icon={<Clock size={20} />}
            color="rose"
            sub="Unresolved customer inputs"
            loading={loading}
          />
          <MetricCard
            title="Unassigned Customers"
            value={liveOperations.unassignedCount}
            icon={<Users size={20} />}
            color="rose"
            sub="Clients without handlers"
            loading={loading}
          />
          <MetricCard
            title="Locked Conversations"
            value={liveOperations.lockedCount}
            icon={<Lock size={20} />}
            color="amber"
            sub="Active conversation locks"
            loading={loading}
          />
          <MetricCard
            title="Pending Follow Ups"
            value={liveOperations.pendingFollowUps}
            icon={<Clock size={20} />}
            color="blue"
            sub="Follow ups in timeline query"
            loading={loading}
          />
        </div>
      </DashboardSection>
    </div>
  );
}
