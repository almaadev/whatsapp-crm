"use client";

import { X, Briefcase, Activity, Clock, CheckCircle, Users, ExternalLink } from "lucide-react";
import Link from "next/link";

export default function BranchDetailsDrawer({
  isOpen,
  onClose,
  branch,
  roster = [],
  unassignedQueue = [],
}) {
  if (!branch) return null;

  // Filter associates belonging to this branch name
  const branchAssociates = roster.filter(
    (r) => r.branch?.toLowerCase() === branch.branchName?.toLowerCase()
  );

  const onlineAssociates = branchAssociates.filter((r) => r.presenceStatus !== "Offline");
  const busyAssociates = branchAssociates.filter((r) => r.presenceStatus === "Busy");
  const offlineAssociates = branchAssociates.filter((r) => r.presenceStatus === "Offline");

  // Aggregate active client locks inside this branch
  const activeLocks = branchAssociates
    .filter((r) => !!r.activeLock)
    .map((r) => ({
      associateName: r.name,
      customerPhone: r.activeLock.phone,
      lockedMinutes: r.activeLock.lockedMinutes,
    }));

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Slide-in Drawer Container */}
      <div
        className={`fixed inset-y-0 right-0 w-full sm:w-[520px] bg-slate-50 shadow-2xl border-l border-slate-200 z-[1000] flex flex-col h-full transition-transform duration-300 ease-out transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-900 text-[#00a884] rounded-2xl flex items-center justify-center font-black text-lg border border-slate-250 shadow-md">
              📍
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                {branch.branchName} Branch
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
                Operations Inspection
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all border border-transparent hover:border-slate-200 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Branch Operations Score Widget */}
          <div className="bg-white rounded-2xl border border-slate-250 p-5 space-y-4 shadow-sm">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Operational Performance
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2.5">
                <Users size={16} className="text-slate-400 shrink-0" />
                <span>Roster Strength: <strong className="text-slate-850 font-black">{branchAssociates.length}</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle size={16} className="text-slate-400 shrink-0" />
                <span>Closed Today: <strong className="text-slate-850 font-black">{branch.closedToday}</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <Clock size={16} className="text-slate-400 shrink-0" />
                <span>Waiting Clients: <strong className="text-slate-850 font-black">{branch.waitingCount}</strong></span>
              </div>
              <div className="flex items-center gap-2.5">
                <Activity size={16} className="text-slate-400 shrink-0" />
                <span>Avg Reply delay: <strong className="text-slate-850 font-black">{branch.avgReplyTimeText}</strong></span>
              </div>
            </div>
            <div className="w-full bg-slate-100 border border-slate-150/30 rounded-full h-2 overflow-hidden shadow-inner pt-0">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full shadow"
                style={{ width: `${Math.min(100, branch.targetProgress)}%` }}
              />
            </div>
          </div>

          {/* User Presence details */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              User Roster & Presence
            </h4>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold border-b border-slate-100 pb-3 mb-2">
                <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-xl">
                  <p className="text-emerald-700 text-[14px] font-black">{onlineAssociates.length}</p>
                  <p className="text-emerald-500 text-[9px] uppercase tracking-wider mt-0.5">Online</p>
                </div>
                <div className="bg-amber-50 border border-amber-100 p-2 rounded-xl">
                  <p className="text-amber-700 text-[14px] font-black">{busyAssociates.length}</p>
                  <p className="text-amber-500 text-[9px] uppercase tracking-wider mt-0.5">Busy</p>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-2 rounded-xl">
                  <p className="text-slate-700 text-[14px] font-black">{offlineAssociates.length}</p>
                  <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-0.5">Offline</p>
                </div>
              </div>

              <div className="space-y-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                {branchAssociates.map((assoc) => (
                  <div
                    key={assoc.id}
                    className="flex justify-between items-center bg-slate-50 border border-slate-100 p-2 rounded-xl text-xs font-semibold text-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        assoc.presenceStatus === "Online" || assoc.presenceStatus === "Idle"
                          ? "bg-emerald-500 animate-pulse"
                          : assoc.presenceStatus === "Busy"
                          ? "bg-amber-500"
                          : "bg-slate-400"
                      }`} />
                      <span className="font-extrabold text-slate-800">{assoc.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 capitalize">{assoc.role.replace("_", " ")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Active Conversation Locks */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Locked Pipeline ({activeLocks.length} locked)
            </h4>
            {activeLocks.length === 0 ? (
              <p className="text-xs italic text-slate-400">No active customer locks recorded</p>
            ) : (
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                {activeLocks.map((lock, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-850">
                        {lock.customerPhone.replace("whatsapp:", "")}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">
                        Handler: {lock.associateName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-50 border border-amber-100 text-amber-700 px-2 py-0.5 rounded-md font-black text-[10px]">
                        Active {lock.lockedMinutes}m
                      </span>
                      <Link
                        href={`/crm/chat?phone=${lock.customerPhone}`}
                        className="p-1 text-slate-400 hover:text-[#00a884] rounded-lg transition-all"
                      >
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
