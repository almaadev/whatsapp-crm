"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import { Search, User, MapPin, Eye, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { usePathname } from 'next/navigation';
import { usePathStore } from "@/store/pathStore";
import { useRouter } from "next/navigation";

export default function CustomersPage() {
    const { data: session } = useSession();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);
    const { setPath } = usePathStore()
    const pathname = usePathname();
    const router = useRouter()
    // --- PAGINATION STATE ---
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;

    // Helper Date Parser
    const parseDate = (dateString) => {
        if (!dateString) return new Date(0);
        if (dateString.includes("T") || (dateString.includes("-") && dateString.includes(":"))) return new Date(dateString);
        const parts = dateString.split(" ");
        if (parts.length >= 2) {
            const dateParts = parts[0].split("/");
            const timeParts = parts[1].split(":");
            if (dateParts.length === 3) {
                return new Date(
                    parseInt(dateParts[2]),
                    parseInt(dateParts[0]) - 1,
                    parseInt(dateParts[1]),
                    parseInt(timeParts[0] || 0),
                    parseInt(timeParts[1] || 0),
                    parseInt(timeParts[2] || 0)
                );
            }
        }
        return new Date(dateString);
    };

    useEffect(() => {
        if (!session) return;
        fetch("/api/chats")
            .then(res => res.json())
            .then(data => {
                const unique = data.reduce((acc, current) => {
                    if (!acc[current.phone]) acc[current.phone] = current;
                    return acc;
                }, {});

                const sorted = Object.values(unique).sort((a, b) =>
                    parseDate(b.timestamp) - parseDate(a.timestamp)
                );
                setCustomers(sorted);
                setLoading(false);
            });
    }, [session]);

    // Reset to page 1 when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const handleRedirect =(phone)=>{        
        setPath(pathname)
        router.push(`/dashboard/customers/${phone}`)
    }
    // 1. FILTER
    const filtered = customers.filter(c =>
        (c.name && c.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.phone && c.phone.includes(searchTerm)) ||
        (c.city && c.city.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // 2. PAGINATE
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filtered.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    return (
        <div className="flex h-[100dvh] bg-slate-50">
            <Sidebar role={session?.user?.role || "sales"} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            <main className="flex-1 p-6 md:p-10 overflow-y-auto">
                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="md:hidden mb-6 p-2 text-slate-600 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
                >
                    <Menu size={24} />
                </button>

                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Customer Database</h1>
                            <p className="text-slate-500 text-sm mt-1">Manage and track all customer interactions in one place.</p>
                        </div>

                        <div className="relative w-full md:w-80 group">
                            <Search className="absolute left-3 top-3 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="Search by name, phone, city..."
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white shadow-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all placeholder:text-slate-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Contact</th>
                                        <th className="px-6 py-4">Location</th>
                                        <th className="px-6 py-4">Associate</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">View Detail</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {loading ? (
                                        <tr><td colSpan="6" className="p-10 text-center text-slate-400 animate-pulse">Loading customer records...</td></tr>
                                    ) : filtered.length === 0 ? (
                                        <tr><td colSpan="6" className="p-10 text-center text-slate-400">No customers found matching your search.</td></tr>
                                    ) : (
                                        currentItems.map((c, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shadow-sm">
                                                            {c.name ? c.name.charAt(0).toUpperCase() : <User size={14} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900">{c.name || "Unknown"}</div>
                                                            <div className="text-[12px] text-slate-400">
                                                                Joined : {c.timestamp
                                                                    ? new Date(c.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/ /g, '/')
                                                                    : "N/A"
                                                                }
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 font-mono text-xs">{c.phone}</td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {c.city ? <div className="flex items-center gap-1.5"><MapPin size={14} className="text-slate-400" /> {c.city}</div> : <span className="text-slate-300">-</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-xs font-medium px-2 py-1 rounded-md ${c.currentHandler ? "bg-slate-100 text-slate-600" : "text-slate-400 italic"}`}>
                                                        {c.currentHandler || "Unassigned"}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <StatusBadge status={c.status} />
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div onClick={()=>handleRedirect(encodeURIComponent(c.phone))}
                                                        
                                                        className="text-slate-400 hover:text-emerald-600 transition-colors inline-block p-2 rounded-full hover:bg-emerald-50 opacity-95 group-hover:opacity-100"
                                                    >
                                                        <Eye size={18} />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* --- PAGINATION CONTROLS --- */}
                        {filtered.length > itemsPerPage && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                <span className="text-xs text-slate-500 font-medium">
                                    Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filtered.length)} of {filtered.length} customers
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => paginate(currentPage - 1)}
                                        disabled={currentPage === 1}
                                        className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        <ChevronLeft size={16} />
                                    </button>

                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => (
                                            <button
                                                key={i + 1}
                                                onClick={() => paginate(i + 1)}
                                                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1
                                                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-200"
                                                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                                    }`}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => paginate(currentPage + 1)}
                                        disabled={currentPage === totalPages}
                                        className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

function StatusBadge({ status }) {
    const styles = {
        "New": "bg-blue-100 text-blue-700 border-blue-200",
        "Follow Up": "bg-amber-100 text-amber-700 border-amber-200",
        "Closed": "bg-emerald-100 text-emerald-700 border-emerald-200",
        "Not Closed": "bg-red-50 text-red-700 border-red-100"
    };
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide border ${styles[status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
            {status}
        </span>
    );
}