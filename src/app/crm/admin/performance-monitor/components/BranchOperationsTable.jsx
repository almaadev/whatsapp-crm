"use client";

import { Eye, ShieldAlert, Award, ShieldCheck } from "lucide-react";

export default function BranchOperationsTable({
  branches = [],
  loading,
  onInspectBranch,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-[12px] shadow-sm overflow-hidden select-none transition-all duration-200 hover:shadow-md">
      <div className="overflow-x-auto w-full custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-slate-50/50 text-slate-450 text-[10px] uppercase font-black tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-5 py-3.5">Branch</th>
              <th className="px-5 py-3.5 text-center">New Leads Closed</th>
              <th className="px-5 py-3.5 text-center">Existing Leads Closed</th>
              <th className="px-5 py-3.5 text-center">Total Closed</th>
              <th className="px-5 py-3.5 text-center">Conversion Rate</th>
              <th className="px-5 py-3.5 text-right print:hidden">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
            {loading ? (
              [...Array(2)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="6" className="px-5 py-4">
                    <div className="w-full h-7 bg-slate-100 rounded-lg" />
                  </td>
                </tr>
              ))
            ) : branches.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-8 text-center text-slate-400 font-bold">
                  No branch metrics matching search scope.
                </td>
              </tr>
            ) : (
              branches.map((b) => {
                return (
                  <tr
                    key={b.branchId}
                    className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    onClick={() => onInspectBranch(b)}
                  >
                    {/* Branch Title */}
                    <td className="px-5 py-3.5 font-extrabold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-100 shadow" />
                        <span className="group-hover:text-[#00a884] transition-colors">{b.branchName}</span>
                      </div>
                    </td>

                    {/* New Leads Closed */}
                    <td className="px-5 py-3.5 text-center text-emerald-600 font-extrabold">
                      {b.newLeadsClosed || 0}
                    </td>

                    {/* Existing Leads Closed */}
                    <td className="px-5 py-3.5 text-center text-blue-600 font-extrabold">
                      {b.existingLeadsClosed || 0}
                    </td>

                    {/* Total Closed */}
                    <td className="px-5 py-3.5 text-center text-slate-800 font-extrabold">
                      {b.totalClosed || 0}
                    </td>

                    {/* Conversion Rate */}
                    <td className="px-5 py-3.5 text-center font-black">
                      <span className={
                        b.conversionRate >= 75 ? "text-emerald-600" :
                        b.conversionRate >= 50 ? "text-amber-600" : "text-rose-500"
                      }>
                        {b.conversionRate || 0}%
                      </span>
                    </td>

                    {/* Inspect action trigger */}
                    <td className="px-5 py-3.5 text-right print:hidden" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onInspectBranch(b)}
                        className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm"
                      >
                        <Eye size={12} /> Inspect
                      </button>
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
