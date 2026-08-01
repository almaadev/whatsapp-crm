"use client";

import DashboardSection from "./DashboardSection";
import PerformanceMatrix from "./PerformanceMatrix";

export default function AssociateActivity({
  roster = [],
  loading,
  searchQuery,
  setSearchQuery,
  sortKey,
  sortOrder,
  onSort,
  onSelectAssociate,
}) {
  return (
    <DashboardSection
      title="Associate Performance Matrix"
      subtitle="Directory of associate target statuses and response analytics"
    >
      <PerformanceMatrix
        roster={roster}
        loading={loading}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortKey={sortKey}
        sortOrder={sortOrder}
        onSort={onSort}
        onSelectAssociate={onSelectAssociate}
      />
    </DashboardSection>
  );
}
