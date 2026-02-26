"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useChatStore } from "@/store/chatStore";

import { 
  ArrowLeft, User, Phone, MapPin, Tag, FileText, 
  Calendar, MessageSquare, History, Briefcase, 
  Clock, AlertCircle, Copy, Check, Loader2, Menu, Globe
} from "lucide-react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import { toast } from "react-toastify";
import { useSession } from "next-auth/react";

export default function LeadDetailsPage({ params }) {
  const unwrappedParams = use(params); 
  const phone = decodeURIComponent(unwrappedParams.phone);

  const { data: session } = useSession();
  const router = useRouter();
  const { setSelectedChat } = useChatStore();
  
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);



  useEffect(() => {
    if (!phone) return;

    const fetchLeadDetails = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/contacts");
        const data = await res.json();
        
        if (res.ok && Array.isArray(data)) {
            const targetPhone = phone.replace(/\D/g, ''); 
            const history = [];
            let mainDetails = null;
            const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));

            sortedData.forEach(item => {
                const itemPhone = item.phone?.replace(/\D/g, '');
                if (itemPhone === targetPhone) {
                    if (!mainDetails) mainDetails = item;
                    history.push({
                        date: item.date,
                        source: item.source,
                        status: item.status,
                        enquiredFor: item.enquiredFor, // Keeping original field logic
                        remarks: item.remarks,
                        handler: item.handler
                    });
                }
            });

            if (mainDetails) {
                setLead({ ...mainDetails, history });
            }
        }
      } catch (err) {
        console.error("Failed to load lead details", err);
        toast.error("Could not load lead details");
      } finally {
        setLoading(false);
      }
    };

    fetchLeadDetails();
  }, [phone]);

  const handleCopyPhone = () => {
    if (lead?.phone) {
        navigator.clipboard.writeText(lead.phone);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        toast.success("Phone copied");
    }
  };

  const handleOpenChat = () => {
    if (lead) {
        const chatObject = {
            phone: lead.phone,
            name: lead.name || lead.phone,
            status: lead.status || "New",
            priority: lead.priority || "Medium",
            direction: "OUTBOUND", 
            read: "TRUE",
            timestamp: new Date().toISOString()
        };
        setSelectedChat(chatObject);
        router.push("/dashboard/chat");
    }
  };

  const getStatusColor = (status) => {
      switch(status?.toLowerCase()) {
          case 'new': return 'bg-blue-50 text-blue-700 border-blue-200';
          case 'closed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
          case 'follow up': return 'bg-amber-50 text-amber-700 border-amber-200';
          case 'not interested': return 'bg-red-50 text-red-700 border-red-200';
          default: return 'bg-slate-50 text-slate-600 border-slate-200';
      }
  };

  if (loading) {
      return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} role="associate" />
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-400">
                    <Loader2 size={32} className="animate-spin text-emerald-600" />
                    <p className="text-sm font-medium tracking-wide">Loading Profile...</p>
                </div>
            </div>
        </div>
      );
  }

  if (!lead) {
      return (
        <div className="flex h-screen bg-slate-50 font-sans">
            <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} role="associate" />
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <User size={32} className="text-slate-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Lead Not Found</h2>
                <p className="text-slate-500 mb-6 max-w-sm text-sm">The requested lead profile could not be found. It may have been deleted or the link is incorrect.</p>
                <Link href="/dashboard/new-leads" className="px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition shadow-sm">
                    Back to Leads
                </Link>
            </div>
        </div>
      );
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} role={session?.user?.role || "associate"} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Header */}
        <header className="h-18 px-6 md:px-8 py-4 bg-white border-b border-slate-200/60 flex items-center justify-between shrink-0 z-20 sticky top-0 backdrop-blur-md bg-white/80">
            <div className="flex items-center gap-4">
                <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700 transition">
                    <Menu size={24} />
                </button>
                <Link href="/dashboard/leads" className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition border border-transparent hover:border-slate-200">
                    <ArrowLeft size={20} />
                </Link>
                <div>
                    <h1 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">Lead Details</h1>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        
                    </div>
                </div>
            </div>
            
            <button 
                onClick={handleOpenChat}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-md shadow-emerald-200 transition-all hover:shadow-lg active:scale-95"
            >
                <MessageSquare size={18} /> <span className="hidden sm:inline">Open Chat</span>
            </button>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Hero Card */}
                <div className="bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 overflow-hidden relative">
                    
                    
                    <div className="relative py-16 px-8  flex flex-col md:flex-row items-start md:items-end gap-6">
                   
                        
                        <div className="flex-1 pb-1">
                            <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
                                <div>
                                    <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{lead.name || "Unknown Lead"}</h2>
                                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-slate-600">
                                        <div 
                                            className="flex items-center gap-2 cursor-pointer hover:text-emerald-600 transition group" 
                                            onClick={handleCopyPhone}
                                            title="Click to copy"
                                        >
                                            <Phone size={16} className="text-slate-400 group-hover:text-emerald-500" />
                                            <span className="font-semibold font-mono tracking-wide">{lead.phone}</span>
                                            {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                                        </div>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full hidden sm:block"></span>
                                        <div className="flex items-center gap-2">
                                            <MapPin size={16} className="text-slate-400" />
                                            <span>{lead.city || "N/A"}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Status</span>
                                        <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${
                                            lead.status === 'Closed' ? 'text-emerald-600' : 
                                            lead.status === 'Follow Up' ? 'text-amber-600' : 'text-blue-600'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${
                                                lead.status === 'Closed' ? 'bg-emerald-500' : 
                                                lead.status === 'Follow Up' ? 'bg-amber-500' : 'bg-blue-500'
                                            }`}></span>
                                            {lead.status}
                                        </span>
                                    </div>
                                    
                                    <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-0.5">Priority</span>
                                        <span className={`inline-flex items-center gap-1.5 text-sm font-bold ${
                                            lead.priority === 'High' ? 'text-rose-600' : 'text-slate-700'
                                        }`}>
                                            {lead.priority === 'High' && <AlertCircle size={14} />}
                                            {lead.priority || "Medium"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* LEFT COLUMN - INFO */}
                    <div className="lg:col-span-4 space-y-6">
                        
                        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 p-6">
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2 border-b border-slate-50 pb-3">
                                <Briefcase size={16} className="text-emerald-500" /> Key Details
                            </h3>
                            
                            <div className="space-y-5">
                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                                        <Globe size={12} /> Source
                                    </p>
                                    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 font-medium text-slate-700 text-sm">
                                        {lead.source || "N/A"}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                                        <Tag size={12} /> Enquired For
                                    </p>
                                    
                                    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 font-medium text-slate-700 text-sm flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        { lead.enquiredFor || "General"}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-xs text-slate-400 font-bold uppercase mb-1.5 flex items-center gap-1.5">
                                        <User size={12} />Previous Handler
                                    </p>
                                    <div className="bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100 font-medium text-slate-700 text-sm">
                                        {lead.handler || "Unassigned"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100/50 p-6 shadow-sm">
                            <h3 className="text-sm font-bold text-emerald-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <FileText size={16} /> Latest Note
                            </h3>
                            <div className="relative">
                                <p className="text-sm text-emerald-800/80 italic leading-relaxed pl-3 relative z-10">
                                    {lead.remarks || "No remarks added yet."}
                                </p>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT COLUMN - HISTORY */}
                    <div className="lg:col-span-8">
                        <div className="bg-white rounded-2xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 p-6 h-full">
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <History size={16} className="text-emerald-500" /> Interaction History
                                </h3>
                                <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2.5 py-1 rounded-full border border-emerald-100">
                                    {lead.history?.length || 0} Records
                                </span>
                            </div>

                            <div className="relative pl-6 space-y-8 before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                                {lead.history && lead.history.length > 0 ? (
                                    lead.history.map((entry, idx) => (
                                        <div key={idx} className="relative">
                                            
                                            
                                            <div className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md hover:border-emerald-200 transition-all duration-300 group">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-700 group-hover:border-emerald-100 transition-colors">
                                                            <Calendar size={12} /> {entry.date}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                                                          Source:   {entry.source}
                                                        </span>
                                                    </div>
                                                    {entry.status && (
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getStatusColor(entry.status)}`}>
                                                            {entry.status}
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="grid gap-2">
                                                    {entry.enquiredFor && (
                                                        <div className="flex items-start gap-2.5">
                                                            <div className="mt-0.5 p-1 bg-slate-50 rounded text-slate-400"><Tag size={10} /></div>
                                                            <div className="text-sm ">
                                                                <span className="text-xs font-bold text-slate-400 uppercase pr-2">Enquired For :</span>
                                                                <span className="text-slate-700 font-medium">{entry.enquiredFor}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {entry.remarks && (
                                                        <div className="flex items-start gap-2.5">
                                                            <div className="mt-0.5 p-1 bg-slate-50 rounded text-slate-400"><FileText size={10} /></div>
                                                            <div className="text-sm">
                                                                <span className="text-xs font-bold text-slate-400 uppercase pr-2">Remarks :</span>
                                                                <span className="text-slate-600 italic">"{entry.remarks}"</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                                        <Clock size={32} className="mb-2 opacity-30" />
                                        <p className="text-sm font-medium">No history available yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </main>
      </div>
    </div>
  );
}