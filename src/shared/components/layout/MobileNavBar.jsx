"use client";

import { Menu } from "lucide-react";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";

export default function MobileNavBar({ title }) {
  const { setMobileOpen } = useCrmLayout();

  return (
    <div className="md:hidden h-14 bg-white border-b border-slate-200 flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
      <button
        onClick={() => setMobileOpen(true)}
        className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        aria-label="Open menu"
      >
        <Menu size={24} />
      </button>
      {title ? (
        <span className="font-semibold text-slate-700 text-sm truncate">{title}</span>
      ) : (
        <div className="w-20 flex items-center justify-center shrink-0 p-1">
          <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" draggable={false} />
        </div>
      )}
      <div className="w-8" />
    </div>
  );
}
