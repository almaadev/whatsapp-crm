"use client";

import { Eye, User, Users, ChevronRight } from "lucide-react";

const formatCurrency = (val) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function PerformanceMatrix({
  roster = [],
  loading,
  searchQuery,
  setSearchQuery,
  sortKey,
  sortOrder,
  onSort,
  onSelectAssociate,
}) {
  const getSortIndicator = (key) => {
    if (sortKey !== key) return null;
    return sortOrder === "asc" ? " ⬆️" : " ⬇️";
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] shadow-sm overflow-hidden flex flex-col w-full select-none transition-all duration-200 hover:shadow-md">
      {/* Table Header Controls */}
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/20 print:hidden">
        <div>
          <h3 className="font-extrabold text-slate-800 text-[13px] leading-tight">Performance Matrix</h3>
          <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest mt-1">
            Associate operational indicators
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search associate name or branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] focus:bg-white transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Responsive Table Scroll Container */}
      <div className="overflow-x-auto w-full custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-slate-50/50 text-slate-450 text-[10px] uppercase font-black tracking-wider border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="px-5 py-3.5 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort("name")}>
                Associate{getSortIndicator("name")}
              </th>
              <th className="px-5 py-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort("assignedLeads")}>
                Assigned{getSortIndicator("assignedLeads")}
              </th>
              <th className="px-5 py-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort("newLeadClosedCount")}>
                New Leads Closed{getSortIndicator("newLeadClosedCount")}
              </th>
              <th className="px-5 py-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort("existingLeadClosedCount")}>
                Existing Leads Closed{getSortIndicator("existingLeadClosedCount")}
              </th>
              <th className="px-5 py-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort("followUpsCount")}>
                Follow Ups{getSortIndicator("followUpsCount")}
              </th>
              <th className="px-5 py-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort("pendingCount")}>
                Pending{getSortIndicator("pendingCount")}
              </th>
              <th className="px-5 py-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort("closedCount")}>
                Total Closed{getSortIndicator("closedCount")}
              </th>
              <th className="px-5 py-3.5 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => onSort("conversionPercentage")}>
                Conversion %{getSortIndicator("conversionPercentage")}
              </th>
              <th className="px-5 py-3.5 text-right print:hidden">Quick Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="9" className="px-5 py-4.5">
                    <div className="w-full h-7 bg-slate-100 rounded-lg" />
                  </td>
                </tr>
              ))
            ) : roster.length === 0 ? (
              <tr>
                <td colSpan="9" className="p-8 text-center text-slate-400 font-bold">
                  No roster users match selected filters.
                </td>
              </tr>
            ) : (
              roster.map((associate) => {
                return (
                  <tr
                    key={associate.id}
                    className="hover:bg-slate-50/50 cursor-pointer transition-colors group"
                    onClick={() => onSelectAssociate(associate)}
                  >
                    {/* Associate Avatar */}
                    <td className="px-5 py-3.5 font-extrabold text-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-100 border border-slate-200 rounded-full flex items-center justify-center font-black text-slate-655 text-[11px] shadow-sm shrink-0">
                          {associate.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[150px] group-hover:text-[#00a884] transition-colors">
                          {associate.name}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-center font-extrabold text-slate-700">
                      {associate.assignedLeads || 0}
                    </td>

                    <td className="px-5 py-3.5 text-center text-emerald-600 font-extrabold">
                      {associate.newLeadClosedCount || 0}
                    </td>

                    <td className="px-5 py-3.5 text-center text-blue-600 font-extrabold">
                      {associate.existingLeadClosedCount || 0}
                    </td>

                    <td className="px-5 py-3.5 text-center text-slate-600">
                      {associate.followUpsCount || 0}
                    </td>

                    <td className="px-5 py-3.5 text-center text-rose-500 font-bold">
                      {associate.pendingCount || 0}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <span className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md font-extrabold text-[10px]">
                        {associate.closedCount || 0}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-center font-black">
                      <span className={
                        associate.conversionPercentage >= 75 ? "text-emerald-600" :
                        associate.conversionPercentage >= 50 ? "text-amber-600" : "text-rose-500"
                      }>
                        {associate.conversionPercentage || 0}%
                      </span>
                    </td>

                    {/* Action Column */}
                    <td className="px-5 py-3.5 text-right print:hidden" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => onSelectAssociate(associate)}
                          className="p-1 text-slate-400 hover:text-[#00a884] hover:bg-emerald-50 rounded-lg transition-all"
                          title="Quick View Drawer"
                        >
                          <Eye size={12} />
                        </button>
                        <a
                          href={`/crm/associate-management/${associate.id}`}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Open Profile Page"
                        >
                          <User size={12} />
                        </a>
                      </div>
                      <span className="group-hover:hidden text-slate-350">
                        <ChevronRight size={14} className="inline" />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
