"use client";

import Link from "next/link";
import { LayoutDashboard, TrendingUp, FileBarChart } from "lucide-react";

export default function DashboardTabs({ activeTab }) {
  const tabs = [
    {
      id: "general overview",
      label: "General Overview",
      href: "/crm/admin",
      icon: LayoutDashboard,
    },
    {
      id: "performance",
      label: "Performance Monitor",
      href: "/crm/admin/performance-monitor",
      icon: TrendingUp,
    },
    {
      id: "reports",
      label: "Reports & Export",
      href: "/crm/admin/reports",
      icon: FileBarChart,
    },
  ];

  return (
    <div className="w-full bg-white border-b border-slate-200 px-6 shrink-0 z-10 select-none">
      <div className="max-w-[1400px] mx-auto flex items-center  -mb-px">
        <div className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <Link key={tab.id} href={tab.href} className="outline-none">
                <div
                  className = {`flex items-center gap-2 py-3.5 px-1 border-b-2 font-bold text-sm transition-all duration-200 cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "border-[#00a884] text-[#00a884] scale-[1.02]"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  }`}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
