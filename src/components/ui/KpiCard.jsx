"use client";

import { AnimatedCount } from "@/hooks/useCountUp";

const COLOR_STYLES = {
  rose: {
    gradient: "from-rose-100/50",
    icon: "text-rose-600 border-rose-200",
    hover: "hover:border-rose-300",
  },
  amber: {
    gradient: "from-amber-100/50",
    icon: "text-amber-600 border-amber-200",
    hover: "hover:border-amber-300",
  },
  emerald: {
    gradient: "from-emerald-100/50",
    icon: "text-emerald-600 border-emerald-200",
    hover: "hover:border-emerald-300",
  },
  blue: {
    gradient: "from-blue-100/50",
    icon: "text-blue-600 border-blue-200",
    hover: "hover:border-blue-300",
  },
};

export default function KpiCard({ title, value, icon, color = "blue", sub, alert, loading }) {
  const styles = COLOR_STYLES[color] || COLOR_STYLES.blue;

  return (
    <div
      className={`bg-white rounded-2xl p-5 border border-slate-200 shadow-sm relative overflow-hidden transition-all hover:shadow-md ${styles.hover} group ${alert ? "ring-1 ring-rose-400" : ""}`}
    >
      <div
        className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${styles.gradient} to-transparent opacity-50 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-125`}
      />
      <div className="flex justify-between items-start relative z-10">
        <div>
          <h3 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">
            {title}
          </h3>
          {loading ? (
            <div className="w-16 h-8 bg-slate-100 rounded-lg animate-pulse my-1" />
          ) : (
            <span className="text-3xl font-extrabold text-slate-800 tracking-tight">
              <AnimatedCount end={value} />
            </span>
          )}
          <p
            className={`text-[10px] font-bold mt-2 uppercase tracking-wider ${alert ? "text-rose-500 animate-pulse" : "text-slate-400"}`}
          >
            {sub}
          </p>
        </div>
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-50 border ${styles.icon}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
