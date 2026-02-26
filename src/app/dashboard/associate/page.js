"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Sidebar from "@/components/layout/Sidebar";
import { useChatStore } from "@/store/chatStore";
import { useRouter } from "next/navigation";
import { TrendingUp, Users, Clock, Menu, Inbox, CheckCircle, BarChart3, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";

export default function AssociateDashboard() {
    const { data: session } = useSession();
    const router = useRouter();
    const setSelectedChat = useChatStore((s) => s.setSelectedChat);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const [stats, setStats] = useState({ target: 0, achieved: 0, pending: 0, followUp: 0, closed: 0, conversionRate: 0, total: 0 });
    const [leads, setLeads] = useState([]);
    const [notes, setNotes] = useState("");

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    const handleNoteChange = (e) => {
        setNotes(e.target.value);
        localStorage.setItem("associate_notes", e.target.value);
    };

    useEffect(() => {
        if (!session?.user) return;

        const savedNotes = localStorage.getItem("associate_notes");
        if (savedNotes) setNotes(savedNotes);

        async function loadData() {
            try {
                // Fetch Users for Targets
                const userRes = await fetch("/api/users");
                const users = await userRes.json();
                const me = users.find(u => u.email === session.user.email);

                // Fetch Chats for Live Stats
                const chatRes = await fetch("/api/chats");
                const chats = await chatRes.json();

                // 1. Unique Leads Logic (Latest Status)
                const uniqueLeads = Object.values(chats.reduce((acc, msg) => {
                    if (!acc[msg.phone]) acc[msg.phone] = msg;
                    return acc;
                }, {}));

                // 2. Filter My Leads
                const myLeads = uniqueLeads.filter(l => l.currentHandler === session.user.name);

                // 3. Calculate Stats based on Status
                // Pending = "New" OR "Not Closed"
                const pending = myLeads.filter(l => l.status === "New" || l.status === "Not Closed" || l.status === "Not Interested").length;
                
                // Follow Up = "Follow Up" only
                const followUp = myLeads.filter(l => l.status === "Follow Up").length;
                
                // Closed (Active in pipeline)
                const closedActive = myLeads.filter(l => l.status === "Closed").length; 
                
                // Historical Achievement (from User Profile)
                const achievedTotal = me ? parseInt(me.achieved || 0) : 0;
                
                // Total Interactions
                const totalInteractions = pending + followUp + closedActive;

                // Conversion Rate
                const conversionRate = totalInteractions > 0 ? Math.round((closedActive / totalInteractions) * 100) : 0;

                setStats({
                    target: me ? parseInt(me.target || 0) : 0,
                    achieved: achievedTotal, 
                    pending,
                    followUp,
                    closed: closedActive,
                    conversionRate,
                    total: totalInteractions
                });

                setLeads(myLeads.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));

            } catch (err) {
                console.error("Dashboard Load Error:", err);
            }
        }

        loadData();
        // Poll every 10s to keep stats updated "same time"
        const interval = setInterval(loadData, 10000);
        return () => clearInterval(interval);

    }, [session]);

    const handleNavigateToChat = (lead) => {
        const chatObj = { ...lead, history: [lead] };
        setSelectedChat(chatObj);
        router.push("/dashboard/chat");
    };

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = leads.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(leads.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    if (!session) return null;

    const progressPercent = stats.target > 0 ? Math.min(100, Math.round((stats.achieved / stats.target) * 100)) : 0;

    return (
        <div className="flex h-[100dvh] bg-slate-50">
            <Sidebar role={session.user.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

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

                    {/* STATS GRID */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatWidget label="Total Leads" value={stats.total} icon={<Inbox size={20} />} color="text-slate-600" bg="bg-slate-100" border="border-slate-200" />
                        
                        {/* Pending includes 'New' and 'Not Closed' */}
                        <StatWidget label="Pending" value={stats.pending} icon={<Clock size={20} />} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
                        
                        <StatWidget label="Follow Ups" value={stats.followUp} icon={<Users size={20} />} color="text-amber-600" bg="bg-amber-50" border="border-amber-100" />
                        
                        <Link href="/dashboard/associate/targets" className="group cursor-pointer col-span-2 md:col-span-1">
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
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                                <h3 className="font-bold text-slate-800">Your Leads Activity</h3>
                                <Link href="/dashboard/customers" className="text-sm text-emerald-600 font-medium hover:underline">View All</Link>
                            </div>

                            <div className="w-full overflow-x-auto">
                                {leads.length === 0 ? (
                                    <div className="p-10 text-center text-slate-400">No leads assigned to you yet.</div>
                                ) : (
                                    <table className="w-full text-left min-w-[600px] md:min-w-0">
                                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                                            <tr>
                                                <th className="px-6 py-4 w-2/5">Lead Name</th>
                                                <th className="px-6 py-4 w-1/5">Status</th>
                                                <th className="px-6 py-4 w-1/5 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {currentItems.map((lead, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <div className="font-medium text-slate-900">{lead.name || "Unknown"}</div>
                                                        <div className="text-xs text-slate-400 font-mono">{lead.phone}</div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <StatusBadge status={lead.status} />
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => handleNavigateToChat(lead)} className="inline-flex items-center gap-2 text-slate-500 hover:text-emerald-600 font-bold text-xs border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-emerald-50 hover:border-emerald-200 transition-all">
                                                            <MessageSquare size={14} /> 
                                                            <span className="hidden sm:inline">Open Chat</span>
                                                            <span className="sm:hidden">Chat</span>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            
                            {/* Pagination */}
                            {leads.length > itemsPerPage && (
                                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                    <span className="text-xs text-slate-500 font-medium">Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, leads.length)} of {leads.length}</span>
                                    <div className="flex gap-2">
                                        <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50"><ChevronLeft size={16}/></button>
                                        <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50"><ChevronRight size={16}/></button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Scratchpad */}
                        <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-6 flex flex-col shadow-sm h-full max-h-96 lg:max-h-auto">
                            <div className="flex items-center gap-2 mb-4 text-amber-800 font-bold"><div className="w-2 h-2 rounded-full bg-amber-500"></div>Scratchpad</div>
                            <textarea value={notes} onChange={handleNoteChange} className="flex-1 bg-white/50 border-0 rounded-xl p-4 text-sm text-slate-700 outline-none resize-none focus:bg-white focus:ring-2 focus:ring-amber-200 transition-all placeholder:text-amber-800/30" placeholder="Jot down quick reminders..."></textarea>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatWidget({ label, value, icon, color, bg, border }) {
    return (
        <div className={`bg-white p-4 md:p-6 rounded-2xl shadow-sm border ${border} flex items-center gap-3 md:gap-4`}>
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
            {status}
        </span>
    );
}