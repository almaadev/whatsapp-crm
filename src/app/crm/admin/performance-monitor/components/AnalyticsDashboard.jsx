"use client";

import {
  LeadStatusChart,
  DailyClosuresChart,
  AssociateComparisonChart,
  MonthlyPerformanceChart,
} from "@/shared/components/ui/DashboardCharts";
import DashboardSection from "./DashboardSection";

export default function AnalyticsDashboard({ charts = {} }) {
  return (
    <DashboardSection
      title="Analytics Dashboard"
      subtitle="Operational metrics, conversions and daily response trends"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LeadStatusChart data={charts.leadStatus} />
        <DailyClosuresChart data={charts.dailyClosures} />
        <MonthlyPerformanceChart data={charts.monthlyPerformance} />
        <AssociateComparisonChart data={charts.associateComparison} />
      </div>
    </DashboardSection>
  );
}
