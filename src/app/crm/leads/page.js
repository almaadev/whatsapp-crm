"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePathStore } from "@/store/pathStore";
import {
    Save, User, Phone, MapPin, Tag, FileText, AlertCircle, Loader2, X, Plus, Search,
    RefreshCcw, Flag, ChevronDown, ChevronUp, History, UserCircle, BadgeCheck, Clock,
    TrendingUp, CornerDownRight, ArrowRight, Copy, Check, CheckCircle2, ChevronLeft, ChevronRight
} from "lucide-react";

import { toast } from "react-toastify";
import Sidebar from "@/components/layout/Sidebar";

// ─────────────────────────────────────────────────────────────────────────────
//  STATUS & UI CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const LIFECYCLE_CONFIG = {
    "New": { color: "blue", icon: <AlertCircle size={12} /> },
    "Follow Up": { color: "amber", icon: <Clock size={12} /> },
    "Closed": { color: "emerald", icon: <BadgeCheck size={12} /> },
    "Not Interested": { color: "slate", icon: <X size={12} /> },
};

const LifecycleBadge = ({ state }) => {
    const cfg = LIFECYCLE_CONFIG[state] ?? LIFECYCLE_CONFIG["New"];
    const cls = {
        blue: "bg-blue-50 text-blue-700 border-blue-200",
        amber: "bg-amber-50 text-amber-700 border-amber-200",
        emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
        slate: "bg-slate-100 text-slate-600 border-slate-200",
    }[cfg.color];
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1  ${cls} whitespace-nowrap`}>
            {cfg.icon} {state}
        </span>
    );
};

export default function LeadsPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const role = session?.user?.role;
    const { setPath } = usePathStore();
    const pathname = usePathname();

    const [mobileOpen, setMobileOpen] = useState(false);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetchingLeads, setFetchingLeads] = useState(true);
    const [rawLeads, setRawLeads] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [copiedPhone, setCopiedPhone] = useState(null);

    // --- Pagination State ---
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [formData, setFormData] = useState({
        phone: "", name: "", city: "", address: "",
        source: "Manual Entry", enquiredFor: "", priority: "Medium", status: "New", remarks: ""
    });

    const fetchRecentLeads = async () => {
        setFetchingLeads(true);
        try {
            const res = await fetch("/api/leads");
            if (res.ok) {
                const data = await res.json();
                setRawLeads(data);
            } else {
                const err = await res.json();
                throw new Error(err.error || "Failed to fetch");
            }
        } catch (err) {
            console.error("Error fetching leads:", err);
            toast.error("Failed to sync leads database.");
        } finally {
            setFetchingLeads(false);
        }
    };

    useEffect(() => {
        fetchRecentLeads();
    }, []);

    // Reset pagination when search query or page size changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, pageSize]);

    const handleCustomerRedirect = (phone) => {
        setPath(pathname);
        router.push(`/crm/leads/${phone.replace('whatsapp:', '')}`);
    };

    // --- Data Processing (Derive strictly from leads[] array) ---
    const processedLeads = useMemo(() => {
        let list = [...rawLeads];

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            list = list.filter(lead =>
                (lead.name && lead.name.toLowerCase().includes(lowerTerm)) ||
                (lead.phone && lead.phone.includes(lowerTerm)) ||
                (lead.city && lead.city.toLowerCase().includes(lowerTerm)) ||
                (lead.leadType && lead.leadType.toLowerCase().includes(lowerTerm))
            );
        }

        // Sort by the latest interaction timestamp in the leads[] array
        return list.sort((a, b) => {
            const aLatest = a.leads?.length ? new Date(a.leads[a.leads.length - 1].date).getTime() : new Date(a.createdAt).getTime();
            const bLatest = b.leads?.length ? new Date(b.leads[b.leads.length - 1].date).getTime() : new Date(b.createdAt).getTime();
            return bLatest - aLatest;
        });
    }, [rawLeads, searchTerm]);

    // --- Pagination Processing ---
    const { paginatedLeads, totalPages } = useMemo(() => {
        const total = Math.ceil(processedLeads.length / pageSize);
        const paginated = processedLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);
        return { paginatedLeads: paginated, totalPages: total };
    }, [processedLeads, currentPage, pageSize]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCopyPhone = (e, phone) => {
        e.preventDefault();
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
            const res = await fetch("/api/leads", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    overAllRemarks: formData.remarks,
                    date: new Date().toISOString()
                }),
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

    if (status === "loading") {
        return <div className="flex h-screen items-center justify-center text-slate-500">Loading...</div>;
    }

    return (
        <div className="flex h-[100dvh] bg-[#f8fafc] overflow-hidden font-sans">
            <Sidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} role={role || "associate"} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* --- HEADER --- */}
                <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-10 shadow-sm gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 text-slate-500 md:hidden hover:bg-slate-100 rounded-lg">
                            <MenuIcon />
                        </button>
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">Lead Intelligence</h1>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Pipeline & Auditing</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/20 transition-all w-full md:w-64">
                            <Search size={16} className="text-slate-400" />
                            <input type="text" placeholder="Search pipeline..." className="bg-transparent border-none outline-none text-sm font-medium ml-2 w-full text-slate-700 placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>

                        <button onClick={fetchRecentLeads} disabled={fetchingLeads} className="p-2 text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-all" title="Refresh Pipeline">
                            <RefreshCcw size={18} className={fetchingLeads ? "animate-spin" : ""} />
                        </button>

                        <button onClick={() => setShowCreateForm(true)} className="flex items-center justify-center gap-2 bg-[#00a884] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-200/50 transition-all active:scale-95 shrink-0">
                            <Plus size={18} /> <span className="hidden sm:inline">New Lead</span>
                        </button>
                    </div>
                </header>

                {/* --- MAIN CONTENT --- */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar flex flex-col">
                    <div className="max-w-[1700px] mx-auto w-full  flex flex-col space-y-4">
                        {fetchingLeads && rawLeads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                                <Loader2 size={32} className="animate-spin mb-3 text-[#00a884]" />
                                <span className="text-sm font-bold uppercase tracking-wider">Syncing Leads Data...</span>
                            </div>
                        ) : processedLeads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
                                <History size={48} className="mb-4 opacity-20" />
                                <p className="text-sm font-bold text-slate-600">No leads found in the pipeline.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col  flex-1">
                                    {paginatedLeads.map((lead, idx) => (
                                        <LeadIntelligenceRecord
                                            key={lead._id || idx}
                                            lead={lead}
                                            handleCustomerRedirect={handleCustomerRedirect}
                                            handleCopyPhone={handleCopyPhone}
                                            copiedPhone={copiedPhone}
                                        />
                                    ))}
                                </div>

                                {/* Pagination Footer */}
                                <PaginationControls
                                    currentPage={currentPage}
                                    totalPages={totalPages}
                                    totalRecords={processedLeads.length}
                                    pageSize={pageSize}
                                    onPageChange={setCurrentPage}
                                    onPageSizeChange={setPageSize}
                                />
                            </>
                        )}
                    </div>
                </main>

                {/* --- CREATE FORM MODAL --- */}
                {showCreateForm && (
                    <CreateLeadModal
                        formData={formData}
                        handleChange={handleChange}
                        handleSubmit={handleSubmit}
                        setShowCreateForm={setShowCreateForm}
                        loading={loading}
                    />
                )}
            </div>
        </div>
    );
}


const PaginationControls = ({ currentPage, totalPages, totalRecords, pageSize, onPageChange, onPageSizeChange }) => {
    return (
        <div className="mt-4 px-6 py-4 border border-slate-200 bg-white rounded-2xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm font-semibold text-slate-500 flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
                <span>Showing <strong className="text-slate-800">{Math.min((currentPage - 1) * pageSize + 1, totalRecords === 0 ? 0 : totalRecords)}</strong> to <strong className="text-slate-800">{Math.min(currentPage * pageSize, totalRecords)}</strong> of <strong className="text-slate-800">{totalRecords}</strong></span>
                <div className="w-px h-4 bg-slate-300 hidden sm:block"></div>
                <div className="flex items-center gap-2">
                    <span className="hidden sm:inline">Per page:</span>
                    <select value={pageSize} onChange={e => onPageSizeChange(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all">
                        {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                <button
                    onClick={() => onPageChange(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    <ChevronLeft size={16} />
                </button>

                <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
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
                    className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
    );
};

function LeadIntelligenceRecord({ lead, handleCustomerRedirect, handleCopyPhone, copiedPhone }) {
    const [isExpanded, setIsExpanded] = useState(false);

    // --- Core Logic Derivations (Strictly from leads[] array) ---
    const interactionTimeline = lead.leads || [];
    const interactionCount = interactionTimeline.length;
    const latestFollowUp = interactionCount > 0 ? interactionTimeline[interactionCount - 1] : {};
    const firstFollowUp = interactionCount > 0 ? interactionTimeline[0] : {};
    
    const firstHandler = firstFollowUp.associateName || lead.assignedTo || "Unassigned";
    const currentHandler = lead.assignedTo || "Unassigned";

    const leadLifecycleState = latestFollowUp.status || lead.status || "New";
    const leadType = latestFollowUp.leadType || lead.leadType || "Direct Lead";
    const revenueAttribution = parseInt(latestFollowUp.saleAmount) || 0;

    const isClosed = leadLifecycleState === "Closed";
    const closedBy = isClosed ? (latestFollowUp.associateName || lead.closedBy || currentHandler) : null;

    // Ownership Intelligence Resolution
    let ownershipTransitionText = null;
    if (isClosed) {
        ownershipTransitionText = (closedBy && closedBy !== firstHandler) ? `Closed by ${closedBy}` : "Automatically Closed";
    }

    const lastActivityDate = latestFollowUp.date ? new Date(latestFollowUp.date) : new Date(lead.createdAt);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden transition-all hover:shadow-md">

            {/* --- SUMMARY LAYER (Always Visible) --- */}
            <div
                className="flex flex-col lg:flex-row lg:items-center justify-between p-5 cursor-pointer hover:bg-slate-50 transition-colors gap-4 lg:gap-6 relative"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                {/* 1. Identity Section */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 text-emerald-700 flex items-center justify-center font-extrabold text-lg shrink-0 border border-emerald-200">
                        {lead.name?.charAt(0).toUpperCase() || "#"}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-slate-800 text-base truncate">{lead.name || "Unknown Lead"}</h3>
                            <button
                                onClick={(e) => handleCopyPhone(e, lead.phone.replace('whatsapp:', ''))}
                                className="text-slate-400 hover:text-[#00a884] transition-colors"
                                title="Copy Phone"
                            >
                                {copiedPhone === lead.phone.replace('whatsapp:', '') ? <Check size={14} className="text-[#00a884]" /> : <Copy size={14} />}
                            </button>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-1">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{lead.phone.replace('whatsapp:', '')}</span>
                            {lead.city && <span className="flex items-center gap-1 truncate"><MapPin size={12} className="shrink-0" /> {lead.city}</span>}
                        </div>
                    </div>
                </div>

                {/* 2. Lifecycle & Ownership Section */}
                <div className="flex flex-col lg:items-start gap-1.5 flex-1 min-w-0 border-l-2 border-transparent lg:border-slate-100 lg:pl-6">
                    <div className="flex items-center gap-2">
                        <LifecycleBadge state={leadLifecycleState} />
                        {isClosed && (
                            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-md flex items-center gap-1 whitespace-nowrap">
                                {ownershipTransitionText}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 mt-0.5 bg-slate-50 px-2 py-1 rounded border border-slate-100 w-max">
                        <UserCircle size={12} className="text-slate-400" />
                        Handler: <span className="text-[#00a884]">{currentHandler}</span>
                    </div>
                </div>

                {/* 3. Activity & Context Section */}
                <div className="flex flex-col lg:items-end gap-1.5 shrink-0 border-l-2 border-transparent lg:border-slate-100 lg:pl-6">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <History size={14} className="text-blue-500" />
                        {interactionCount} Interaction{interactionCount !== 1 ? 's' : ''}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500">
                        Last Active: {lastActivityDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">
                        <Tag size={10} /> {leadType}
                    </div>
                                    {/* Sales Attribution Snippet (If Deal Closed) */}
                {isClosed && revenueAttribution > 0 && (
                    <div className="absolute top-4 right-4 lg:relative lg:top-0 lg:right-0 bg-gradient-to-r from-emerald-500 to-[#00a884] text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                        <TrendingUp size={14} />
                        <span className="text-xs font-bold">₹{revenueAttribution.toLocaleString()}</span>
                    </div>
                )}
                </div>



                {/* Expansion Chevron */}
                <div className="absolute bottom-4 right-4 lg:relative lg:bottom-0 lg:right-0 text-slate-400 p-1.5 hover:bg-slate-100 rounded-full transition-colors">
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </div>

            {/* --- DETAIL LAYER (Interaction Timeline) --- */}
            {isExpanded && (
                <div className="bg-slate-50 border-t border-slate-200 p-5 lg:p-8 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-center justify-between mb-6">
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <Clock size={16} className="text-[#00a884]" /> Interaction Timeline
                        </h4>

                        <div className="flex items-center gap-2">
                            <button onClick={() => handleCustomerRedirect(lead.phone)} className="text-[11px] font-bold bg-[#00a884] text-white px-3 py-1.5 rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-200">
                                <User size={12} /> Open Profile
                            </button>
                        </div>
                    </div>

                    <div className="ml-2 border-l-2 border-slate-200 pl-6 space-y-8 relative">
                        {interactionTimeline.length === 0 ? (
                            <div className="text-sm text-slate-500 font-medium pb-2">No timeline data available.</div>
                        ) : (
                            [...interactionTimeline].reverse().map((fu, idx, arr) => {
                                const previousInteraction = arr[idx + 1];
                                const ownershipChanged = previousInteraction && previousInteraction.associateName !== fu.associateName;

                                return (
                                    <div key={fu._id || idx} className="relative">
                                        <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-100 border-2 border-[#00a884] shadow-sm"></div>

                                        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm relative hover:border-[#00a884]/30 transition-colors">

                                            {ownershipChanged && (
                                                <div className="absolute -top-3 left-4 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                                    <RefreshCcw size={10} /> Ownership Transition
                                                </div>
                                            )}

                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                                                <div className="flex items-center gap-3">
                                                    <LifecycleBadge state={fu.status} />
                                                    <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                                        {new Date(fu.date).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 w-max">
                                                    <UserCircle size={12} className={ownershipChanged ? "text-blue-500" : "text-slate-400"} />
                                                    Handled by: <span className={ownershipChanged ? "text-blue-700" : "text-slate-700"}>{fu.associateName || "Unknown"}</span>
                                                </div>
                                            </div>

                                            {fu.enquiredFor && (
                                                <div className="mb-2 text-sm text-slate-800">
                                                    <span className="font-bold text-slate-500 mr-2 text-xs">Enquiry:</span>
                                                    <span className="font-semibold">{fu.enquiredFor}</span>
                                                </div>
                                            )}

                                            {fu.overAllRemarks && (
                                                <div className="bg-[#f8fafc] border border-slate-100 rounded-lg p-3 text-sm text-slate-600 font-medium italic mt-2">
                                                    <CornerDownRight size={14} className="inline mr-2 text-slate-400" />
                                                    "{fu.overAllRemarks}"
                                                </div>
                                            )}

                                            {(fu.day1Remarks || fu.day2Remarks || fu.day3Remarks) && (
                                                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 border-t border-slate-100 pt-3">
                                                    {fu.day1Remarks && <DayNote day={1} text={fu.day1Remarks} />}
                                                    {fu.day2Remarks && <DayNote day={2} text={fu.day2Remarks} />}
                                                    {fu.day3Remarks && <DayNote day={3} text={fu.day3Remarks} />}
                                                </div>
                                            )}

                                            {fu.status === "Closed" && parseInt(fu.saleAmount) > 0 && (
                                                <div className="mt-3 flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold px-3 py-2 rounded-lg w-max">
                                                    <TrendingUp size={14} className="text-emerald-500" />
                                                    Revenue Attribution: ₹{parseInt(fu.saleAmount).toLocaleString()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

const DayNote = ({ day, text }) => (
    <div className="bg-white border border-slate-100 rounded-md p-2 shadow-sm">
        <div className="text-[10px] font-extrabold text-[#00a884] uppercase tracking-wider mb-1">Day {day} Progression</div>
        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{text}</p>
    </div>
);


const CreateLeadModal = ({ formData, handleChange, handleSubmit, setShowCreateForm, loading }) => (
    <>
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity" onClick={() => setShowCreateForm(false)} />
        <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white z-50 shadow-2xl transform transition-transform duration-300 animate-in slide-in-from-right flex flex-col border-l border-slate-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <h2 className="text-lg font-extrabold text-slate-800">Inject New Lead</h2>
                <button onClick={() => setShowCreateForm(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
                    <X size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Phone Number <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={16} /></div>
                                <input type="tel" name="phone" placeholder="e.g. 919876543210" value={formData.phone} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium transition-all shadow-sm" required />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Name</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><User size={16} /></div>
                                    <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium transition-all shadow-sm" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">City</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><MapPin size={16} /></div>
                                    <input type="text" name="city" placeholder="Location" value={formData.city} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium transition-all shadow-sm" />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Initial Status</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Flag size={16} /></div>
                                    <select name="status" value={formData.status} onChange={handleChange} className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium cursor-pointer appearance-none shadow-sm transition-all">
                                        <option value="New">New</option>
                                        <option value="Follow Up">Follow Up</option>
                                        <option value="Closed">Closed</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Priority</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><AlertCircle size={16} /></div>
                                    <select name="priority" value={formData.priority} onChange={handleChange} className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium cursor-pointer appearance-none shadow-sm transition-all">
                                        <option value="Low">Low</option>
                                        <option value="Medium">Medium</option>
                                        <option value="High">High</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Enquired for</label>
                            <div className="relative">
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Tag size={16} /></div>
                                <input type="text" name="enquiredFor" placeholder="e.g., Joint Pain Therapy" value={formData.enquiredFor} onChange={handleChange} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium transition-all shadow-sm" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Initial Remarks</label>
                            <div className="relative">
                                <div className="absolute left-3 top-3 text-slate-400"><FileText size={16} /></div>
                                <textarea name="remarks" placeholder="Detailed notes..." value={formData.remarks} onChange={handleChange} rows={3} className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium resize-none transition-all shadow-sm" />
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 flex gap-3 mt-6 border-t border-slate-200">
                        <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 py-3 text-sm rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200">Cancel</button>
                        <button type="submit" disabled={loading} className="flex-1 py-3 bg-[#00a884] text-white text-sm rounded-xl font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-200/50 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                            {loading ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18} /> Inject Lead</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </>
);

const MenuIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
);
