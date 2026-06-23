"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

import Link from "next/link";
import { toast } from "react-toastify";
import { 
  ChevronLeft, Download, TrendingUp, Users, 
  Activity, MapPin, Loader2, BarChart3, Lock, PieChart, LineChart
} from "lucide-react";

export default function AdminReportsPage() {
  const { data: session } = useSession();
  
  
  
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [allLeads, setAllLeads] = useState([]);

  useEffect(() => {
    if (!session) return;

    async function loadData() {
      try {
        const res = await fetch("/api/admin/reports");
        const data = await res.json();

        if (data.success) {
            // We only need the raw CSV data now, as visual reporting is under development
            setAllLeads(data.csvData || []);
        }
      } catch (err) {
        console.error("Report Error", err);
        toast.error("Failed to sync backend data.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [session]);

  const downloadCSV = async () => {
    if (allLeads.length === 0) return toast.warning("No data available to export yet.");
    
    setExporting(true);
    
    try {
        // Simulate a tiny delay for UX feedback on large datasets
        await new Promise(resolve => setTimeout(resolve, 600));

        const headers = ["Name", "Phone", "Date", "Enquired For", "Status", "Sale Amount", "City", "Source", "Associate"];
        
        const rows = allLeads.map(lead => [
            `"${lead.name || "Unknown"}"`,
            `"${lead.phone}"`,
            `"${new Date(lead.date).toLocaleDateString('en-GB')}"`,
            `"${lead.enquiredFor || "N/A"}"`,
            `"${lead.status || "New"}"`,
            `"${lead.saleAmount || 0}"`,
            `"${lead.city || "-"}"`,
            `"${lead.source || "Manual"}"`,
            `"${lead.associate || "Unassigned"}"`
        ]);

        const csvContent = [
            headers.join(","), 
            ...rows.map(e => e.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `Almaa_Intelligence_Export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success("CSV Export downloaded successfully.");
    } catch (error) {
        console.error("Export failed:", error);
        toast.error("Failed to generate CSV export.");
    } finally {
        setExporting(false);
    }
  };

  if (!session) return null;

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        
        {/* --- HEADER --- */}
        <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 shadow-sm gap-4">
            <div className="flex items-center gap-4">
                <Link href="/crm/admin" className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition border border-transparent hover:border-slate-200">
                    <ChevronLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Intelligence Reports</h1>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Data & Analytics</p>
                </div>
            </div>

            <button 
                onClick={downloadCSV}
                disabled={loading || exporting || allLeads.length === 0}
                className="flex items-center justify-center gap-2 bg-[#00a884] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-600 transition-all shadow-md shadow-emerald-200/50 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 w-full md:w-auto shrink-0"
            >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {exporting ? "Generating..." : "Export Complete CSV"}
            </button>
        </header>

        {/* --- SCROLLABLE CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
            <div className="max-w-[1400px] mx-auto space-y-8">
                
                {/* 1. HERO BANNER: Under Development */}
                <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 text-white p-8 md:p-12 shadow-2xl group border border-slate-800">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00a884] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse group-hover:opacity-30 transition-opacity duration-1000"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full mix-blend-screen filter blur-[100px] opacity-10"></div>
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-start justify-between gap-8">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md">
                                <Activity size={14} className="animate-pulse" /> Advanced Analytics Under Development
                            </div>
                            <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 text-white">
                                Next-Generation <br/> Business Intelligence.
                            </h2>
                            <p className="text-slate-400 text-sm md:text-base font-medium leading-relaxed mb-6">
                                We are engineering a powerful data visualization system to provide deeper insights into your business growth, conversion funnels, and associate performance. <br/><br/>
                                <span className="text-slate-300 font-bold">Note:</span> Your raw data is actively tracked in the background and remains fully available via the CSV Export tool.
                            </p>
                        </div>
                        
                        <div className="hidden lg:flex items-center justify-center w-48 h-48 bg-white/5 backdrop-blur-xl border border-white/10 rounded-full shrink-0 shadow-2xl relative">
                            <div className="absolute inset-0 rounded-full border-t-2 border-[#00a884] animate-spin opacity-50" style={{ animationDuration: '3s' }}></div>
                            <BarChart3 size={64} className="text-slate-300 opacity-50" />
                        </div>
                    </div>
                </div>

                {/* 2. ROADMAP / COMING SOON FEATURES */}
                <div>
                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2 pl-2">
                        <Lock size={16} className="text-slate-400" /> Upcoming Modules
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <ComingSoonCard icon={<TrendingUp size={24}/>} title="Revenue Growth Analytics" />
                        <ComingSoonCard icon={<Users size={24}/>} title="Associate Performance Trends" />
                        <ComingSoonCard icon={<PieChart size={24}/>} title="Conversion Funnel Insights" />
                        <ComingSoonCard icon={<MapPin size={24}/>} title="Branch-wise Breakdown" />
                    </div>
                </div>

                {/* 3. UI SKELETON PREVIEW */}
                <div className="pt-8 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-6 pl-2">
                        <div>
                            <h3 className="text-lg font-extrabold text-slate-800">Dashboard Preview</h3>
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Simulated Layout Wireframe</p>
                        </div>
                        <div className="w-32 h-10 bg-slate-200 rounded-xl animate-pulse"></div>
                    </div>

                    <div className="opacity-60 pointer-events-none select-none transition-all duration-1000 grayscale-[30%]">
                        {/* KPI Skeleton Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="h-32 bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
                                    <div className="flex justify-between items-start">
                                        <div className="w-24 h-3 bg-slate-200 rounded-full animate-pulse"></div>
                                        <div className="w-8 h-8 bg-slate-100 rounded-lg animate-pulse"></div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="w-32 h-8 bg-slate-200 rounded-lg animate-pulse"></div>
                                        <div className="w-20 h-2 bg-slate-100 rounded-full animate-pulse"></div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Chart Area Skeletons */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 h-[400px] bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col">
                                <div className="w-48 h-5 bg-slate-200 rounded-lg animate-pulse mb-8"></div>
                                <div className="flex-1 flex items-end gap-4 justify-between pt-10">
                                    {[...Array(12)].map((_, i) => (
                                        <div key={i} className="w-full bg-slate-100 rounded-t-md animate-pulse" style={{ height: `${Math.max(20, Math.random() * 100)}%` }}></div>
                                    ))}
                                </div>
                            </div>
                            <div className="h-[400px] bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col items-center justify-center">
                                <div className="w-48 h-48 bg-slate-100 rounded-full border-[16px] border-slate-50 animate-pulse"></div>
                                <div className="mt-8 flex gap-4 w-full justify-center">
                                    <div className="w-16 h-3 bg-slate-200 rounded-full animate-pulse"></div>
                                    <div className="w-16 h-3 bg-slate-200 rounded-full animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
      </main>
    </div>
  );
}

// --- Sub Component: Disabled Roadmap Card ---
const ComingSoonCard = ({ icon, title }) => (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col items-center text-center gap-3 relative overflow-hidden group cursor-not-allowed">
        <div className="absolute top-2 right-2 bg-slate-200 text-slate-500 text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full">
            Pending
        </div>
        <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-500 transition-colors">
            {icon}
        </div>
        <h4 className="font-bold text-slate-600 text-sm">{title}</h4>
    </div>
);
