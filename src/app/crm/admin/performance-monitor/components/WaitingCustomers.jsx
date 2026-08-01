"use client";

import { Clock } from "lucide-react";
import DashboardSection from "./DashboardSection";
import MetricCard from "./MetricCard";
import UnassignedQueue from "./UnassignedQueue";

export default function WaitingCustomers({
  waitingAnalytics = {},
  unassignedQueue = [],
  associatesList = [],
  onRefresh,
  loading,
}) {
  return (
    <div className="space-y-6 select-none">
      {/* Waiting duration buckets */}
      <DashboardSection title="Waiting Customer Analytics" subtitle="Clients waiting grouped by wait time ranges">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Wait > 5 min"
            value={waitingAnalytics.wait5}
            icon={<Clock size={20} />}
            color="blue"
            sub="Medium priority queue"
            loading={loading}
          />
          <MetricCard
            title="Wait > 15 min"
            value={waitingAnalytics.wait15}
            icon={<Clock size={20} />}
            color="rose"
            sub="High priority queue"
            loading={loading}
          />
          <MetricCard
            title="Wait > 30 min"
            value={waitingAnalytics.wait30}
            icon={<Clock size={20} />}
            color="amber"
            sub="Overdue status queue"
            loading={loading}
          />
          <MetricCard
            title="Wait > 1 hour"
            value={waitingAnalytics.wait60}
            icon={<Clock size={20} />}
            color="rose"
            sub="Critical warning queue"
            loading={loading}
          />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Unassigned Customer Queue"
        subtitle="Customers waiting for assignment, sorted by oldest waiting time"
      >
        <UnassignedQueue
          queue={unassignedQueue}
          associates={associatesList}
          onRefresh={onRefresh}
          loading={loading}
        />
      </DashboardSection>
    </div>
  );
}
