"use client";

import { Award, Users, CheckCircle, Clock, TrendingUp } from "lucide-react";

const formatLakhs = (val) => {
  // Format as Lakhs (e.g., ₹2.4L)
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(1)}L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function LeaderboardCard({ leaderboard = [], loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-[18px] p-6 border border-slate-200 shadow-sm animate-pulse space-y-4 h-[210px]"
          >
            <div className="flex justify-between items-center">
              <div className="w-10 h-10 rounded-xl bg-slate-100" />
              <div className="w-14 h-6 bg-slate-100 rounded-lg" />
            </div>
            <div className="space-y-2">
              <div className="w-24 h-4 bg-slate-150 rounded-md" />
              <div className="w-36 h-3 bg-slate-100 rounded-md" />
            </div>
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="h-7 bg-slate-100 rounded-lg" />
              <div className="h-7 bg-slate-100 rounded-lg" />
              <div className="h-7 bg-slate-100 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="bg-white rounded-[18px] border border-slate-200 p-8 shadow-sm flex flex-col items-center justify-center text-center gap-3 h-[210px] mb-8">
        <div className="w-12 h-12 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-center text-slate-400">
          <Award size={24} />
        </div>
        <div>
          <h5 className="text-xs font-black text-slate-700 uppercase tracking-wider">No Standings Available</h5>
          <p className="text-[11px] text-slate-400 mt-1">Data is still aggregating for this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {leaderboard.map((item) => {
        const medal = item.rank === 1 ? "🥇" : item.rank === 2 ? "🥈" : "🥉";
        const medalBg =
          item.rank === 1
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : item.rank === 2
            ? "bg-slate-50 text-slate-600 border-slate-200"
            : "bg-orange-50/50 text-orange-700 border-orange-250/50";

        const trendIsPositive = item.trend ? !item.trend.includes("-") && !item.trend.includes("↓") : true;
        const trendClass = trendIsPositive
          ? "text-emerald-600 bg-emerald-50 border-emerald-100"
          : "text-rose-600 bg-rose-50 border-rose-100";

        return (
          <div
            key={item.rank}
            className="group bg-white rounded-[18px] p-6 border border-slate-200 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between h-[225px] w-full"
          >
            {/* Header: rank and score */}
            <div className="flex justify-between items-center">
              <div
                className={`w-10 h-10 rounded-[12px] flex items-center justify-center font-black text-xl border shadow-sm ${medalBg}`}
              >
                {medal}
              </div>
              <div className="flex items-center gap-1.5">
                {item.trend && item.trend !== "↑ 0%" && item.trend !== "↓ 0%" && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${trendClass}`}>
                    {item.trend}
                  </span>
                )}
                <span className="text-[20px] font-black text-slate-800 tracking-tight leading-none">
                  {item.score}%
                </span>
              </div>
            </div>

            {/* Associate Bio */}
            <div className="mt-3.5 space-y-0.5">
              <h4 className="text-[15px] font-black text-slate-800 leading-tight group-hover:text-[#00a884] transition-colors truncate">
                {item.name}
              </h4>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {item.role} / {item.branch}
              </p>
            </div>

            {/* Score Progress Meter */}
            <div className="w-full bg-slate-100 border border-slate-150/50 rounded-full h-2 mt-3 overflow-hidden shadow-inner">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  item.rank === 1
                    ? "bg-gradient-to-r from-amber-400 to-yellow-500"
                    : item.rank === 2
                    ? "bg-slate-400"
                    : "bg-amber-600"
                }`}
                style={{ width: `${item.score}%` }}
              />
            </div>

            {/* Sub-grid of metrics */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
              <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-150/30 p-2 rounded-xl text-center group-hover:bg-white transition-colors">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 leading-none">
                  Closed
                </span>
                <span className="text-xs font-black text-slate-850 leading-none">
                  {item.closedCount}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-150/30 p-2 rounded-xl text-center group-hover:bg-white transition-colors">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 leading-none">
                  Customers
                </span>
                <span className="text-xs font-black text-slate-850 leading-none">
                  {item.customersCount}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-150/30 p-2 rounded-xl text-center group-hover:bg-white transition-colors">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 leading-none">
                  Response
                </span>
                <span className="text-[10px] font-black text-slate-850 leading-none truncate max-w-full">
                  {item.avgResponseText}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
