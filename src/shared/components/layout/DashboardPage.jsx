"use client";

import PageHeader from "@/shared/components/layout/PageHeader";

export default function DashboardPage({
  title,
  subtitle,
  icon,
  actions,
  children,
  maxWidth = "1800px",
  headerChildren,
  noPadding = false,
}) {
  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative ">
      <PageHeader title={title} subtitle={subtitle} icon={icon} actions={actions}>
        {headerChildren}
      </PageHeader>
      <main
        className={`flex-1 overflow-y-auto custom-scrollbar ${noPadding ? "" : "p-4 md:p-6 lg:p-8"}`}
      >
        <div className="mx-auto w-full space-y-6 md:space-y-8" style={{ maxWidth }}>
          {children}
        </div>
      </main>
    </div>
  );
}
