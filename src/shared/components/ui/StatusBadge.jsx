"use client";

export const LIFECYCLE_CONFIG = {
  New: { color: "blue", label: "New" },
  "Follow Up": { color: "amber", label: "Follow Up" },
  Closed: { color: "emerald", label: "Closed" },
  "Not Interested": { color: "slate", label: "Not Interested" },
};

const COLOR_CLASSES = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function StatusBadge({ state, icon, className = "" }) {
  const cfg = LIFECYCLE_CONFIG[state] ?? LIFECYCLE_CONFIG["New"];
  const colorClass = COLOR_CLASSES[cfg.color] || COLOR_CLASSES.blue;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 border rounded-md whitespace-nowrap ${colorClass} ${className}`}
    >
      {icon}
      {state || cfg.label}
    </span>
  );
}
