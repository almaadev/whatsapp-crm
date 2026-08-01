"use client";

import Link from "next/link";
import { MessageSquare, ExternalLink } from "lucide-react";

export default function LiveAssociateActivity({ activity = [], loading }) {
  return (
    <div className="bg-white border border-slate-200 rounded-[12px] shadow-sm overflow-hidden select-none">
      <div className="overflow-x-auto w-full custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead className="bg-slate-50/50 text-slate-450 text-[10px] uppercase font-black tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-5 py-3.5">Associate</th>
              <th className="px-5 py-3.5">Role</th>
              <th className="px-5 py-3.5">Department</th>
              <th className="px-5 py-3.5">Branch</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Current Customer</th>
              <th className="px-5 py-3.5">Lead Type</th>
              <th className="px-5 py-3.5 text-center">Active Since</th>
              <th className="px-5 py-3.5 text-center">Unread Messages</th>
              <th className="px-5 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="10" className="px-5 py-4">
                    <div className="w-full h-7 bg-slate-100 rounded-lg" />
                  </td>
                </tr>
              ))
            ) : activity.length === 0 ? (
              <tr>
                <td colSpan="10" className="p-8 text-center text-slate-400 font-bold">
                  No active handlers matching status parameters.
                </td>
              </tr>
            ) : (
              activity.map((item) => {
                const hasCustomer = !!item.currentCustomer;
                const statusStyles =
                  item.status === "Busy"
                    ? "bg-amber-50 text-amber-700 border-amber-200"
                    : item.status === "Idle" || item.status === "Online"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200";

                return (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Associate Info */}
                    <td className="px-5 py-3.5 font-extrabold text-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-slate-100 border border-slate-150 rounded-full flex items-center justify-center font-black text-slate-600 text-[11px] shadow-sm">
                          {item.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate max-w-[150px]">{item.name}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 capitalize text-slate-650">{item.role}</td>
                    <td className="px-5 py-3.5 capitalize text-slate-650">{item.department}</td>
                    <td className="px-5 py-3.5 text-slate-650">{item.branch}</td>

                    {/* Status badge */}
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border leading-none ${statusStyles}`}>
                        {item.status}
                      </span>
                    </td>

                    {/* Lock details */}
                    <td className="px-5 py-3.5 font-extrabold text-slate-800">
                      {hasCustomer ? (
                        <div className="flex flex-col">
                          <span className="truncate max-w-[160px]">{item.currentCustomer.name}</span>
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {item.currentCustomer.phone}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-bold">-</span>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-slate-600">
                      {hasCustomer ? item.currentCustomer.leadType : "-"}
                    </td>

                    <td className="px-5 py-3.5 text-center text-slate-600">
                      {hasCustomer ? (
                        <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                          {item.currentCustomer.activeSinceText}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      {hasCustomer && item.currentCustomer.unreadCount > 0 ? (
                        <span className="bg-rose-100 text-rose-700 px-2 py-0.5 rounded-md font-black text-[10px]">
                          {item.currentCustomer.unreadCount} unread
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Quick action button */}
                    <td className="px-5 py-3.5 text-right">
                      {hasCustomer ? (
                        <Link
                          href={`/crm/chat?phone=${item.currentCustomer.phone}`}
                          className="inline-flex items-center gap-1 bg-[#00a884] hover:bg-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all shadow-sm shadow-emerald-100"
                        >
                          Open Chat <ExternalLink size={10} />
                        </Link>
                      ) : (
                        <span className="text-slate-350 text-[10px] font-bold">No active conversation</span>
                      )}
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
