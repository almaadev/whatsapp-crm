"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import CreateUserForm from "@/components/features/admin/CreateUserForm";
import Link from "next/link";
import {
  Users, TrendingUp, Briefcase, Edit2, Save, XCircle, 
  ChevronRight, Shield, Menu, Filter, Clock, CheckCircle, ShieldAlert
} from "lucide-react";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [associates, setAssociates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [tempTarget, setTempTarget] = useState(0);

  const [analytics, setAnalytics] = useState({
    totalPending: 0, totalFollowUp: 0, totalAchieved: 0
  });

  // 1. Authorization Logic
  const isAuthorized = 
      session?.user?.role === 'superAdmin' || 
      (session?.user?.role === 'sales' && session?.user?.department === 'admin') ||  
      (session?.user?.role === 'doctor' && session?.user?.department === 'admin');

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/admin/roster");
        const data = await res.json();
      
        if (data.success) {
            setAssociates(data.roster.filter(roster => roster.id !== session?.user?.id));

            let tPending = 0, tFollowUp = 0, tAchieved = 0;
            data.roster.forEach(a => {
                tPending += a.pendingCount;
                tFollowUp += a.followUpCount;
                tAchieved += a.achievedCount;
            });

            setAnalytics({
                totalPending: tPending,
                totalFollowUp: tFollowUp,
                totalAchieved: tAchieved
            });
        }
      } catch (err) {
        console.error("Dashboard Data Error:", err);
      } finally {
        setLoading(false);
      }
    }

    if (isAuthorized) {
        fetchData();
    } else if (status !== "loading") {
        setLoading(false); // Stop loading if not authorized
    }
  }, [isAuthorized, status, session?.user?.id]); // Added necessary dependencies

  const saveEdit = async (id) => {
    const associate = associates.find(a => a.id === id);
    if (!associate) return;
    
    setAssociates(prev => prev.map(a => a.id === id ? { ...a, target: Number(tempTarget) } : a));
    setEditingId(null);
    
    const totalLeads = associate.pendingCount + associate.followUpCount + associate.achievedCount;
    
    await fetch("/api/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
          rowId: id, 
          target: tempTarget, 
          leads: totalLeads, 
          achieved: associate.achievedCount 
      }),
    });
  };

  const startEdit = (associate) => {
    setEditingId(associate.id);
    setTempTarget(associate.target);
  };

  // 👇 FIX: Loading State Check (Sariyaana edathula)
  if (status === "loading" || (loading && isAuthorized)) {
    return <div className="p-8 flex h-[100dvh] items-center justify-center text-slate-500 font-medium">Loading Dashboard Data...</div>;
  }

  // 👇 FIX: Unauthorized User Check
  if (!isAuthorized) {
      return (
          <div className="flex h-[100dvh] bg-gray-100 overflow-hidden relative">
              <div className="flex-shrink-0 z-40">
                  <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
              </div>

              <div className="flex flex-1 w-full h-full relative overflow-hidden flex-col">
                  <div className="md:hidden h-14 bg-white border-b flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
                      <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md">
                          <Menu size={24} />
                      </button>
                      <div className="font-semibold text-gray-700">
                          <div className="w-20 flex items-center justify-center shrink-0 p-1">
                              <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" />
                          </div>
                      </div>
                      <div className="w-8"></div>
                  </div>
                  <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                      <ShieldAlert size={60} className="text-red-400 mb-4" />
                      <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
                      <p className="text-slate-500 mt-2">Only administrators can access this page.</p>
                  </div>
              </div>
          </div>
      );
  }

  const totalTarget = associates.reduce((sum, a) => sum + (a.target || 0), 0);
  const companyProgress = totalTarget > 0 ? Math.round((analytics.totalAchieved / totalTarget) * 100) : 0;

  return (
    <div className="flex h-[100dvh] bg-slate-50">
      <div className="flex-shrink-0 z-40">
        <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      </div>

      <main className="flex-1 p-6 md:p-10 overflow-y-auto w-full">
        {/* Mobile Header logic with Hamburger */}
        <div className="md:hidden flex items-center justify-between mb-6 border-b pb-4 border-slate-200">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-slate-600 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
          >
            <Menu size={24} />
          </button>
          <div className="w-20 flex items-center justify-center shrink-0 p-1">
              <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" />
          </div>
          <div className="w-8"></div>
        </div>

        <div className="max-w-7xl mx-auto space-y-8">

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Shield className="text-emerald-600" size={28} />
                Admin Overview
              </h1>
              <p className="text-slate-500 text-sm mt-1 ml-1">Company-wide performance and associate management.</p>
            </div>
            <Link href="/dashboard/admin/reports" className="flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-semibold text-sm bg-white px-4 py-2 rounded-lg border border-slate-200 hover:border-emerald-200 transition-all shadow-sm hover:shadow-md group w-fit">
              View Detailed Reports
              <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          <div className="bg-slate-900 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h2 className="text-sm font-medium text-slate-400 uppercase tracking-widest mb-2">Total Company Achieved</h2>
                <div className="flex items-baseline gap-4">
                  <span className="text-4xl md:text-5xl font-bold text-white tracking-tight">{analytics.totalAchieved}</span>
                  <span className="text-lg md:text-xl text-slate-500 font-light">/ {totalTarget} Target</span>
                </div>
              </div>
              <div className="flex flex-col items-start md:items-end">
                <div className="flex items-center gap-3 text-emerald-400 mb-1">
                  <TrendingUp size={32} />
                  <span className="text-3xl md:text-4xl font-bold">{companyProgress}%</span>
                </div>
                <p className="text-xs text-slate-500 uppercase tracking-widest">Global Progress</p>
              </div>
            </div>
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl -ml-10 -mb-10 pointer-events-none"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6"> 
             <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 has-tooltip cursor-pointer" data-tooltip="Leads inactive for over 48 hours will be marked as pending.">
                 <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0"><Clock size={24} /></div>
                 <div>
                     <p className="text-2xl font-bold text-slate-900">{analytics.totalPending}</p>
                     <p className="text-xs text-slate-500 font-medium uppercase" >Pending</p>
                 </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0"><Filter size={24} /></div>
                 <div>
                     <p className="text-2xl font-bold text-amber-700">{analytics.totalFollowUp}</p>
                     <p className="text-xs text-slate-500 font-medium uppercase">Active Follow Ups</p>
                 </div>
             </div>
             <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-4">
                 <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0"><CheckCircle size={24} /></div>
                 <div>
                     <p className="text-2xl font-bold text-emerald-700">{analytics.totalAchieved}</p>
                     <p className="text-xs text-slate-500 font-medium uppercase">Converted (Closed)</p>
                 </div>
             </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-white/50 backdrop-blur-sm">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Users size={18} className="text-slate-400" />
                Associate Roster
              </h3>
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                Live Data
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase font-semibold">
                  <tr>
                    <th className="px-6 py-4">Associate</th>
                    <th className="px-6 py-4 text-center">Pending</th>
                    <th className="px-6 py-4 text-center">Active Follow Up</th>
                    <th className="px-6 py-4 text-center">Achieved</th>
                    <th className="px-6 py-4 text-center">Conv. Rate</th>
                    <th className="px-6 py-4 text-center">Target</th>
                    <th className="px-6 py-4 text-center">Progress</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {associates.map((associate) => {
                    return (
                      <tr key={associate.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-600 font-bold text-sm shadow-inner shrink-0">
                              {associate.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 whitespace-nowrap">{associate.name}</div>
                              <div className="text-[11px] text-slate-400 capitalize">{associate.role.replace("_", " ")}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-medium text-rose-600">{associate.pendingCount}</td>
                        <td className="px-6 py-4 text-center font-medium text-amber-600">{associate.followUpCount}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold text-xs border border-emerald-200">
                            {associate.achievedCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-slate-500 text-xs font-bold">
                            {associate.conversionRate}%
                        </td>

                        <td className="px-6 py-4 text-center font-bold text-slate-900">
                          {editingId === associate.id ? (
                            <input
                              type="number" value={tempTarget}
                              onChange={(e) => setTempTarget(e.target.value)}
                              className="w-20 border border-emerald-300 rounded-lg px-2 py-1 text-center focus:ring-2 focus:ring-emerald-500 outline-none text-sm bg-emerald-50"
                              autoFocus
                            />
                          ) : (
                            <span>{associate.target}</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          <div className="w-24 bg-slate-200 rounded-full h-1.5 mx-auto mb-1 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-1000 ${associate.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${associate.progress}%` }}></div>
                          </div>
                          <p className="text-center text-[10px] text-slate-400">{associate.progress}%</p>
                        </td>

                        <td className="px-6 py-4 text-right">
                          {editingId === associate.id ? (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => saveEdit(associate.id)} className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition"><Save size={14} /></button>
                              <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"><XCircle size={14} /></button>
                            </div>
                          ) : (
                            <button onClick={() => startEdit(associate)} className="text-slate-300 hover:text-emerald-600 transition p-2 rounded-full hover:bg-emerald-50 opacity-95 group-hover:opacity-100">
                              <Edit2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {associates.length === 0 && !loading && (
                    <tr>
                      <td colSpan="8" className="text-center py-6 text-slate-500">
                        No associates found. Please add new associates to see them here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Briefcase size={20} /></div>
                <h2 className="text-lg font-bold text-slate-900">Add New Associate</h2>
              </div>
              <CreateUserForm />
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}