"use client";

import DashboardSection from "./DashboardSection";
import LiveAssociateActivity from "./LiveAssociateActivity";

export default function ActiveConversations({ activity = [], loading }) {
  return (
    <DashboardSection
      title="Live Associate Activity Log"
      subtitle="Real-time handling details from active chat locks"
    >
      <LiveAssociateActivity activity={activity} loading={loading} />
    </DashboardSection>
  );
}
