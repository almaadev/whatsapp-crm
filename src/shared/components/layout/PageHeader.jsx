"use client";

import { Menu } from "lucide-react";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";

export default function PageHeader({ title, subtitle, icon: Icon, actions, children }) {
  const { setMobileOpen } = useCrmLayout();

  return (
    <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 shadow-sm gap-4 select-none">
      <div className="flex items-center gap-3 w-full md:w-auto">
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            {Icon && <Icon className="text-[var(--brand-primary)]" size={24} />}
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5 ml-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {(actions || children) && (
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {actions}
          {children}
        </div>
      )}
    </header>
  );
}
