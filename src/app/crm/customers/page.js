"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePathStore } from "@/store/pathStore";

import Sidebar from "@/components/layout/Sidebar";
import { Search, User, MapPin, Eye, Loader2, Menu, Plus, ChevronLeft, ChevronRight, ArrowRight,  X, Phone, Globe } from "lucide-react";
import { getStatusColor } from "@/utils/colorUtils";
import { toast } from "react-toastify";

// --- Custom Debounce Hook ---
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedValue(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debouncedValue;
}

export default function CustomersPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { setPath } = usePathStore();
    const pathname = usePathname();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [rawCustomers, setRawCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // --- Search & Pagination State ---
    const [searchTerm, setSearchTerm] = useState("");
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // --- Modal State ---
    const [showAddModal, setShowAddModal] = useState(false);

    useEffect(() => {
        if (status === "unauthenticated") router.replace("/");
    }, [status, router]);

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
                toast.error("Failed to load customers.");
            } finally {
                setLoading(false);
            }
        };
        if (status === "authenticated") fetchCustomers();
    }, [status]);

    // --- Data Processing Layer ---
    const { filteredCustomers, paginatedCustomers, totalPages } = useMemo(() => {
        const grouped = {};
        rawCustomers.forEach(item => {
            const cleanPhone = item.phone?.replace(/\D/g, '') || "unknown";
            if (!grouped[cleanPhone]) {
                grouped[cleanPhone] = item;
            }
        });

        let arr = Object.values(grouped).sort((a, b) => new Date(b.date) - new Date(a.date));

        if (debouncedSearchTerm) {
            const lower = debouncedSearchTerm.toLowerCase();
            arr = arr.filter(c =>
                (c.name && c.name.toLowerCase().includes(lower)) ||
                (c.phone && c.phone.includes(lower)) ||
                (c.city && c.city.toLowerCase().includes(lower))
            );
        }

        const total = Math.ceil(arr.length / pageSize);
        const paginated = arr.slice((currentPage - 1) * pageSize, currentPage * pageSize);

        return { filteredCustomers: arr, paginatedCustomers: paginated, totalPages: total };
    }, [rawCustomers, debouncedSearchTerm, currentPage, pageSize]);

    // Reset to page 1 when search or page size changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, pageSize]);

    const handleCustomerClick = (phone) => {
        if (!phone) return;
        setPath(pathname);
        router.push(`/crm/customers/${phone.replace(/\D/g, '')}`);
    };

    const handleAddCustomerOptimistic = (newCustomer) => {
        setRawCustomers(prev => [newCustomer, ...prev]);
        setShowAddModal(false);
    };

    if (status === "loading" || !session) return null;

    return (
        <div className="flex h-screen bg-[#f8fafc] font-sans overflow-hidden">
            {/* Mobile Overlay */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} aria-hidden="true" />
            )}

            <Sidebar role={session?.user?.role || "sales"} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                
                {/* --- HEADER --- */}
                <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 shadow-sm gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                            <Menu size={24} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Customer Directory</h1>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Master Database</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/20 transition-all w-full md:w-64 lg:w-80">
                            <Search size={16} className="text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search customers..."
                                title="Search by name, phone, or city"
                                className="bg-transparent border-none outline-none text-sm font-medium ml-2 w-full text-slate-700 placeholder:text-slate-400"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={() => setShowAddModal(true)} 
                            className="flex items-center justify-center gap-2 bg-[#00a884] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-200/50 transition-all active:scale-95 shrink-0"
                        >
                            <Plus size={18} /> <span className="hidden sm:inline">Add Customer</span>
                        </button>
                    </div>
                </header>

                {/* --- CONTENT --- */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    <div className="max-w-[1700px] mx-auto flex flex-col h-full">
                        
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <Loader2 size={32} className="animate-spin text-[#00a884] mb-4" />
                                <p className="text-sm font-bold uppercase tracking-widest">Loading Records...</p>
                            </div>
                        ) : filteredCustomers.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm p-10">
                                <User size={48} className="mb-4 opacity-20 text-slate-500" />
                                <p className="text-base font-bold text-slate-700 mb-1">No customers found.</p>
                                <p className="text-sm text-slate-500">Try adjusting your search criteria or add a new customer.</p>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto">
                                    <CustomerTable customers={paginatedCustomers} onClick={handleCustomerClick} />
                                </div>
                                {/* Mobile Card View */}
                                <div className="block md:hidden bg-slate-50 p-4 space-y-3">
                                    <CustomerMobileList customers={paginatedCustomers} onClick={handleCustomerClick} />
                                </div>

                                {/* Pagination Footer */}
                                <PaginationControls 
                                    currentPage={currentPage} 
                                    totalPages={totalPages} 
                                    totalRecords={filteredCustomers.length}
                                    pageSize={pageSize}
                                    onPageChange={setCurrentPage}
                                    onPageSizeChange={setPageSize}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Add Customer Modal */}
                {showAddModal && <AddCustomerModal onClose={() => setShowAddModal(false)} onSuccess={handleAddCustomerOptimistic} />}
            </main>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const CustomerTable = ({ customers, onClick }) => (
    <table className="w-full text-left border-collapse">
        <thead className="bg-slate-50 text-slate-500 text-[11px] sticky top-0 uppercase font-bold tracking-wider border-b border-slate-200">
            <tr>
                <th className="px-6 py-4">Customer Details</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4">Enquired For</th>
                <th className="px-6 py-4">Current Status</th>
                <th className="px-6 py-4">Total Visits</th>
                <th className="px-6 py-4 text-right">Actions</th>
            </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm">
            {customers.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors group cursor-pointer" onClick={() => onClick(c.phone)}>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center text-emerald-700 font-extrabold shadow-sm border border-emerald-200 shrink-0">
                                {c.name && c.name !== "Unknown" ? c.name.charAt(0).toUpperCase() : "#"}
                            </div>
                            <div>
                                <div className="font-extrabold text-slate-800 truncate max-w-[180px]">{c.name || "Unknown"}</div>
                                <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                                    <MapPin size={10} className="text-slate-400" /> {c.city || "No City Specified"}
                                </div>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 w-max">{c.phone.replace('whatsapp:', '')}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-[200px] truncate font-medium">
                        {c.enquiredFor || "-"}
                    </td>
                    <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap ${getStatusColor(c.status)}`}>
                            {c.status}
                        </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">
                        <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-lg text-xs">{c.visitCount || 1}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <button className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-white hover:bg-[#00a884] transition-all shadow-sm">
                            <ArrowRight size={14} />
                        </button>
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
);

const CustomerMobileList = ({ customers, onClick }) => (
    <>
        {customers.map((c, idx) => (
            <div key={idx} onClick={() => onClick(c.phone)} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-3 active:scale-[0.98] transition-transform">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center text-emerald-700 font-extrabold text-lg shadow-sm border border-emerald-200 shrink-0">
                        {c.name && c.name !== "Unknown" ? c.name.charAt(0).toUpperCase() : "#"}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-slate-800 text-base truncate">{c.name || "Unknown"}</div>
                        <div className="font-mono text-xs font-bold text-slate-500 mt-1">{c.phone.replace('whatsapp:', '')}</div>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1 border-t border-slate-50 pt-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(c.status)}`}>{c.status}</span>
                    {c.city && <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md"><MapPin size={10} /> {c.city}</span>}
                </div>
            </div>
        ))}
    </>
);

