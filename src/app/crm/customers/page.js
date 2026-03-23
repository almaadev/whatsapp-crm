"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePathStore } from "@/store/pathStore";
import { usePathname } from 'next/navigation';

import Sidebar from "@/components/layout/Sidebar";
import { Search, User, MapPin, Eye, Loader2, Menu } from "lucide-react";
import { getStatusColor } from "@/utils/colorUtils";

export default function CustomersPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const { setPath } = usePathStore();
    const pathname = usePathname();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [rawCustomers, setRawCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const res = await fetch("/api/customers", { cache: 'no-store' });
                const data = await res.json();
                if (res.ok && Array.isArray(data)) {
                    setRawCustomers(data);
                }
            } catch (error) {
                console.error("Failed to fetch customers", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCustomers();
    }, []);

    const processedCustomers = useMemo(() => {
        const grouped = {};
        rawCustomers.forEach(item => {
            const cleanPhone = item.phone?.replace(/\D/g, '') || "unknown";
            if (!grouped[cleanPhone]) {
                grouped[cleanPhone] = item;
            }
        });

        let arr = Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            arr = arr.filter(c =>
                (c.name && c.name.toLowerCase().includes(lower)) ||
                (c.phone && c.phone.includes(lower)) ||
                (c.city && c.city.toLowerCase().includes(lower))
            );
        }
        return arr;
    }, [rawCustomers, searchTerm]);

    const handleCustomerClick = (phone) => {
        setPath(pathname);
        router.push(`/crm/customers/${phone.replace(/\D/g, '')}`);
    };

    if (!session) return null;

    return (
        <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
            <Sidebar role={session?.user?.role || "sales"} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 px-4 md:px-8 py-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-700">
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl font-bold text-slate-800">Customer Directory</h1>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center bg-slate-100 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/20 transition-all w-64 lg:w-80">
                            <Search size={16} className="text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search customers..."
                                title="Search customers by name, phone, or city"
                                className="bg-transparent border-none outline-none text-sm ml-2 w-full text-slate-700 placeholder:text-slate-400"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#f8fafc]">
                    <div className="md:hidden mb-4 flex items-center bg-white rounded-xl px-3 py-2 border border-slate-200 shadow-sm">
                        <Search size={16} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            title="Search customers by name, phone, or city"
                            className="bg-transparent border-none outline-none text-sm ml-2 w-full text-slate-700"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <Loader2 size={32} className="animate-spin text-emerald-500 mb-4" />
                            <p className="text-sm font-medium">Loading customers...</p>
                        </div>
                    ) : processedCustomers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                            <User size={48} className="mb-4 opacity-20" />
                            <p className="text-sm font-medium">No customers found.</p>
                        </div>
                    ) : (
                        <div className="container mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase font-semibold border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 md:px-6 py-4">Customer</th>
                                            <th className="px-4 md:px-6 py-4">Contact</th>
                                            {/* 👇 FIX: hidden md:table-cell add panniyachu for mobile hiding */}
                                            <th className="px-6 py-4 hidden md:table-cell">Enquired For</th>
                                            <th className="px-6 py-4 hidden md:table-cell">Status</th>
                                            <th className="px-6 py-4 hidden md:table-cell">Visits</th>
                                            <th className="px-6 py-4 hidden md:table-cell text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {processedCustomers.map((customer, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/80 transition-colors group cursor-pointer" onClick={() => handleCustomerClick(customer.phone)}>
                                                <td className="px-4 md:px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-emerald-700 font-bold shadow-inner shrink-0">
                                                            {customer.name && customer.name !== "Unknown" ? customer.name.charAt(0).toUpperCase() : "#"}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-slate-900 line-clamp-1">{customer.name || "Unknown"}</div>
                                                            <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                                                                <MapPin size={10} /> {customer.city || "N/A"}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 md:px-6 py-4">
                                                    <div className="font-mono font-medium text-slate-700">{customer.phone}</div>
                                                </td>
                                                {/* 👇 FIX: hidden md:table-cell add panniyachu */}
                                                <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate hidden md:table-cell">
                                                    {customer.enquiredFor || "-"}
                                                </td>
                                                <td className="px-6 py-4 hidden md:table-cell">
                                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(customer.status)}`}>
                                                        {customer.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-slate-700 hidden md:table-cell">
                                                    {customer.visitCount || 1}
                                                </td>
                                                <td className="px-6 py-4 text-right hidden md:table-cell">
                                                    <button className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all">
                                                        <Eye size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}