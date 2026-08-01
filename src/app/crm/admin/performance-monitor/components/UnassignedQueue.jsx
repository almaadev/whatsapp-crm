"use client";

import { useState } from "react";
import { UserCheck, Clock, MessageSquare, AlertCircle } from "lucide-react";
import { chatService } from "@/features/chat/services/chatService";
import { toast } from "react-toastify";

export default function UnassignedQueue({ queue = [], associates = [], onRefresh, loading }) {
  const [assigningPhone, setAssigningPhone] = useState(null);

  const handleAssign = async (customerPhone, associate) => {
    try {
      await chatService.forwardLead({
        customerPhone,
        targetPhone: associate.phone || "",
        message: "Allocated by Admin from Operations Command",
        associateName: associate.name,
        role: "admin",
      });
      toast.success(`Assigned client to ${associate.name}`);
      setAssigningPhone(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      toast.error("Failed to forward client.");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] shadow-sm overflow-hidden select-none">
      <div className="overflow-x-auto w-full custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-slate-50/50 text-slate-450 text-[10px] uppercase font-black tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-5 py-3.5">Customer</th>
              <th className="px-5 py-3.5">Phone</th>
              <th className="px-5 py-3.5">Lead Type</th>
              <th className="px-5 py-3.5 text-center">Waiting Time</th>
              <th className="px-5 py-3.5 text-center">Unread Messages</th>
              <th className="px-5 py-3.5">Latest Message Preview</th>
              <th className="px-5 py-3.5 text-right">Assign Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
            {loading ? (
              [...Array(3)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan="7" className="px-5 py-4">
                    <div className="w-full h-7 bg-slate-100 rounded-lg" />
                  </td>
                </tr>
              ))
            ) : queue.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-400 font-bold">
                  Queue is clear! No unassigned customers waiting.
                </td>
              </tr>
            ) : (
              queue.map((item) => {
                // Determine wait warning classes
                let waitBadgeClass = "bg-blue-50 text-blue-700 border-blue-150";
                let waitIconClass = "text-blue-500";
                let isOverdue = false;

                if (item.waitingTimeMin >= 60) {
                  waitBadgeClass = "bg-rose-50 text-rose-700 border-rose-200 animate-pulse";
                  waitIconClass = "text-rose-600";
                  isOverdue = true;
                } else if (item.waitingTimeMin >= 30) {
                  waitBadgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                  waitIconClass = "text-amber-600";
                  isOverdue = true;
                } else if (item.waitingTimeMin >= 15) {
                  waitBadgeClass = "bg-orange-50 text-orange-700 border-orange-200";
                  waitIconClass = "text-orange-600";
                }

                return (
                  <tr key={item.phone} className={`hover:bg-slate-50/50 transition-colors ${isOverdue ? "bg-rose-50/10" : ""}`}>
                    <td className="px-5 py-3.5 font-extrabold text-slate-800 flex items-center gap-2">
                      {isOverdue && <AlertCircle size={14} className="text-rose-650 shrink-0" />}
                      <span className="truncate max-w-[150px]">{item.name}</span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-500">{item.phone}</td>
                    <td className="px-5 py-3.5 text-slate-600">{item.leadType}</td>

                    {/* Waiting time badge */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black border ${waitBadgeClass}`}>
                        <Clock size={10} className={waitIconClass} />
                        {item.waitingTimeText}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <span className="bg-rose-50 text-rose-700 border border-rose-100 px-2 py-0.5 rounded-md font-black text-[10px]">
                        {item.unreadCount} unread
                      </span>
                    </td>

                    {/* Message Preview */}
                    <td className="px-5 py-3.5 text-slate-450 max-w-[300px]">
                      <p className="truncate font-semibold italic flex items-center gap-1.5">
                        <MessageSquare size={12} className="shrink-0 text-slate-350" />
                        {item.latestMessage || "No message payload."}
                      </p>
                    </td>

                    {/* Assign control */}
                    <td className="px-5 py-3.5 text-right relative" onClick={(e) => e.stopPropagation()}>
                      {assigningPhone === item.phone ? (
                        <div className="inline-flex flex-col gap-1 items-end z-20">
                          <select
                            onChange={(e) => {
                              const assoc = associates.find((a) => (a.id || a._id) === e.target.value);
                              if (assoc) handleAssign(item.phone, assoc);
                            }}
                            defaultValue=""
                            className="px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[#00a884] shadow-sm cursor-pointer"
                          >
                            <option value="" disabled>Select Associate...</option>
                            {associates.map((a) => (
                              <option key={a.id || a._id} value={a.id || a._id}>
                                {a.name} ({a.branch})
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => setAssigningPhone(null)}
                            className="text-[9px] font-black text-rose-600 hover:text-rose-800 underline uppercase mt-0.5"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setAssigningPhone(item.phone)}
                          className="inline-flex items-center gap-1 bg-slate-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm"
                        >
                          <UserCheck size={12} /> Assign Client
                        </button>
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
