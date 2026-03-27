"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import { useRouter } from "next/navigation";
import { 
    TrendingUp, Users, Clock, Menu, Inbox, ChevronLeft, 
    ChevronRight, User, Filter, MoreVertical, FileText 
} from "lucide-react";

import CustomerInfoPanel from "@/components/features/chat/CustomerInfoPanel";

export default function AssociateDashboard() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const [stats, setStats] = useState({ target: 0, achieved: 0, pending: 0, followUp: 0, closed: 0, conversionRate: 0, total: 0 });
    const [leads, setLeads] = useState([]);
    const [notes, setNotes] = useState("");

    // Table States
    const [currentPage, setCurrentPage] = useState(1);
    const [filterType, setFilterType] = useState("All");
    const itemsPerPage = 6;

    // Info Panel States
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [panelLeadCategory, setPanelLeadCategory] = useState(null);
    const [panelActiveChat, setPanelActiveChat] = useState(null);

    // 👇 FIX: Automatic Redirect Logic for Admins
    useEffect(() => {
        if (status === "loading" || !session) return;

        const isSuperAdmin = session?.user?.role === "superAdmin";
        const isAdminDepartment = session?.user?.department === "admin";

        if (isSuperAdmin || isAdminDepartment) {
            router.replace("/crm/admin");
        }
    }, [session, status, router]);

    const handleNoteChange = (e) => {
        setNotes(e.target.value);
        localStorage.setItem("associate_notes", e.target.value);
    };

    useEffect(() => {
        if (!session?.user) return;
        
        const isSuperAdmin = session?.user?.role === "superAdmin";
        const isAdminDepartment = session?.user?.department === "admin";
        
        // Prevent fetching data if user is an admin (since they will be redirected)
        if (isSuperAdmin || isAdminDepartment) return;

        const savedNotes = localStorage.getItem("associate_notes");
        if (savedNotes) setNotes(savedNotes);

        async function loadData() {
            try {
                // Fetch Users for Targets
                const userRes = await fetch("/api/users");
                const users = await userRes.json();
                const me = Array.isArray(users) ? users.find(u => u.email === session.user.email) : null;

                const fetchSafe = async (url) => {
                    try {
                        const res = await fetch(url);
                        return res.ok ? await res.json() : [];
                    } catch(e) { return []; }
                };

                const [contacts, product, mdcamp, therapy] = await Promise.all([
                    fetchSafe("/api/contacts"),
                    fetchSafe("/api/category-chats/product"),
                    fetchSafe("/api/category-chats/mdcamp"),
                    fetchSafe("/api/category-chats/therapy")
                ]);

                const allLeads = [];

                // 1. Direct / Main Leads
                (Array.isArray(contacts) ? contacts : []).filter(l => l.associate === session.user.name).forEach(l => {
                    allLeads.push({ ...l, leadType: "Direct Lead", categoryParam: null });
                });

                // 2. Product Leads
                (Array.isArray(product) ? product : []).filter(l => l.assignedTo === session.user.name).forEach(l => {
                    allLeads.push({ ...l, leadType: "Product Lead", categoryParam: "product" });
                });

                // 3. MD Camp Leads
                (Array.isArray(mdcamp) ? mdcamp : []).filter(l => l.assignedTo === session.user.name).forEach(l => {
                    allLeads.push({ ...l, leadType: "MD Camp", categoryParam: "mdcamp" });
                });

                // 4. Therapy Leads
                (Array.isArray(therapy) ? therapy : []).filter(l => l.assignedTo === session.user.name).forEach(l => {
                    allLeads.push({ ...l, leadType: "Therapy", categoryParam: "therapy" });
                });

                let pending = 0;
                let followUp = 0;
                let closedThisMonth = 0;

                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                // Calculate Stats
                allLeads.forEach(lead => {
                    const leadDate = new Date(lead.date || lead.createdAt || new Date());

                    if (lead.status === "Closed" || lead.isClosed) {
                        if (leadDate.getMonth() === currentMonth && leadDate.getFullYear() === currentYear) {
                            closedThisMonth++;
                        }
                    } else if (lead.status === "Follow Up") {
                        const followUpDate = lead.followUpStart ? new Date(lead.followUpStart) : leadDate;
                        const hoursDiff = (now - followUpDate) / (1000 * 60 * 60);
                        if (hoursDiff > 48) pending++; else followUp++;
                    } else if (lead.status !== "Not Interested" && lead.status !== "Not Closed") {
                        pending++;
                    }
                });

                // Deduplicate Leads for table (Key: phone + leadType)
                const uniqueLeadsMap = new Map();
                allLeads.sort((a, b) => new Date(b.date || b.createdAt || 0) - new Date(a.date || a.createdAt || 0)).forEach(lead => {
                    const key = `${lead.phone}-${lead.leadType}`;
                    if (!uniqueLeadsMap.has(key)) {
                        uniqueLeadsMap.set(key, lead);
                    }
                });

                const uniqueLeads = Array.from(uniqueLeadsMap.values());

                const target = me ? parseInt(me.target || 0) : 0;
                const totalInteractions = pending + followUp + closedThisMonth;
                const conversionRate = totalInteractions > 0 ? Math.round((closedThisMonth / totalInteractions) * 100) : 0;

                setStats({
                    target, achieved: closedThisMonth, pending, followUp, closed: closedThisMonth, conversionRate,
                    total: uniqueLeads.length
                });
                setLeads(uniqueLeads);

            } catch (err) {
                console.error("Dashboard Load Error:", err);
            }
        }

        loadData();
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);

    }, [session]);

    const filteredLeads = filterType === "All" ? leads : leads.filter(l => l.leadType === filterType);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const openInfoPanel = (lead) => {
        setPanelLeadCategory(lead.categoryParam);
        setPanelActiveChat(lead);
        setIsInfoOpen(true);
        setMenuOpenId(null);
    };

    if (status === "loading" || !session) {
        return <div className="flex h-screen items-center justify-center text-slate-500 font-medium">Loading Dashboard...</div>;
    }
    
    // Prevent rendering if user is admin (they are being redirected)
    const isSuperAdmin = session.user?.role === "superAdmin";
    const isAdminDepartment = session.user?.department === "admin";
    if (isSuperAdmin || isAdminDepartment) {
        return null; 
    }

    const progressPercent = stats.target > 0 ? Math.min(100, Math.round((stats.achieved / stats.target) * 100)) : 0;

    return (
       <div className="flex h-[100dvh] bg-slate-50 relative">
            <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            {menuOpenId && <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)}></div>}

            <main className="flex-1 p-4 md:p-10 overflow-y-auto w-full">
                <button onClick={() => setMobileMenuOpen(true)} className="md:hidden mb-6 p-2 text-slate-600 bg-white rounded-lg shadow-sm border border-slate-200">
                    <Menu size={24} />
                </button>

                <div className="max-w-7xl mx-auto space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900">Welcome back, {session.user.name.split(' ')[0]}</h1>
                            <p className="text-slate-500 mt-1 text-sm">Here's your pipeline overview.</p>
                        </div>
                        <p className="text-sm font-medium text-slate-500">{new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatWidget label="Total Leads" value={stats.total} icon={<Inbox size={20} />} color="text-slate-600" bg="bg-slate-100" border="border-slate-200" />
                        <StatWidget label="Pending" value={stats.pending} icon={<Clock size={20} />} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
                        <StatWidget label="Follow Ups" value={stats.followUp} icon={<Users size={20} />} color="text-amber-600" bg="bg-amber-50" border="border-amber-100" />
                        
                        <Link href="/crm/associate/targets" className="group cursor-pointer col-span-2 md:col-span-1">
                            <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden transition-transform group-hover:-translate-y-1 h-full">
                                <div className="relative z-10">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Monthly Goal</span>
                                        <TrendingUp size={20} className="text-emerald-400" />
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-bold">{stats.achieved}</span>
                                        <span className="text-slate-500">/ {stats.target}</span>
                                    </div>
                                    <div className="w-full bg-slate-700 h-1.5 rounded-full mt-4 overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[400px]">
                            
                            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 bg-white">
                                <h3 className="font-bold text-slate-800">Your Leads Activity</h3>
                                <div className="flex items-center gap-2">
                                    <Filter size={16} className="text-slate-400" />
                                    <select 
                                        value={filterType} 
                                        onChange={e => { setFilterType(e.target.value); setCurrentPage(1); }}
                                        className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-700 cursor-pointer font-medium bg-slate-50 hover:bg-slate-100 transition-colors"
                                    >
                                        <option value="All">All Leads</option>
                                        <option value="Direct Lead">Direct Leads</option>
                                        <option value="Product Lead">Product Leads</option>
                                        <option value="MD Camp">MD Camp Leads</option>
                                        <option value="Therapy">Therapy Leads</option>
                                    </select>
                                </div>
                            </div>

                            <div className="w-full overflow-x-auto flex-1">
                                {filteredLeads.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-slate-400 gap-3">
                                        <Inbox size={40} className="text-slate-200" />
                                        <p>No leads found in this category.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left min-w-[650px] md:min-w-0">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                            <tr>
                                                <th className="px-6 py-4 w-1/3">Lead Details</th>
                                                <th className="px-6 py-4 w-1/5">Lead Type</th>
                                                <th className="px-6 py-4 w-1/5">Status</th>
                                                <th className="px-6 py-4 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {currentItems.map((lead, i) => (
                                                <tr key={`${lead.phone}-${lead.leadType}-${i}`} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-bold text-slate-900 line-clamp-1">{lead.name || "Unknown"}</div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{lead.phone}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <LeadTypeBadge type={lead.leadType} />
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <StatusBadge status={lead.status} />
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2 relative">
                                                            <button 
                                                                onClick={() => {
                                                                    if (lead.categoryParam) router.push(`/crm/${lead.categoryParam === 'product' ? 'product-lead' : (lead.categoryParam === 'mdcamp' ? 'md-camp' : 'therapy')}`);
                                                                    else router.push(`/crm/leads/${lead.phone}`);
                                                                }} 
                                                                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-emerald-700 font-bold text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-sm"
                                                            >
                                                                <User size={14} /> 
                                                                <span className="hidden sm:inline">View</span>
                                                            </button>
                                                            
                                                            <button 
                                                                onClick={() => setMenuOpenId(menuOpenId === lead.phone ? null : lead.phone)}
                                                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                                                            >
                                                                <MoreVertical size={16} />
                                                            </button>

                                                            {menuOpenId === lead.phone && (
                                                                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-100 shadow-xl rounded-xl py-1.5 z-40 animate-in fade-in zoom-in-95">
                                                                    <button 
                                                                        onClick={() => openInfoPanel(lead)}
                                                                        className="w-full text-left px-4 py-2.5 text-sm text-slate-700 font-medium hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 transition-colors"
                                                                    >
                                                                        <FileText size={16} className="text-emerald-600" />
                                                                        Info Panel
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            
                            {filteredLeads.length > itemsPerPage && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 mt-auto">
                                    <span className="text-xs text-slate-500 font-medium">Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, filteredLeads.length)} of {filteredLeads.length}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="p-2 border rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"><ChevronLeft size={16}/></button>
                                        <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 border rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-sm"><ChevronRight size={16}/></button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-6 flex flex-col shadow-sm h-full max-h-96 lg:max-h-auto">
                            <div className="flex items-center gap-2 mb-4 text-amber-800 font-bold"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Scratchpad</div>
                            <textarea value={notes} onChange={handleNoteChange} className="flex-1 bg-white/50 border-0 rounded-xl p-4 text-sm text-slate-700 outline-none resize-none focus:bg-white focus:ring-2 focus:ring-amber-200 transition-all placeholder:text-amber-800/30 custom-scrollbar" placeholder="Jot down quick reminders..."></textarea>
                        </div>
                    </div>
                </div>
            </main>

            <CustomerInfoPanel 
                isOpen={isInfoOpen} 
                onClose={() => setIsInfoOpen(false)} 
                leadCategory={panelLeadCategory} 
                activeChat={panelActiveChat} 
            />
        </div>
    );
}

function StatWidget({ label, value, icon, color, bg, border }) {
    return (
        <div className={`bg-white p-4 md:p-6 rounded-2xl shadow-sm border ${border} flex items-center gap-3 md:gap-4 transition-all hover:shadow-md`}>
            <div className={`p-2 md:p-3 rounded-xl ${bg} ${color}`}>{icon}</div>
            <div>
                <p className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wide">{label}</p>
                <p className="text-xl md:text-2xl font-bold text-slate-800 mt-0.5">{value}</p>
            </div>
        </div>
    );
}

function StatusBadge({ status }) {
    const styles = {
        "New": "bg-blue-100 text-blue-700 border-blue-200",
        "Follow Up": "bg-amber-100 text-amber-700 border-amber-200",
        "Closed": "bg-emerald-100 text-emerald-700 border-emerald-200",
        "Not Closed": "bg-red-100 text-red-700 border-red-100",
        "Not Interested": "bg-red-100 text-red-700 border-red-100"
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] md:text-xs font-bold tracking-wide border whitespace-nowrap ${styles[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {status || "New"}
        </span>
    );
}

function LeadTypeBadge({ type }) {
    const styles = {
        "Product Lead": "bg-blue-50 text-blue-700 border-blue-200",
        "MD Camp": "bg-amber-50 text-amber-700 border-amber-200",
        "Therapy": "bg-purple-50 text-purple-700 border-purple-200",
        "Direct Lead": "bg-slate-50 text-slate-700 border-slate-200"
    };
    return (
        <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide border whitespace-nowrap ${styles[type]}`}>
            {type}
        </span>
    );
}