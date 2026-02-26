"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/store/chatStore";
import { usePathStore } from "@/store/pathStore";
import { usePathname } from 'next/navigation';


import {
  ArrowLeft,
  Save,
  User,
  Phone,
  MapPin,
  Tag,
  FileText,
  AlertCircle,
  Loader2,
  Clock,
  Eye,
  MessageSquare,
  X,
  Calendar,
  Briefcase,
  Plus,
  History,
  Search,
  RefreshCcw,
  Copy,
  Check,
  Flag
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import Sidebar from "@/components/layout/Sidebar";

export default function LeadsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const { setSelectedChat } = useChatStore();
  const {setPath} = usePathStore()
   const pathname = usePathname();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingLeads, setFetchingLeads] = useState(true);
  const [rawLeads, setRawLeads] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedPhone, setCopiedPhone] = useState(null);

  const [formData, setFormData] = useState({
    phone: "",
    name: "",
    city: "",
    source: "Manual Entry",
    enquiredFor: "",
    priority: "Medium",
    status: "New",
    remarks: ""
  });

  const fetchRecentLeads = async () => {
    setFetchingLeads(true);
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      if (res.ok) setRawLeads(data);
    } catch (err) {
      console.error("Error fetching leads:", err);
      toast.error("Failed to sync leads.");
    } finally {
      setFetchingLeads(false);
    }
  };

  useEffect(() => {
    fetchRecentLeads();
  }, []);

  const handleCustomerRedirect = (phone)=>{
    
    setPath(pathname)
    router.push(`/dashboard/customers/${phone}`)
  }

  const handleChatSelect = (lead) => {
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
  };

  const processedLeads = useMemo(() => {
    const grouped = {};
    rawLeads.forEach(lead => {
        const cleanPhone = lead.phone?.replace(/\D/g, '') || "unknown";
        if (!grouped[cleanPhone]) {
            grouped[cleanPhone] = { ...lead, history: [] };
        }
        grouped[cleanPhone].history.push({
            date: lead.date,
            source: lead.source,
            enquiredFor: lead.enquiredFor,
            remarks: lead.remarks,
            status: lead.status
        });
    });

    const leadArray = Object.values(grouped).sort((a, b) => 
        new Date(b.date) - new Date(a.date)
    );

    if (!searchTerm) return leadArray;
    
    const lowerTerm = searchTerm.toLowerCase();
    return leadArray.filter(lead => 
        (lead.name && lead.name.toLowerCase().includes(lowerTerm)) ||
        (lead.phone && lead.phone.includes(lowerTerm))
    );
  }, [rawLeads, searchTerm]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCopyPhone = (e, phone) => {
    e.preventDefault(); // Prevent navigation if inside link
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
    toast.success("Phone number copied!");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.phone) {
      toast.error("Phone number is required");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, checkDuplicates: false }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create lead");

      toast.success("Lead created successfully!");
      fetchRecentLeads();
      setFormData({ 
        phone: "", name: "", city: "", 
        source: "Manual Entry", enquiredFor: "", 
        priority: "Medium", status: "New", remarks: "" 
      });
      setShowCreateForm(false);
      
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
      switch(status?.toLowerCase()) {
          case 'new': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'closed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          case 'follow up': return 'bg-amber-100 text-amber-700 border-amber-200';
          default: return 'bg-slate-100 text-slate-600 border-slate-200';
      }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} role={role || "associate"} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-auto md:h-16 px-4 py-3 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-10 shadow-sm gap-3">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-slate-500 md:hidden">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-lg font-bold text-slate-800 whitespace-nowrap">Leads Management</h1>
            <div className="hidden md:flex items-center ml-6 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all w-64">
                <Search size={16} className="text-slate-400" />
                <input type="text" placeholder="Search leads..." className="bg-transparent border-none outline-none text-sm ml-2 w-full text-slate-700 placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <button onClick={fetchRecentLeads} disabled={fetchingLeads} className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-all" title="Refresh List">
                <RefreshCcw size={18} className={fetchingLeads ? "animate-spin" : ""} />
            </button>
            <button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-emerald-200 transition-all active:scale-95 w-full md:w-auto justify-center">
                <Plus size={18} /> <span className="hidden sm:inline">New Lead</span><span className="sm:hidden">Add</span>
            </button>
          </div>
          <div className="flex md:hidden w-full items-center bg-slate-100 rounded-xl px-3 py-2 border border-slate-200">
             <Search size={16} className="text-slate-400" />
             <input type="text" placeholder="Search name or phone..." className="bg-transparent border-none outline-none text-sm ml-2 w-full text-slate-700" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#f8fafc]">
            {fetchingLeads && rawLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <Loader2 size={32} className="animate-spin mb-3 text-emerald-500" />
                    <span className="text-sm font-medium">Syncing database...</span>
                </div>
            ) : processedLeads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <User size={48} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">No leads found matching your search.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                    {processedLeads.map((lead, idx) => (
                        <div key={idx} className="group bg-white p-5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:shadow-xl  transition-all duration-300 relative flex flex-col h-full">
                            
                            {/* Header: Link to Detail Page */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="block flex-1 min-w-0 cursor-pointer" onClick={()=> handleCustomerRedirect(lead.phone)} >
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-base line-clamp-1 hover:text-emerald-600 transition-colors" title={lead.name}>{lead.name || "Unknown"}</h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-2">
                                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${getStatusColor(lead.status)}`}>{lead.status}</span>
                                            {lead.history.length > 1 && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                                                    <History size={10} /> {lead.history.length}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Link 
                                    href={`/dashboard/leads/${lead.phone?.replace(/\D/g, '')}`}
                                    className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors bg-slate-50"
                                    title="View Full Profile"
                                >
                                    <Eye size={18} />
                                </Link>
                            </div>

                            {/* Body: Link to Detail Page */}
                            <div onClick={()=>handleCustomerRedirect(lead.phone)} className="space-y-3 mb-4 flex-1 block cursor-pointer">
                                <div className="flex items-center justify-between text-xs text-slate-600 group/phone">
                                    <div className="flex items-center gap-2">
                                        <Phone size={14} className="text-slate-400 shrink-0" />
                                        <span className="font-medium tracking-wide">{lead.phone}</span>
                                    </div>
                                    <button 
                                        onClick={(e) => handleCopyPhone(e, lead.phone)}
                                        className="opacity-0 group-hover/phone:opacity-100 transition-opacity text-slate-400 hover:text-emerald-600 p-1"
                                        title="Copy Phone"
                                    >
                                        {copiedPhone === lead.phone ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} className="cursor-pointer" />}
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <MapPin size={14} className="text-slate-400 shrink-0" />
                                    <span className="truncate">{lead.city || "N/A"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-slate-600">
                                    <Tag size={14} className="text-slate-400 shrink-0" />
                                    <span className="truncate" title={lead.enquiredFor}>{lead.enquiredFor || "General Inquiry"}</span>
                                </div>
                            </div>

                            {/* Footer: Date & Chat Action */}
                            <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-auto">
                                <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5"><Calendar size={12} /> {lead.date}</span>
                                <Link 
                                    href="/dashboard/chat" 
                                    onClick={(e) => { e.stopPropagation(); handleChatSelect(lead); }} 
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl transition-all shadow-sm shadow-emerald-200 active:scale-95" 
                                    title="Open Chat"
                                >
                                    <MessageSquare size={16} />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </main>

        {showCreateForm && (
            <>
                <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity" onClick={() => setShowCreateForm(false)} />
                <div className="fixed inset-y-0 left-0 w-full sm:w-[450px] bg-white z-50 shadow-2xl transform transition-transform duration-300 animate-in slide-in-from-left flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <h2 className="text-lg font-bold text-slate-800">Create New Lead</h2>
                        <button onClick={() => setShowCreateForm(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition">
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Phone Number <span className="text-rose-500">*</span></label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={16} /></div>
                                        <input type="tel" name="phone" placeholder="e.g., 919876543210" value={formData.phone} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" required />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Name</label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><User size={16} /></div>
                                            <input type="text" name="name" placeholder="Name" value={formData.name} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">City</label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><MapPin size={16} /></div>
                                            <input type="text" name="city" placeholder="City" value={formData.city} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Status</label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Flag size={16} /></div>
                                            <select name="status" value={formData.status} onChange={handleChange} className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium cursor-pointer appearance-none">
                                                <option value="New">New</option>
                                                <option value="Follow Up">Follow Up</option>
                                                <option value="Closed">Closed</option>
                                                <option value="Enquired for">Enquired for</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Priority</label>
                                        <div className="relative group">
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><AlertCircle size={16} /></div>
                                            <select name="priority" value={formData.priority} onChange={handleChange} className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium cursor-pointer appearance-none">
                                                <option value="Low">Low</option>
                                                <option value="Medium">Medium</option>
                                                <option value="High">High</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Source</label>
                                    <select name="source" value={formData.source} onChange={handleChange} className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium cursor-pointer">
                                        <option value="Manual Entry">Manual Entry</option>
                                        <option value="Phone Call">Phone Call</option>
                                        <option value="Google">Google</option>
                                        <option value="WhatsApp">WhatsApp</option>
                                        <option value="Facebook">Facebook</option>                                    
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Enquired for</label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Tag size={16} /></div>
                                        <input type="text" name="Enquired for" placeholder="e.g., therapy" value={formData.enquiredFor} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1 uppercase tracking-wider">Remarks</label>
                                    <div className="relative group">
                                        <div className="absolute left-3 top-3 text-slate-400"><FileText size={16} /></div>
                                        <textarea name="remarks" placeholder="Notes..." value={formData.remarks} onChange={handleChange} rows={3} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-medium resize-none" />
                                    </div>
                                </div>
                                
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex gap-3">
                                <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 py-3 text-sm rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-all">Cancel</button>
                                <button type="submit" disabled={loading} className="flex-1 py-3 bg-emerald-600 text-white text-sm rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Save Lead</>}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            </>
        )}
      </div>
    </div>
  );
}