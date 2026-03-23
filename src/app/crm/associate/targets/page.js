"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import { 
  ChevronLeft, 
  Target, 
  TrendingUp, 
  Calendar, 
  Clock, 
  CheckCircle, 
  Filter,
  BarChart3
} from "lucide-react";

export default function TargetReportPage() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [report, setReport] = useState({
    current: { attended: 0, pending: 0, closed: 0, amount: 0, target: 0 },
    last: { attended: 0, pending: 0, closed: 0, amount: 0 },
    followUp: { total: 0, converted: 0, pending: 0, dropped: 0 }
  });

  useEffect(() => {
    if (!session?.user) return;

    async function loadData() {
      try {
        const [userRes, contactsRes] = await Promise.all([
            fetch("/api/users"),
            fetch("/api/contacts") 
        ]);

        const users = await userRes.json();
        const contacts = await contactsRes.json();

        const me = users.find(u => u.email === session.user.email);
        const myTarget = me ? parseInt(me.target || "0", 10) : 0;

        // Filter: ONLY MY LEADS
        const myLeads = contacts.filter(l => l.associate === session.user.name);

        const now = new Date();
        const currentMonth = now.getMonth(); 
        const currentYear = now.getFullYear();
        
        const lastMonthDate = new Date();
        lastMonthDate.setMonth(now.getMonth() - 1);
        const lastMonth = lastMonthDate.getMonth();
        const lastYear = lastMonthDate.getFullYear();

        const currentStats = { attended: 0, pending: 0, closed: 0, amount: 0, target: myTarget };
        const lastStats = { attended: 0, pending: 0, closed: 0, amount: 0 };
        
        // Total Initiated = Total leads attended by this associate
        const followUpStats = { total: myLeads.length, converted: 0, pending: 0, dropped: 0 };
        
        myLeads.forEach(lead => {
            const leadDate = lead.date ? new Date(lead.date) : new Date();
            const m = leadDate.getMonth();
            const y = leadDate.getFullYear();
            
            const amount = parseInt(lead.saleAmount || "0", 10) || 0;
            const isClosed = lead.status === "Closed" || lead.isClosed;
            
            // --- General Monthly Stats ---
            if (m === currentMonth && y === currentYear) {
                currentStats.attended++;
                if (isClosed) {
                    currentStats.closed++;
                    currentStats.amount += amount;
                } else if (lead.status !== "Not Interested" && lead.status !== "Not Closed") {
                    currentStats.pending++;
                }
            } else if (m === lastMonth && y === lastYear) {
                lastStats.attended++;
                if (isClosed) {
                    lastStats.closed++;
                    lastStats.amount += amount;
                }
            }

            // --- Follow Up Analytics Pipeline ---
            
            // Converted: Closed Follow-ups
            if (isClosed) {
                followUpStats.converted++;
            }

            // Active Pending: Follow ups BELOW 48 HOURS
            if (lead.status === "Follow Up" && !isClosed) {
                const followUpDate = lead.followUpStart ? new Date(lead.followUpStart) : leadDate;
                const hoursDiff = (now - followUpDate) / (1000 * 60 * 60);
                
                // Only count as active pending if it's strictly <= 48 hours
                if (hoursDiff <= 48) {
                    followUpStats.pending++; 
                }
            }
        });

        setReport({ 
            current: currentStats, 
            last: lastStats, 
            followUp: followUpStats
        });

      } catch (err) {
        console.error("Report Error", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  if (!session) return null;

  const percentage = report.current.target > 0 
    ? Math.min(100, Math.round((report.current.closed / report.current.target) * 100)) 
    : 0;

  return (
    <div className="flex h-[100dvh] bg-slate-50">
      <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/crm/associate" className="p-2.5 bg-white rounded-xl hover:bg-slate-100 text-slate-500 shadow-sm border border-slate-200 transition-all group">
                    <ChevronLeft size={20} className="group-hover:-translate-x-0.5 transition-transform" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Performance & Goals</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Comprehensive report of sales and follow-up tracking.</p>
                </div>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-400 animate-pulse">Loading analytics...</div>
            ) : (
                <div className="space-y-8">
                    
                    {/* SECTION 1: MONTHLY GOALS */}
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Current Month */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden relative group hover:shadow-md transition-all">
                            <div className="absolute top-0 w-full h-1 bg-emerald-500"></div>
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <div className="flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-widest mb-1">
                                            <Calendar size={12} /> Current Month
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-bold text-slate-900">{report.current.closed}</span>
                                            <span className="text-sm text-slate-400 font-medium">/ {report.current.target} Target</span>
                                        </div>
                                    </div>
                                    <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                                        <Target size={20} />
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2">
                                        <span>Achieved</span>
                                        <span>{percentage}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm pt-4 border-t border-slate-50">
                                    <div className="flex-1">
                                        <p className="text-xs text-slate-400 uppercase font-bold">Revenue</p>
                                        <p className="font-bold text-slate-700">₹{report.current.amount.toLocaleString()}</p>
                                    </div>
                                    <div className="w-px h-8 bg-slate-100"></div>
                                    <div className="flex-1">
                                        <p className="text-xs text-slate-400 uppercase font-bold">Pending Leads</p>
                                        <p className="font-bold text-slate-700">{report.current.pending}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Last Month */}
                        <div className="bg-slate-900 rounded-3xl shadow-lg border border-slate-800 text-white p-6 relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div>
                                    <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">
                                        <Calendar size={12} /> Last Month
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-bold text-white">₹{report.last.amount.toLocaleString()}</span>
                                    </div>
                                    <p className="text-slate-500 text-xs mt-1">Total Revenue</p>
                                </div>
                                <div className="p-2 bg-slate-800 rounded-xl text-slate-400">
                                    <TrendingUp size={20} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3 relative z-10">
                                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                                    <p className="text-emerald-400 text-xs font-bold uppercase mb-1">Closed</p>
                                    <p className="text-xl font-bold">{report.last.closed}</p>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                                    <p className="text-slate-400 text-xs font-bold uppercase mb-1">Interactions</p>
                                    <p className="text-xl font-bold">{report.last.attended}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: FOLLOW UP ANALYTICS */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Filter size={20} className="text-amber-500" /> Follow-up Pipeline
                            </h2>
                            <span className="text-xs font-medium bg-amber-50 text-amber-700 px-3 py-1 rounded-full border border-amber-100">
                                Total Initiated: {report.followUp.total}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Card 1: Active/Pending */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-slate-900">{report.followUp.pending}</p>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Active Pending</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Currently in follow-up ({"<"} 2 days)</p>
                                </div>
                            </div>

                            {/* Card 2: Converted */}
                            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
                                <div className="absolute right-0 top-0 w-16 h-16 bg-emerald-50 rounded-bl-full -mr-4 -mt-4"></div>
                                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 z-10">
                                    <CheckCircle size={24} />
                                </div>
                                <div className="z-10">
                                    <p className="text-3xl font-bold text-emerald-700">{report.followUp.converted}</p>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Converted</p>
                                    <p className="text-[10px] text-emerald-600/70 mt-0.5">Closed Follow-ups count</p>
                                </div>
                            </div>

                            {/* Card 3: Success Rate */}
                            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                    <BarChart3 size={24} />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-slate-900">
                                        {report.current.target > 0 
                                            ? Math.round((report.current.closed / report.current.target) * 100) 
                                            : 0}%
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Success Rate</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Calculated by Target</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}