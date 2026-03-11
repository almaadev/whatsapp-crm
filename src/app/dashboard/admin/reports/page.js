"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import Link from "next/link";
import { 
  ChevronLeft, Download, Calendar, TrendingUp, Users, 
  CheckCircle, CreditCard, Clock, Activity 
} from "lucide-react";

export default function AdminReportsPage() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allLeads, setAllLeads] = useState([]);

  const [report, setReport] = useState({
    current: { totalLeads: 0, pending: 0, followUps: 0, closed: 0, amount: 0 },
    last: { totalLeads: 0, pending: 0, followUps: 0, closed: 0, amount: 0 }
  });

  useEffect(() => {
    if (!session) return;

    async function loadData() {
      try {
        const res = await fetch("/api/admin/reports");
        const data = await res.json();

        if (data.success) {
            setReport(data.report);
            setAllLeads(data.csvData);
        }
      } catch (err) {
        console.error("Report Error", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  const downloadCSV = () => {
    if (allLeads.length === 0) return alert("No data to export");

    const headers = ["Name", "Phone", "Date", "Enquired For", "Status", "Sale Amount", "City", "Source", "Handler"];
    
    const rows = allLeads.map(lead => [
        `"${lead.name || "Unknown"}"`,
        `"${lead.phone}"`,
        `"${new Date(lead.date).toLocaleDateString('en-GB')}"`,
        `"${lead.enquiredFor || "N/A"}"`,
        `"${lead.status || "New"}"`,
        `"${lead.saleAmount || 0}"`,
        `"${lead.city || "-"}"`,
        `"${lead.source || "Manual"}"`,
        `"${lead.handler || "Unassigned"}"`
    ]);

    const csvContent = [
        headers.join(","), 
        ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Almaa_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!session) return null;

  return (
    <div className="flex h-[100dvh] bg-slate-50">
      <Sidebar role="admin" mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
      
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/admin" className="p-2.5 bg-white rounded-xl hover:bg-slate-100 text-slate-500 shadow-sm border border-slate-200 transition-all">
                        <ChevronLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Reports</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Monthly revenue and conversion analysis.</p>
                    </div>
                </div>
                <button 
                    onClick={downloadCSV}
                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-800 transition shadow-lg shadow-slate-200"
                >
                    <Download size={16} />
                    Export Complete CSV
                </button>
            </div>

            {loading ? (
                <div className="grid md:grid-cols-2 gap-8 animate-pulse">
                    <div className="h-96 bg-slate-200 rounded-3xl"></div>
                    <div className="h-96 bg-slate-200 rounded-3xl"></div>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-8">
                    
                    {/* CURRENT MONTH CARD */}
                    <div className="bg-white rounded-3xl shadow-xl shadow-emerald-900/5 border border-slate-100 overflow-hidden relative group">
                        <div className="absolute top-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400"></div>
                        
                        <div className="p-8 pb-6">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-widest mb-1">
                                        <Calendar size={14} /> Current Month
                                    </div>
                                    <h2 className="text-4xl font-bold text-slate-900 tracking-tight">₹{report.current.amount.toLocaleString()}</h2>
                                    <p className="text-slate-400 text-sm mt-1">Total Revenue Generated</p>
                                </div>
                                <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
                                    <TrendingUp size={24} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <StatBox 
                                    label="Total Enquiries" 
                                    value={report.current.totalLeads} 
                                    icon={<Users size={16}/>} 
                                    color="text-indigo-600" 
                                    bg="bg-indigo-50" 
                                />
                                <StatBox 
                                    label="Successfully Closed" 
                                    value={report.current.closed} 
                                    icon={<CheckCircle size={16}/>} 
                                    color="text-emerald-600" 
                                    bg="bg-emerald-50" 
                                />
                                <StatBox 
                                    label="Active Follow Ups" 
                                    value={report.current.followUps} 
                                    icon={<Activity size={16}/>} 
                                    color="text-amber-600" 
                                    bg="bg-amber-50" 
                                />
                                <StatBox 
                                    label="Pending (> 48 Hrs)" 
                                    value={report.current.pending} 
                                    icon={<Clock size={16}/>} 
                                    color="text-rose-600" 
                                    bg="bg-rose-50" 
                                />
                            </div>
                        </div>
                        
                        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-sm">
                            <span className="text-slate-500 font-medium">Conversion Rate</span>
                            <span className="font-bold text-slate-700">
                                {report.current.totalLeads > 0 
                                    ? Math.round((report.current.closed / report.current.totalLeads) * 100) 
                                    : 0}%
                            </span>
                        </div>
                    </div>

                    {/* LAST MONTH CARD */}
                    <div className="bg-slate-900 rounded-3xl shadow-xl border border-slate-800 overflow-hidden relative text-white">
                        
                        <div className="p-8 pb-6">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest mb-1">
                                        <Calendar size={14} /> Last Month
                                    </div>
                                    <h2 className="text-4xl font-bold text-white tracking-tight">₹{report.last.amount.toLocaleString()}</h2>
                                    <p className="text-slate-500 text-sm mt-1">Total Revenue Generated</p>
                                </div>
                                <div className="p-3 bg-slate-800 rounded-2xl text-slate-400">
                                    <CreditCard size={24} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <StatBoxDark label="Total Enquiries" value={report.last.totalLeads} />
                                <StatBoxDark label="Successfully Closed" value={report.last.closed} />
                                <StatBoxDark label="Active Follow Ups" value={report.last.followUps} />
                                <StatBoxDark label="Pending (> 48 Hrs)" value={report.last.pending} />
                            </div>
                        </div>
                        
                        <div className="px-8 py-4 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between text-sm">
                            <span className="text-slate-500 font-medium">Revenue Growth</span>
                            {report.current.amount >= report.last.amount ? (
                                <span className="text-emerald-400 font-bold flex items-center gap-1">
                                    <TrendingUp size={14}/> +{report.last.amount > 0 ? Math.round(((report.current.amount - report.last.amount)/ report.last.amount) * 100) : 100}%
                                </span>
                            ) : (
                                <span className="text-rose-400 font-bold flex items-center gap-1">
                                    <TrendingUp size={14} className="rotate-180"/> {report.last.amount > 0 ? Math.round(((report.current.amount - report.last.amount)/ report.last.amount) * 100) : 0}%
                                </span>
                            )}
                        </div>
                    </div>

                </div>
            )}
        </div>
      </main>
    </div>
  );
}

function StatBox({ label, value, icon, color, bg }) {
    return (
        <div className={`p-4 rounded-xl border border-slate-100 bg-white flex flex-col justify-center transition-all hover:shadow-md`}>
            <div className={`flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-wide ${color}`}>
                <div className={`p-1 rounded-md ${bg}`}>{icon}</div>
                {label}
            </div>
            <p className="text-xl font-bold text-slate-800 ml-1">{value}</p>
        </div>
    );
}

function StatBoxDark({ label, value }) {
    return (
        <div className="p-4 rounded-xl border border-slate-700 bg-slate-800/30 flex flex-col justify-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2 ml-1">{label}</p>
            <p className="text-xl font-bold text-white ml-1">{value}</p>
        </div>
    );
}