const PaginationControls = ({ currentPage, totalPages, totalRecords, pageSize, onPageChange, onPageSizeChange }) => {
    return (
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm font-semibold text-slate-500 flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
                <span>Showing <strong className="text-slate-800">{Math.min((currentPage - 1) * pageSize + 1, totalRecords)}</strong> to <strong className="text-slate-800">{Math.min(currentPage * pageSize, totalRecords)}</strong> of <strong className="text-slate-800">{totalRecords}</strong></span>
                <div className="w-px h-4 bg-slate-300 hidden sm:block"></div>
                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline">Per page:</span>
                    <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500/20">
                        {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                <button 
                    onClick={() => onPageChange(prev => Math.max(prev - 1, 1))} 
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronLeft size={16} />
                </button>
                
                {/* Simple page numbers logic */}
                <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        // Show current, first, last, and neighbors
                        if (page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)) {
                            return (
                                <button 
                                    key={page} 
                                    onClick={() => onPageChange(page)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-bold transition-all ${currentPage === page ? "bg-[#00a884] text-white shadow-md shadow-emerald-200" : "text-slate-600 hover:bg-slate-100"}`}
                                >
                                    {page}
                                </button>
                            );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                            return <span key={page} className="text-slate-400 text-xs tracking-widest">...</span>;
                        }
                        return null;
                    })}
                </div>

                <button 
                    onClick={() => onPageChange(prev => Math.min(prev + 1, totalPages))} 
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

// --- Add Customer Modal ---
const AddCustomerModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({ name: "", phone: "", city: "", address: "", source: "Manual Entry" });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.phone.trim()) return toast.error("Phone number is required");
        
        setSaving(true);
        try {
            const res = await fetch("/api/customers", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });
            const result = await res.json();
            
            if (!res.ok) throw new Error(result.error || "Failed to add customer");
            
            toast.success("Customer added successfully!");
            onSuccess(result.data);
        } catch (error) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in">
            <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4">
                <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-100">
                    <div>
                        <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">New Customer</h3>
                        <p className="text-sm text-slate-500 font-medium mt-1">Add a record to the directory manually.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"><X size={20} /></button>
                </div>
                
                <form onSubmit={handleSubmit} className="p-8 space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phone Number <span className="text-rose-500">*</span></label>
                        <div className="relative">
                            <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input type="tel" required placeholder="e.g. 919876543210" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Full Name</label>
                            <div className="relative">
                                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="John Doe" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">City</label>
                            <div className="relative">
                                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input type="text" placeholder="Location" className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 col-span-2">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Full Address</label>
                            <input type="text" placeholder="Street, Landmark..." className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Source / Origin</label>
                        <div className="relative">
                            <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm appearance-none cursor-pointer" value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})}>
                                <option value="Manual Entry">Manual Entry</option>
                                <option value="WhatsApp">WhatsApp</option>
                                <option value="Direct Call">Direct Call</option>
                                <option value="Reference">Reference</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-3.5 text-sm rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-all border border-transparent">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 py-3.5 bg-[#00a884] text-white text-sm rounded-xl font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Save Customer
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
