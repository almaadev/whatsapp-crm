"use client";

import { useState } from "react";
import { MoreHorizontal } from "lucide-react";

// Helper to format currency
const formatCurrency = (val) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
};

// 1. LEAD STATUS DONUT CHART
export function LeadStatusChart({ data = {} }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const keys = Object.keys(data);
  const values = Object.values(data);
  const total = values.reduce((acc, v) => acc + v, 0);

  const colors = {
    "New": "#3b82f6",          // Blue
    "Follow Up": "#f59e0b",    // Amber
    "Closed": "#10b981",       // Emerald
    "Not Interested": "#ef4444" // Rose
  };

  const ringRadius = 35;
  const circumference = 2 * Math.PI * ringRadius;

  let accumulatedPercent = 0;

  const segments = keys.map((key, idx) => {
    const val = data[key] || 0;
    const percentage = total > 0 ? val / total : 0;
    const strokeDash = `${percentage * circumference} ${circumference}`;
    const strokeOffset = circumference - (accumulatedPercent * circumference);
    accumulatedPercent += percentage;

    return {
      key,
      val,
      percentage: Math.round(percentage * 100),
      strokeDash,
      strokeOffset,
      color: colors[key] || "#cbd5e1",
    };
  });

  return (
    <div className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-6 flex flex-col items-center justify-between h-[380px] lg:h-[450px] w-full transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group">
      <div className="w-full flex justify-between items-start mb-2 border-b border-slate-50 pb-2">
        <div className="text-left">
          <h4 className="font-extrabold text-slate-800 text-[14px] leading-tight">Lead Lifecycle Distribution</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Segment breakdown</p>
        </div>
        <button className="p-1 text-slate-400 hover:text-slate-655 hover:bg-slate-55 rounded-lg transition-all">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="relative w-48 h-48 flex items-center justify-center">
        {total === 0 ? (
          // Empty State Donut
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r={ringRadius}
              fill="transparent"
              stroke="#e2e8f0"
              strokeWidth="10"
            />
          </svg>
        ) : (
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            {segments.map((seg, idx) => (
              <circle
                key={seg.key}
                cx="50"
                cy="50"
                r={ringRadius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={hoveredIdx === idx ? "12" : "10"}
                strokeDasharray={seg.strokeDash}
                strokeDashoffset={seg.strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            ))}
          </svg>
        )}

        <div className="absolute flex flex-col items-center justify-center text-center select-none bg-white rounded-full w-[110px] h-[110px] shadow-sm">
          {hoveredIdx !== null ? (
            <>
              <span className="text-[18px] font-extrabold text-slate-800">
                {segments[hoveredIdx].val}
              </span>
              <span
                className="text-[9px] font-extrabold uppercase tracking-wider"
                style={{ color: segments[hoveredIdx].color }}
              >
                {segments[hoveredIdx].key}
              </span>
              <span className="text-[10px] font-bold text-slate-450 mt-0.5">
                {segments[hoveredIdx].percentage}%
              </span>
            </>
          ) : (
            <>
              <span className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">
                {total}
              </span>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                Total Leads
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 w-full mt-2">
        {segments.map((seg, idx) => (
          <div
            key={seg.key}
            className={`flex items-center gap-2 p-1.5 rounded-xl border border-transparent transition-all cursor-pointer ${
              hoveredIdx === idx ? "bg-slate-50 border-slate-100" : ""
            }`}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0 border border-white shadow-sm"
              style={{ backgroundColor: seg.color }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-700 truncate leading-none mb-1">
                {seg.key}
              </p>
              <p className="text-[9px] font-bold text-slate-400 leading-none">
                {seg.val} ({seg.percentage}%)
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 2. DAILY CLOSURES LINE CHART (LAST 30 DAYS)
export function DailyClosuresChart({ data = [] }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  const width = 600;
  const height = 310;
  const padding = { top: 25, right: 30, bottom: 40, left: 40 };

  const values = data.map((d) => d.count);
  const maxVal = Math.max(5, ...values);

  const getX = (idx) => {
    if (data.length <= 1) return padding.left;
    return padding.left + (idx / (data.length - 1)) * (width - padding.left - padding.right);
  };

  const getY = (val) => {
    return padding.top + (1 - val / maxVal) * (height - padding.top - padding.bottom);
  };

  // Generate Path Data
  let linePath = "";
  let areaPath = "";

  if (data.length > 0) {
    const points = data.map((d, i) => `${getX(i)},${getY(d.count)}`);
    linePath = `M ${points.join(" L ")}`;
    areaPath = `${linePath} L ${getX(data.length - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`;
  }

  // Y-axis grid markers
  const gridLines = [];
  const divisions = 4;
  for (let i = 0; i <= divisions; i++) {
    const val = Math.round((maxVal / divisions) * i);
    gridLines.push({ val, y: getY(val) });
  }

  return (
    <div className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-6 flex flex-col justify-between h-[380px] lg:h-[450px] w-full transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-2">
        <div>
          <h4 className="font-extrabold text-slate-800 text-[14px] leading-tight">Daily Closures Pipeline</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Timeline history</p>
        </div>
        <div className="flex items-center gap-2">
          {hoveredPoint && (
            <div className="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-[10px] font-black border border-slate-700 shadow-lg animate-fade-in shrink-0">
              {hoveredPoint.date}: <span className="text-emerald-400">{hoveredPoint.count} closed</span>
            </div>
          )}
          <button className="p-1 text-slate-400 hover:text-slate-655 hover:bg-slate-55 rounded-lg transition-all">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-0">
        {data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">
            No closures recorded in this timeframe
          </div>
        ) : (
          <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="closuresAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines */}
            {gridLines.map((line, idx) => (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={line.y}
                  x2={width - padding.right}
                  y2={line.y}
                  stroke="#f1f5f9"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 10}
                  y={line.y + 3}
                  fill="#94a3b8"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="end"
                >
                  {line.val}
                </text>
              </g>
            ))}

            {/* Area Path */}
            <path d={areaPath} fill="url(#closuresAreaGradient)" />

            {/* Line Path */}
            <path
              d={linePath}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Interactive Data Nodes */}
            {data.map((d, i) => {
              const cx = getX(i);
              const cy = getY(d.count);
              const isHovered = hoveredPoint && hoveredPoint.index === i;

              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={isHovered ? "5" : "3"}
                  fill={isHovered ? "#10b981" : "#ffffff"}
                  stroke="#10b981"
                  strokeWidth={isHovered ? "2.5" : "1.5"}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredPoint({ ...d, index: i })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
              );
            })}

            {/* X-axis indicators */}
            {data.filter((_, idx) => idx % 6 === 0 || idx === data.length - 1).map((d, idx) => {
              const realIndex = data.indexOf(d);
              const cx = getX(realIndex);
              return (
                <text
                  key={idx}
                  x={cx}
                  y={height - padding.bottom + 18}
                  fill="#94a3b8"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {d.date}
                </text>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}

// 3. ASSOCIATE COMPARISON HORIZONTAL BAR CHART
export function AssociateComparisonChart({ data = [] }) {
  const maxVal = Math.max(1, ...data.map((d) => d.closed));

  return (
    <div className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-6 flex flex-col justify-between h-[380px] lg:h-[450px] w-full transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 overflow-hidden">
      <div className="flex justify-between items-start border-b border-slate-50 pb-2 mb-3">
        <div>
          <h4 className="font-extrabold text-slate-800 text-[14px] leading-tight">Associate Performance</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Closed conversions</p>
        </div>
        <button className="p-1 text-slate-400 hover:text-slate-655 hover:bg-slate-55 rounded-lg transition-all">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1 custom-scrollbar">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-400 font-bold text-xs">
            No associate data available
          </div>
        ) : (
          data.map((item, idx) => {
            const percentage = Math.round((item.closed / maxVal) * 100);
            return (
              <div key={idx} className="group/row flex flex-col gap-1.5 select-none">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-extrabold text-slate-700">{item.name}</span>
                  <span className="font-black text-[#00a884] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 shadow-inner transition-all text-[10px]">
                    {item.closed} Closed
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200/50 shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 shadow-md"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// 4. MONTHLY PERFORMANCE COMPARISON AREA CHART
export function MonthlyPerformanceChart({ data = [] }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const width = 600;
  const height = 310;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };

  const createdVals = data.map((d) => d.created || 0);
  const closedVals = data.map((d) => d.closed || 0);
  const followUpVals = data.map((d) => d.followUp || 0);
  const maxVal = Math.max(5, ...createdVals, ...closedVals, ...followUpVals);

  const getX = (idx) => {
    if (data.length <= 1) return padding.left;
    return padding.left + (idx / (data.length - 1)) * (width - padding.left - padding.right);
  };

  const getY = (val) => {
    return padding.top + (1 - val / maxVal) * (height - padding.top - padding.bottom);
  };

  // Generate curves helper
  const getPathData = (vals, isArea) => {
    if (vals.length === 0) return "";
    const points = vals.map((val, idx) => `${getX(idx)},${getY(val)}`);
    const linePath = `M ${points.join(" L ")}`;
    if (isArea) {
      return `${linePath} L ${getX(vals.length - 1)},${height - padding.bottom} L ${getX(0)},${height - padding.bottom} Z`;
    }
    return linePath;
  };

  const gridLines = [];
  const divisions = 4;
  for (let i = 0; i <= divisions; i++) {
    const val = Math.round((maxVal / divisions) * i);
    gridLines.push({ val, y: getY(val) });
  }

  return (
    <div className="bg-white rounded-[18px] border border-slate-200 shadow-sm p-6 flex flex-col justify-between h-[380px] lg:h-[450px] w-full transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-3 border-b border-slate-50 pb-2">
        <div>
          <h4 className="font-extrabold text-slate-800 text-[14px] leading-tight">Monthly Trends</h4>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Leads Lifecycle Pipeline</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Created</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Follow Ups</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Closed</span>
          </div>
          <button className="p-1 text-slate-400 hover:text-slate-655 hover:bg-slate-55 rounded-lg transition-all ml-1">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 w-full relative min-h-0">
        {data.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-xs">
            No historical logs found
          </div>
        ) : (
          <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="areaCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="areaClosed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="areaFollowUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Horizontal Gridlines */}
            {gridLines.map((line, idx) => (
              <g key={idx}>
                <line
                  x1={padding.left}
                  y1={line.y}
                  x2={width - padding.right}
                  y2={line.y}
                  stroke="#f1f5f9"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 10}
                  y={line.y + 3}
                  fill="#94a3b8"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="end"
                >
                  {line.val}
                </text>
              </g>
            ))}

            {/* Translucent Areas */}
            <path d={getPathData(createdVals, true)} fill="url(#areaCreated)" />
            <path d={getPathData(followUpVals, true)} fill="url(#areaFollowUp)" />
            <path d={getPathData(closedVals, true)} fill="url(#areaClosed)" />

            {/* Colored Paths */}
            <path
              d={getPathData(createdVals, false)}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d={getPathData(followUpVals, false)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d={getPathData(closedVals, false)}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Vertically Aligned Hover Overlay Guideline */}
            {hoveredIdx !== null && (
              <line
                x1={getX(hoveredIdx)}
                y1={padding.top}
                x2={getX(hoveredIdx)}
                y2={height - padding.bottom}
                stroke="#64748b"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
            )}

            {/* Hotspots for Tooltips */}
            {data.map((d, i) => {
              const cx = getX(i);
              return (
                <rect
                  key={i}
                  x={cx - 15}
                  y={padding.top}
                  width="30"
                  height={height - padding.top - padding.bottom}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              );
            })}

            {/* X-axis labels */}
            {data.map((d, i) => (
              <text
                key={i}
                x={getX(i)}
                y={height - padding.bottom + 18}
                fill="#94a3b8"
                fontSize="9"
                fontWeight="bold"
                textAnchor="middle"
              >
                {d.month.split(" ")[0]}
              </text>
            ))}
          </svg>
        )}
      </div>

      {/* Dynamic Popover Tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="flex justify-between items-center bg-slate-900 border border-slate-700 shadow-2xl px-3 py-1.5 rounded-lg text-[9px] font-black text-white tracking-wide mt-2">
          <span className="text-slate-400 mr-2 uppercase">{data[hoveredIdx].month}:</span>
          <div className="flex gap-3">
            <span className="text-blue-400">CREATED: {data[hoveredIdx].created}</span>
            <span className="text-amber-400">FOLLOW UP: {data[hoveredIdx].followUp}</span>
            <span className="text-emerald-400">CLOSED: {data[hoveredIdx].closed}</span>
          </div>
        </div>
      )}
    </div>
  );
}
