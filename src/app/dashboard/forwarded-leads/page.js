"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import { useChatStore } from "@/store/chatStore";
import { 
    Search, Share2, MessageSquare, Calendar, User, Phone, ArrowRight, Menu, ChevronLeft, ChevronRight, ArrowRightCircle 
} from "lucide-react";

export default function ForwardedLeadsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const setSelectedChat = useChatStore((s) => s.setSelectedChat);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10; 

    const isAdmin = session?.user?.role === 'admin';

    const parseDate = (dateString) => {
        if (!dateString) return new Date(0);
        if (dateString.includes("T") || (dateString.includes("-") && dateString.includes(":"))) return new Date(dateString);
        const parts = dateString.split(" ");
        if (parts.length >= 2) {
            const dateParts = parts[0].split("/"); 
            const timeParts = parts[1].split(":"); 
            if (dateParts.length === 3) {
                return new Date(
                    parseInt(dateParts[2]), parseInt(dateParts[0]) - 1, parseInt(dateParts[1]), 
                    parseInt(timeParts[0] || 0), parseInt(timeParts[1] || 0), parseInt(timeParts[2] || 0)
                );
            }
        }
        return new Date(dateString);
    };

    useEffect(() => {
        if (!session) return;

        async function fetchForwardedLeads() {
            try {
                const res = await fetch("/api/chats");
                const data = await res.json();
                
                const rawList = data.filter(chat => chat.lastForwardedTo && chat.lastForwardedTo.length > 0);
                
                const uniqueLeadsMap = new Map();
                rawList.forEach((item) => {
                    if (!uniqueLeadsMap.has(item.phone)) {
                        uniqueLeadsMap.set(item.phone, item);
                    }
                });
                let uniqueLeads = Array.from(uniqueLeadsMap.values());

                if (!isAdmin) {
                    uniqueLeads = uniqueLeads.filter(lead => 
                        lead.forwardedBy === session.user.name || lead.lastForwardedName === session.user.name
                    );
                }

                uniqueLeads.sort((a, b) => {
                    const dateA = a.forwardDate ? parseDate(a.forwardDate) : new Date(0);
                    const dateB = b.forwardDate ? parseDate(b.forwardDate) : new Date(0);
                    return dateB - dateA;
                });

                setLeads(uniqueLeads);
            } catch (error) {
                console.error("Failed to load leads", error);
            } finally {
                setLoading(false);
            }
        }

        fetchForwardedLeads();
    }, [session, isAdmin]);

    useEffect(() => { setCurrentPage(1); }, [searchTerm]);

    const handleNavigateToChat = (chat) => {
        const chatObj = { ...chat, history: [chat] };
        setSelectedChat(chatObj);
        router.push("/dashboard/chat");
    };

    const filteredLeads = leads.filter(l => 
        (l.name && l.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.phone && l.phone.includes(searchTerm)) ||
        (l.forwardedBy && l.forwardedBy.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.lastForwardedName && l.lastForwardedName.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredLeads.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    if (!session) return null;

    return (
        <div className="flex h-[100dvh] bg-slate-50">
            <Sidebar role={session.user.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full">
                <button onClick={() => setMobileMenuOpen(true)} className="md:hidden mb-6 p-2 text-slate-600 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-all">
                    <Menu size={24} />
                </button>

                <div className="max-w-full mx-auto space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                <Share2 className="text-emerald-600" size={28} />
                                Forwarded Leads
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">Track internal lead transfers.</p>
                        </div>
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute left-3 top-3 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                            <input type="text" placeholder="Search leads..." className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col w-full">
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase font-semibold border-b border-slate-100">
                                    <tr>
                                        <th className="px-4 py-4 w-[20%]">Customer</th>
                                        <th className="px-4 py-4 w-[15%]">Forwarded By</th>
                                        <th className="px-4 py-4 w-[15%]">Forwarded To</th>
                                        <th className="px-4 py-4 w-[25%]">Message Note</th>
                                        <th className="px-4 py-4 w-[10%]">Date</th>
                                        <th className="px-4 py-4 w-[10%] text-center">Status</th>
                                        <th className="px-4 py-4 w-[5%] text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {loading ? (
                                        <tr><td colSpan="7" className="p-10 text-center text-slate-400 animate-pulse">Loading...</td></tr>
                                    ) : filteredLeads.length === 0 ? (
                                        <tr><td colSpan="7" className="p-10 text-center text-slate-400">No records found.</td></tr>
                                    ) : (
                                        currentItems.map((lead, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                                                            {lead.name ? lead.name.charAt(0).toUpperCase() : <User size={14} />}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-900 truncate">{lead.name || "Unknown"}</div>
                                                            <div className="text-xs text-slate-400 font-mono truncate">{lead.phone}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-blue-50 text-blue-600 rounded-md shrink-0"><User size={14} /></div>
                                                        <span className="font-semibold text-slate-700 truncate block max-w-[120px]">
                                                            {lead.forwardedBy || "Unknown"}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold text-emerald-700 flex items-center gap-1.5 truncate max-w-[140px]">
                                                            <ArrowRightCircle size={14} className="text-emerald-500 shrink-0"/> 
                                                            {lead.lastForwardedName || "Unknown"}
                                                        </span>
                                                        <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 ml-5 truncate">
                                                            <Phone size={10} /> {lead.lastForwardedTo}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4">
                                                    <div className="text-slate-600 italic text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-100 whitespace-normal leading-relaxed">
                                                        "{lead.forwardMessage || "No message"}"
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-slate-500 text-xs font-medium whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar size={12}/>
                                                        {lead.forwardDate ? parseDate(lead.forwardDate).toLocaleDateString() : "-"}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-4 text-center">
                                                    {lead.isClosed === "TRUE" ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">COMPLETED</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 whitespace-nowrap">PENDING</span>
                                                    )}
                                                </td>

                                                <td className="px-4 py-4 text-right">
                                                    <button onClick={() => handleNavigateToChat(lead)} className="inline-flex items-center justify-center w-8 h-8 md:w-auto md:h-auto md:px-3 md:py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-emerald-600 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 transition-all shadow-sm">
                                                        <MessageSquare size={16} className="md:mr-1.5" /> <span className="hidden md:inline">View</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        {filteredLeads.length > itemsPerPage && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                <span className="text-xs text-slate-500 font-medium">
                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredLeads.length)} of {filteredLeads.length} leads
                                </span>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"><ChevronLeft size={16} /></button>
                                    <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-all"><ChevronRight size={16} /></button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}