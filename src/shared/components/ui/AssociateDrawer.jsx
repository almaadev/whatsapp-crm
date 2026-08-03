"use client";

import Link from "next/link";
import { X, User, Phone, Mail, Building, Briefcase, Activity, ExternalLink, Calendar, ShieldCheck, DollarSign, MessageSquare, Clock, Users } from "lucide-react";
import { getSystemEventDetails, formatEventDateTime } from "@/shared/utils/chatUtils";
import { resolveCustomerDisplayName, cleanPhoneNumber } from "@/shared/utils/customerResolver";

const formatCurrency = (val) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(val);
};

export default function AssociateDrawer({ isOpen, onClose, associate }) {
  if (!associate) return null;

  const today = associate.todayActivity || {
    customersHandled: 0,
    messagesSent: 0,
    followUps: 0,
    closed: 0,
    revenue: 0,
    avgResponse: "N/A",
  };

  const statusColor =
    associate.presenceStatus === "Online"
      ? "bg-emerald-500 text-emerald-50"
      : associate.presenceStatus === "Busy"
        ? "bg-amber-500 text-amber-50"
        : "bg-slate-400 text-slate-50";

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
        className={`fixed inset-y-0 right-0 w-full sm:w-[500px] bg-slate-50 shadow-2xl border-l border-slate-200 z-[1000] flex flex-col h-full transition-transform duration-300 ease-out transform ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Drawer Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-slate-900 text-[#00a884] rounded-2xl flex items-center justify-center font-black text-lg border border-slate-200 shadow-md">
              {associate.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight leading-tight">
                {associate.name}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-2 h-2 rounded-full ${associate.presenceStatus === "Online" ? "bg-emerald-500 animate-pulse" : associate.presenceStatus === "Busy" ? "bg-amber-500" : "bg-slate-400"}`} />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                  {associate.presenceStatus}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all border border-transparent hover:border-slate-200 active:scale-95 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Drawer Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Roster Information
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-slate-600">
              <div className="flex items-center gap-2.5">
                <Briefcase size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">{associate.role.replace("_", " ")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Building size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">{associate.branch}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">{associate.department}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Phone size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">{associate.phone}</span>
              </div>
              <div className="col-span-2 flex items-center gap-2.5 border-t border-slate-100 pt-3">
                <Mail size={16} className="text-slate-400 shrink-0" />
                <span className="truncate">{associate.email}</span>
              </div>
            </div>
          </div>

          {/* Pipeline & Lead Acquisition Metrics */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Pipeline & Acquisition Metrics
            </h4>
            <div className="grid grid-cols-2 gap-3.5">
              <ActivityWidget icon={<Users size={16} />} label="Total Assigned" value={associate.assignedLeads || 0} color="blue" />
              <ActivityWidget icon={<ShieldCheck size={16} />} label="New Leads Closed" value={associate.newLeadClosedCount || 0} color="emerald" />
              <ActivityWidget icon={<ShieldCheck size={16} />} label="Existing Leads Closed" value={associate.existingLeadClosedCount || 0} color="indigo" />
              <ActivityWidget icon={<Activity size={16} />} label="Active Leads" value={associate.customersCount || 0} color="purple" />
              <ActivityWidget icon={<Clock size={16} />} label="Pending Follow Ups" value={associate.pendingCount || 0} color="amber" />
              <ActivityWidget icon={<ShieldCheck size={16} />} label="Closed Leads" value={associate.closedCount || 0} color="rose" />
            </div>
          </div>

          {/* Today's Activity Dashboard */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                Today's Summary
              </h4>
              <span className="bg-emerald-50 text-[#00a884] text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border border-emerald-100/50">
                Live Stats
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              <ActivityWidget icon={<Users size={16} />} label="Managed" value={today.customersHandled} color="blue" />
              <ActivityWidget icon={<MessageSquare size={16} />} label="Sent Msgs" value={today.messagesSent} color="purple" />
              <ActivityWidget icon={<Clock size={16} />} label="Follow Ups" value={today.followUps} color="amber" />
              <ActivityWidget icon={<DollarSign size={16} />} label="Revenue" value={formatCurrency(today.revenue)} color="emerald" />
              <ActivityWidget icon={<ShieldCheck size={16} />} label="Closed Leads" value={today.closed} color="rose" />
              <ActivityWidget icon={<Activity size={16} />} label="Avg Response" value={today.avgResponse} color="indigo" />
            </div>
          </div>

          {/* Current Leads Links */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Assigned Pipeline ({associate.customersCount} active)
            </h4>
            {associate.currentCustomers?.length === 0 ? (
              <p className="text-xs italic text-slate-400">No leads currently assigned</p>
            ) : (
              <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                {associate.currentCustomers?.map((cust, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{cust.name}</p>
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {cust.phone.replace("whatsapp:", "")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cust.isClosed ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                        {cust.status}
                      </span>
                      <Link
                        href={`/crm/leads/${encodeURIComponent(cust.phone.replace("whatsapp:", ""))}`}
                        className="p-1 text-slate-400 hover:text-[#00a884] rounded-lg transition-all hover:bg-white border border-transparent hover:border-slate-200"
                      >
                        <ExternalLink size={12} />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Timeline Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              Recent Activity Timeline
            </h4>
            {associate.recentActivities?.length === 0 ? (
              <p className="text-xs italic text-slate-400">No recent activity logged</p>
            ) : (
              <div className="space-y-4 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                {associate.recentActivities?.map((act, idx) => {
                  const details = getSystemEventDetails(act);
                  return (
                    <div key={idx} className="flex gap-3 relative select-none">
                      <div className="w-7.5 h-7.5 rounded-xl bg-white border border-slate-100 shadow-sm flex items-center justify-center shrink-0 z-10">
                        {details.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-slate-800 leading-tight">
                            {details.title}
                          </p>
                          <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">
                            {formatEventDateTime(act.timestamp)}
                          </span>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400 mt-0.5 leading-none">
                          Customer: <span className="font-bold text-slate-500">{resolveCustomerDisplayName({ customerName: act.customerName, phone: act.phone })}</span> ({cleanPhoneNumber(act.phone)})
                        </p>
                        {act.notes && (
                          <p className="text-[10px] font-medium text-slate-500 mt-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
                            {act.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function ActivityWidget({ icon, label, value, color }) {
  const bgMap = {
    blue: "bg-blue-50 text-blue-600 border-blue-100/50 hover:border-blue-200",
    purple: "bg-purple-50 text-purple-600 border-purple-100/50 hover:border-purple-200",
    amber: "bg-amber-50 text-amber-600 border-amber-100/50 hover:border-amber-200",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100/50 hover:border-emerald-200",
    rose: "bg-rose-50 text-rose-600 border-rose-100/50 hover:border-rose-200",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100/50 hover:border-indigo-200",
  };

  return (
    <div className={`bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex items-center gap-3 transition-all hover:shadow-md ${bgMap[color]}`}>
      <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center shadow-inner shrink-0 text-slate-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1.5 truncate">
          {label}
        </p>
        <p className="text-base sm:text-lg font-black text-slate-800 leading-none truncate">
          {value}
        </p>
      </div>
    </div>
  );
}
