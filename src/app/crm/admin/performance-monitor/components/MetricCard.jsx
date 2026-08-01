"use client";

import { AnimatedCount } from "@/shared/hooks/useCountUp";

const COLOR_STYLES = {
  emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
  rose: "bg-rose-50 border-rose-100 text-rose-600",
  blue: "bg-blue-50 border-blue-100 text-blue-600",
  amber: "bg-amber-50 border-amber-100 text-amber-600",
  slate: "bg-slate-50 border-slate-200 text-slate-600",
};

export default function MetricCard({
  title,
  value,
  icon,
  color = "slate",
  sub,
  trend,
  onClick,
  active,
}) {
  const isClickable = typeof onClick === "function";

  const isEmpty =
    value === undefined ||
    value === null ||
    value === "" ||
    value === "N/A" ||
    value === "0 / 0" ||
    value === "₹0" ||
    (typeof value === "number" && isNaN(value));

  const displayValue = isEmpty ? "--" : value;
  const displaySub = isEmpty ? "No active data" : sub;

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-[12px] p-4 shadow-sm flex flex-col justify-between h-[135px] w-full select-none transition-all duration-200 ${
        isClickable ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : ""
      } ${
        active
          ? "border-[#00a884] ring-2 ring-[#00a884]/15"
          : "border-slate-200 hover:border-slate-350"
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">
            {title}
          </h4>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-[28px] font-black text-slate-800 tracking-tight leading-none">
              <AnimatedCount end={displayValue} />
            </span>
            {trend && trend !== "0%" && trend !== "+0%" && trend !== "-0%" && (
              <span className="text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 shrink-0">
                {trend}
              </span>
            )}
          </div>
        </div>

        {/* 44px container, 20px inside icon */}
        <div
          className={`w-[44px] h-[44px] rounded-[10px] flex items-center justify-center border shrink-0 shadow-sm ${COLOR_STYLES[color] || COLOR_STYLES.slate}`}
        >
          {icon}
        </div>
      </div>

      <div className="pt-2 border-t border-slate-50 mt-2">
        <p className="text-[11px] font-bold text-slate-400 truncate leading-none">
          {displaySub}
        </p>
      </div>
    </div>
  );
}
