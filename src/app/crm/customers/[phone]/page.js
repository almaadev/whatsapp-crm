"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
<<<<<<< HEAD
import { useRouter } from "next/navigation";
import { usePathStore } from "@/store/pathStore";

import Sidebar from "@/components/layout/Sidebar";
import {
    ChevronLeft, Edit2, Save, User, MapPin, Globe, 
    Briefcase, FileText, Menu
} from "lucide-react";
=======
import { usePathStore } from "@/store/pathStore";
import Sidebar from "@/components/layout/Sidebar";
import {
    ChevronLeft, Edit2, Save, User, MapPin, Globe, 
    Briefcase, FileText, Menu, Phone, Copy, Check, 
    Calendar, Clock, ShieldAlert, BadgeCheck, Loader2
} from "lucide-react";
import { getStatusColor } from "@/utils/colorUtils";
import { toast } from "react-toastify";
>>>>>>> c1be5bc (Initial commit from new system)

export default function CustomerDetailPage({ params }) {
    const unwrappedParams = use(params);
    const phone = decodeURIComponent(unwrappedParams.phone);

    const lastPath = usePathStore((state) => state.lastpath);
    const { data: session } = useSession();

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
<<<<<<< HEAD
=======
    const [copied, setCopied] = useState(false);
>>>>>>> c1be5bc (Initial commit from new system)

    const [formData, setFormData] = useState({
        name: "", city: "", address: "", associate: "", source: "",
        enquiredFor: "", status: "New", saleAmount: "", remarks: ""
    });

    const getFollowUpLabel = (cust) => {
        if (!cust?.followUpStartDate) return "Follow Up";
        const start = new Date(cust.followUpStartDate);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        return `Day ${diffDays} Follow Up`;
    };

<<<<<<< HEAD
useEffect(() => {
        if (!session) return;

        fetch("/api/customers", { cache: 'no-store' }) // <-- CHANGED HERE
            .then(res => res.json())
            .then(data => {
                const targetPhone = phone.replace(/\D/g, '');
                const found = data.find(c => c.phone?.replace(/\D/g, '') === targetPhone);
                
                if (found) {
                    setCustomer(found);
                    setFormData({
                        name: found.name || "",
                        city: found.city || "",
                        address: found.address || "",
                        associate: found.associate || "",
                        source: found.source || "",
                        enquiredFor: found.enquiredFor || "",
                        status: found.status || "New",
                        saleAmount: found.saleAmount || "",
                        remarks: found.remarks || ""
                    });
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
=======
    // --- Performance Upgrade: Fetch Single Customer API ---
    useEffect(() => {
        if (!session) return;
        const rawPhone = phone.replace(/\D/g, '');

        fetch(`/api/customers/${rawPhone}`, { cache: 'no-store' })
            .then(res => res.json())
            .then(data => {
                if (data && !data.error) {
                    setCustomer(data);
                    setFormData({
                        name: data.name || "",
                        city: data.city || "",
                        address: data.address || "",
                        associate: data.associate || "",
                        source: data.source || "",
                        enquiredFor: data.enquiredFor || "",
                        status: data.status || "New",
                        saleAmount: data.saleAmount || "",
                        remarks: data.remarks || ""
                    });
                }
            })
            .catch(err => {
                console.error("Failed to load customer profile:", err);
                toast.error("Failed to load profile.");
            })
            .finally(() => setLoading(false));
>>>>>>> c1be5bc (Initial commit from new system)
    }, [phone, session]);

    const handleSave = async () => {
        setSaving(true);
        try {
<<<<<<< HEAD
            const rawPhone = phone.replace(/\D/g, ''); // Number mattum edukkurom
            const res = await fetch(`/api/customers/${rawPhone}`, { 
                method: "PUT", // POST-ku bathila PUT use pandrom (update panrathuku)
=======
            const rawPhone = phone.replace(/\D/g, ''); 
            const res = await fetch(`/api/customers/${rawPhone}`, { 
                method: "PUT",
>>>>>>> c1be5bc (Initial commit from new system)
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            
<<<<<<< HEAD
            if (!res.ok) throw new Error("Failed to update");

            setCustomer(prev => ({ ...prev, ...formData }));
            setIsEditing(false);
        } catch (e) {
            alert("Failed to save changes");
=======
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to update profile");

            setCustomer(prev => ({ ...prev, ...formData }));
            setIsEditing(false);
            toast.success("Profile updated successfully");
        } catch (e) {
            toast.error(e.message || "Failed to save changes");
>>>>>>> c1be5bc (Initial commit from new system)
        } finally {
            setSaving(false);
        }
    };

<<<<<<< HEAD
=======
    const handleCopyPhone = () => {
        navigator.clipboard.writeText(customer?.phone?.replace('whatsapp:', '') || phone);
        setCopied(true);
        toast.success("Phone copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

>>>>>>> c1be5bc (Initial commit from new system)
    const getDuration = (dateStr) => {
        if (!dateStr) return "New Lead";
        const start = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

<<<<<<< HEAD
=======
        if (diffDays === 0) return "Joined Today";
>>>>>>> c1be5bc (Initial commit from new system)
        if (diffDays < 30) return `${diffDays} Days`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} Months`;
        return `${Math.floor(diffDays / 365)} Years`;
    };

    if (!session) return null;
<<<<<<< HEAD
    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">Loading Profile...</div>;
    if (!customer) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">Customer Not Found</div>;
=======

    if (loading) {
        return (
            <div className="flex h-screen bg-[#f8fafc]">
                <Sidebar role={session?.user?.role || "sales"} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 size={32} className="animate-spin text-[#00a884] mb-4" />
                    <p className="text-sm font-bold uppercase tracking-widest">Loading Intelligence Profile...</p>
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex h-screen bg-[#f8fafc]">
                <Sidebar role={session?.user?.role || "sales"} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                        <User size={32} className="text-slate-300" />
                    </div>
                    <h2 className="text-2xl font-extrabold text-slate-800 mb-2">Customer Not Found</h2>
                    <p className="text-slate-500 mb-8 max-w-sm text-sm font-medium">The requested identity could not be resolved in the database.</p>
                    <Link href={lastPath ? lastPath : "/crm/customers"} className="px-6 py-3 bg-[#00a884] text-white rounded-xl font-bold hover:bg-emerald-600 transition shadow-md shadow-emerald-200/50">Return to Directory</Link>
                </div>
            </div>
        );
    }
>>>>>>> c1be5bc (Initial commit from new system)

    const followUpLabel = getFollowUpLabel(customer);

    return (
<<<<<<< HEAD
        <div className="flex h-[100dvh] bg-slate-50">
            <Sidebar role={session?.user?.role || "sales"} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            <main className="flex-1 p-4 md:p-8 lg:p-10 overflow-y-auto">
                <button
                    onClick={() => setMobileMenuOpen(true)}
                    className="md:hidden mb-4 p-2 text-slate-600 bg-white rounded-lg shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
                >
                    <Menu size={24} />
                </button>

                <div className="max-w-6xl mx-auto">
                    <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 md:mb-8">
                        <div className="flex items-center gap-3">
                            <Link href={lastPath ? lastPath : "/crm/customers"} className="p-2.5 bg-white rounded-xl hover:bg-slate-100 text-slate-500 shadow-sm border border-slate-200 transition-all shrink-0">
                                <ChevronLeft size={20} />
                            </Link>
                            <div>
                                <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Customer Profile</h1>
                                <p className="text-xs md:text-sm text-slate-500">Manage lead details and history.</p>
                            </div>
                        </div>

                        <div className="md:ml-auto mt-2 md:mt-0">
                            {!isEditing ? (
                                <button onClick={() => setIsEditing(true)} className="w-full md:w-auto bg-white text-slate-600 px-4 py-2.5 rounded-xl font-medium hover:bg-slate-50 border border-slate-200 shadow-sm flex items-center justify-center gap-2 transition-all text-sm">
                                    <Edit2 size={16} /> Edit Details
                                </button>
                            ) : (
                                <div className="flex gap-3 w-full md:w-auto">
                                    <button onClick={() => setIsEditing(false)} className="flex-1 md:flex-none px-4 py-2.5 text-slate-500 font-medium hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors text-sm">Cancel</button>
                                    <button onClick={handleSave} disabled={saving} className="flex-1 md:flex-none bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-emerald-700 shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 transition-all text-sm">
                                        {saving ? "Saving..." : <><Save size={18} /> Save Changes</>}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 text-center relative overflow-hidden">
                                <div className="relative z-10">
                                    <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-full flex items-center justify-center text-3xl md:text-4xl font-bold text-emerald-700 mx-auto mb-4 border-[6px] border-slate-50 shadow-inner">
                                        {customer.name && customer.name !== "Unknown" ? customer.name.charAt(0).toUpperCase() : "#"}
                                    </div>
                                    <h2 className="text-xl font-bold text-slate-900 truncate px-2">{customer.name || "Unknown"}</h2>
                                    <p className="text-slate-500 text-sm mt-1 font-mono">{customer.phone?.split(':')?.[1] }</p>

                                    <div className="mt-6 md:mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 gap-4">
                                        
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Joined</p>
                                            <p className="text-sm font-semibold text-slate-700">
                                                {customer.date
                                                    ? new Date(customer.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).replace(/ /g, '/')
                                                    : "N/A"
                                                }
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Customer Since</p>
                                            <p className="text-sm font-bold text-emerald-600">{getDuration(customer.date)}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-0 left-0 w-full h-24 bg-slate-50 z-0"></div>
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Overview</h3>
                                <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-slate-50 rounded-xl border border-slate-100 gap-2">
                                        <span className="text-sm text-slate-600 font-medium">Lead Status</span>
                                        {isEditing ? (
                                            <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full sm:w-auto border rounded-lg p-1.5 text-sm outline-none focus:border-emerald-500 bg-white">
                                                <option value="New">New</option>
                                                <option value="Follow Up">{followUpLabel}</option>
                                                <option value="Closed">Closed</option>
                                                <option value="Not Interested">Not Interested</option>
                                            </select>
                                        ) : (
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold w-fit ${customer.status === 'Closed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {customer.status === "Follow Up" ? followUpLabel : customer.status}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-slate-50 rounded-xl border border-slate-100 gap-2">
                                        <span className="text-sm text-slate-600 font-medium">Total Value</span>
                                        {isEditing ? (
                                            <input type="number" value={formData.saleAmount} onChange={e => setFormData({ ...formData, saleAmount: e.target.value })} className="w-full sm:w-24 border rounded-lg p-1.5 text-sm text-right outline-none focus:border-emerald-500 bg-white" />
                                        ) : (
                                            <span className="font-bold text-slate-800">₹{customer.saleAmount || "0"}</span>
                                        )}
=======
        <div className="flex h-[100dvh] bg-[#f8fafc] font-sans">
            <Sidebar role={session?.user?.role || "sales"} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                
                {/* --- HEADER --- */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 md:py-5 flex items-center justify-between shrink-0 z-20 shadow-sm sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
                        <Link href={lastPath ? lastPath : "/crm/customers"} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition border border-transparent hover:border-slate-200">
                            <ChevronLeft size={20} />
                        </Link>
                        <div>
                            <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 leading-tight tracking-tight">Intelligence Profile</h1>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">360° Customer View</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="bg-white text-slate-600 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 border border-slate-200 shadow-sm flex items-center gap-2 transition-all text-sm">
                                <Edit2 size={16} /> <span className="hidden sm:inline">Edit Details</span>
                            </button>
                        ) : (
                            <>
                                <button onClick={() => setIsEditing(false)} className="px-4 py-2.5 text-slate-500 font-bold hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors text-sm">Cancel</button>
                                <button onClick={handleSave} disabled={saving} className="bg-[#00a884] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-600 shadow-md shadow-emerald-200/50 flex items-center gap-2 transition-all text-sm disabled:opacity-70">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} <span className="hidden sm:inline">Save Profile</span>
                                </button>
                            </>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    <div className="max-w-[1400px] mx-auto space-y-6 lg:space-y-8">

                        {/* --- ZONE 1: PREMIUM HERO IDENTITY HEADER --- */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-emerald-600 to-[#00a884] z-0 opacity-10"></div>
                            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-end gap-6 relative z-10">
                                <div className="flex-1 flex flex-col md:flex-row items-center md:items-end gap-6 text-center md:text-left">
                                    
                                    <div className="w-24 h-24 md:w-28 md:h-28 bg-white rounded-full flex items-center justify-center text-4xl md:text-5xl font-extrabold text-[#00a884] border-4 border-white shadow-lg shrink-0 ring-1 ring-slate-100 mt-2 md:mt-0">
                                        {customer.name && customer.name !== "Unknown" ? customer.name.charAt(0).toUpperCase() : "#"}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-2">
                                            <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight truncate">{customer.name || "Unknown Identity"}</h2>
                                            <span className={`w-max mx-auto md:mx-0 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border whitespace-nowrap shadow-sm ${getStatusColor(customer.status)}`}>
                                                {customer.status === "Follow Up" ? followUpLabel : customer.status}
                                            </span>
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-slate-600 mt-3">
                                            <div className="flex items-center gap-1.5 cursor-pointer hover:text-[#00a884] transition-colors group bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm" onClick={handleCopyPhone} title="Copy Number">
                                                <Phone size={14} className="text-slate-400 group-hover:text-[#00a884]" />
                                                <span className="font-mono font-bold tracking-wide">{customer.phone?.replace('whatsapp:', '')}</span>
                                                {copied ? <Check size={14} className="text-[#00a884]" /> : <Copy size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                                            </div>
                                            {customer.city && (
                                                <span className="flex items-center gap-1.5 truncate bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm">
                                                    <MapPin size={14} className="shrink-0 text-slate-400"/> {customer.city}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                </div>

                                <div className="flex md:flex-col gap-4 shrink-0 mt-4 md:mt-0 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-8 w-full md:w-auto justify-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Joined Date</p>
                                        <p className="text-sm font-bold text-slate-700 flex items-center gap-1.5"><Calendar size={14} className="text-slate-400"/> {customer.date ? new Date(customer.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : "N/A"}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Customer Tenure</p>
                                        <p className="text-sm font-bold text-[#00a884] flex items-center gap-1.5"><Clock size={14}/> {getDuration(customer.date)}</p>
>>>>>>> c1be5bc (Initial commit from new system)
                                    </div>
                                </div>
                            </div>
                        </div>

<<<<<<< HEAD
                        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                                <Briefcase size={20} className="text-emerald-600" />
                                Client Details
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                                <InfoField type="text" label="Full Name" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} isEditing={isEditing} icon={<User size={14} />} />
                                <InfoField type="text" label="City / Location" value={formData.city} onChange={v => setFormData({ ...formData, city: v })} isEditing={isEditing} icon={<MapPin size={14} />} />
                                <InfoField type="textArea" label="Address" value={formData.address} onChange={v => setFormData({ ...formData, address: v })} isEditing={isEditing} icon={<MapPin size={14} />} />
                                <InfoField type="text" label="Associate" value={formData.associate || ""} onChange={() => {}} isEditing={isEditing} readOnly={!isEditing} icon={<User size={14} />} />
                                <InfoField type="select" label="Source" value={formData.source} onChange={v => setFormData({ ...formData, source: v })} isEditing={isEditing} icon={<Globe size={14} />} options={["Facebook", "Instagram", "Google", "Referral", "Walk-in", "Whatsapp", "Manual Entry"]} />
                                <InfoField type="text" label="Enquired For" value={formData.enquiredFor} onChange={v => setFormData({ ...formData, enquiredFor: v })} isEditing={isEditing} icon={<Briefcase size={14} />} />
                            </div>

                            <div className="mt-8">
                                <label className="block text-xs font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><FileText size={14} /> Remarks / Notes</label>
                                {isEditing ? (
                                    <textarea
                                        value={formData.remarks}
                                        onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                        className="w-full p-4 border border-slate-200 rounded-2xl h-32 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm bg-slate-50 transition-all"
                                        placeholder="Enter notes here..."
                                    />
                                ) : (
                                    <div className="p-5 bg-slate-50 rounded-2xl text-sm text-slate-700 min-h-[120px] whitespace-pre-wrap border border-slate-100 leading-relaxed">
                                        {formData.remarks || "No remarks added for this customer."}
                                    </div>
                                )}
                            </div>
                        </div>

=======
                        {/* --- MIDDLE LAYOUT: STATS + FORM --- */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                            
                            {/* ZONE 2: CUSTOMER INTELLIGENCE PANEL (Left Column on Desktop) */}
                            <div className="lg:col-span-4 space-y-6">
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                                    <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                                        <ShieldAlert size={16} className="text-[#00a884]" /> Intelligence Panel
                                    </h3>
                                    <div className="space-y-4">
                                        <StatRow icon={<Globe size={14} />} label="Origin Source" value={customer.source} />
                                        <StatRow icon={<Briefcase size={14} />} label="Active Enquiry" value={customer.enquiredFor} bold />
                                        <StatRow icon={<User size={14} />} label="Assigned Associate" value={customer.associate} />
                                        
                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><BadgeCheck size={14}/> Total Visits</span>
                                            <span className="text-sm font-extrabold text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">{customer.visitCount || 1}</span>
                                        </div>

                                        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 flex items-center justify-between">
                                            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5"><FileText size={14}/> Deal Value</span>
                                            {isEditing ? (
                                                <input type="number" value={formData.saleAmount} onChange={e => setFormData({ ...formData, saleAmount: e.target.value })} className="w-24 border border-emerald-200 rounded-lg p-1.5 text-sm text-right outline-none focus:ring-2 focus:ring-emerald-500/20 font-bold text-emerald-900 bg-white shadow-sm" placeholder="₹0" />
                                            ) : (
                                                <span className="text-base font-extrabold text-[#00a884]">₹{customer.saleAmount || "0"}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ZONE 3 & 4: STRUCTURED DETAILS & RICH NOTES (Right Column on Desktop) */}
                            <div className="lg:col-span-8 space-y-6">
                                
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-slate-100 gap-4">
                                        <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <Briefcase size={18} className="text-[#00a884]" /> Structural Record
                                        </h3>
                                        {isEditing && (
                                            <span className="bg-amber-50 text-amber-700 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-md border border-amber-200 animate-pulse">Edit Mode Active</span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <InfoField type="text" label="Full Name" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} isEditing={isEditing} icon={<User size={14} />} />
                                        <InfoField type="text" label="City / Location" value={formData.city} onChange={v => setFormData({ ...formData, city: v })} isEditing={isEditing} icon={<MapPin size={14} />} />
                                        
                                        <div className="md:col-span-2">
                                            <InfoField type="textArea" label="Complete Address" value={formData.address} onChange={v => setFormData({ ...formData, address: v })} isEditing={isEditing} icon={<MapPin size={14} />} />
                                        </div>
                                        
                                        <InfoField type="select" label="Lead Source" value={formData.source} onChange={v => setFormData({ ...formData, source: v })} isEditing={isEditing} icon={<Globe size={14} />} options={["Facebook", "Instagram", "Google", "Referral", "Walk-in", "Whatsapp", "Manual Entry", "Direct Call"]} />
                                        <InfoField type="text" label="Enquiry Context" value={formData.enquiredFor} onChange={v => setFormData({ ...formData, enquiredFor: v })} isEditing={isEditing} icon={<Briefcase size={14} />} />
                                        
                                        <div className="md:col-span-2">
                                            <InfoField type="select" label="Lifecycle Status" value={formData.status} onChange={v => setFormData({ ...formData, status: v })} isEditing={isEditing} icon={<ShieldAlert size={14} />} options={["New", "Follow Up", "Closed", "Not Interested"]} />
                                        </div>
                                    </div>
                                </div>

                                {/* Rich Notes Section */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
                                    <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                                        <FileText size={18} className="text-blue-500" /> Deep Insights & Remarks
                                    </h3>
                                    {isEditing ? (
                                        <div className="animate-in fade-in slide-in-from-top-2">
                                            <textarea
                                                value={formData.remarks}
                                                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                                className="w-full p-4 border border-[#00a884]/30 rounded-xl h-36 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884] outline-none text-sm bg-white shadow-inner font-medium text-slate-700 transition-all resize-none"
                                                placeholder="Add comprehensive notes, requirements, or interaction history here..."
                                            />
                                        </div>
                                    ) : (
                                        <div className="p-5 bg-[#f8fafc] rounded-xl text-sm text-slate-700 min-h-[120px] whitespace-pre-wrap border border-slate-100 leading-relaxed font-medium italic shadow-sm relative">
                                            {customer.remarks ? `"${customer.remarks}"` : <span className="text-slate-400 not-italic">No deep insights added for this customer yet.</span>}
                                        </div>
                                    )}
                                </div>

                            </div>
                        </div>
>>>>>>> c1be5bc (Initial commit from new system)
                    </div>
                </div>
            </main>
        </div>
    );
}

<<<<<<< HEAD
function InfoField({ label, value, onChange, isEditing, type, options = [], readOnly = false, icon }) {
    return (
        <div className="group">
            <label className="text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1.5">{icon} {label}</label>
            {isEditing && !readOnly ? (
                type === "select" ? (
                    <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-700 transition-all bg-white">
                        {options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                ) : type === "textArea" ?   
                
                (
                    <textarea
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        className="w-full p-4 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm bg-slate-50 transition-all"
                        placeholder="Enter value here..."
                    />
                ) : (
                    <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-800 transition-all bg-white font-medium" disabled={label==="Associate"} />
                )
            ) : (
                <div className="border-b border-slate-100 py-2.5 text-slate-800 font-medium text-sm group-hover:border-emerald-100 transition-colors break-words">
                    {value || <span className="text-slate-300 italic">Not set</span>}
=======
// ─────────────────────────────────────────────────────────────────────────────
//  SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatRow = ({ icon, label, value, bold }) => (
    <div>
        <p className="text-[11px] text-slate-400 font-extrabold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            {icon} {label}
        </p>
        <div className={`bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 text-sm text-slate-700 ${bold ? "font-bold text-slate-800" : "font-medium"}`}>
            {value || <span className="text-slate-300 italic font-normal">Not Specified</span>}
        </div>
    </div>
);

function InfoField({ label, value, onChange, isEditing, type, options = [], icon }) {
    return (
        <div className="group">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">{icon} {label}</label>
            {isEditing ? (
                <div className="animate-in fade-in zoom-in-95 duration-200">
                    {type === "select" ? (
                        <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-bold text-slate-700 transition-all bg-white shadow-sm cursor-pointer">
                            {options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : type === "textArea" ? (
                        <textarea
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-bold text-slate-800 bg-white transition-all shadow-sm resize-none"
                            placeholder="Enter details..."
                            rows={3}
                        />
                    ) : (
                        <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-bold text-slate-800 transition-all bg-white shadow-sm" placeholder={`Enter ${label.toLowerCase()}`} />
                    )}
                </div>
            ) : (
                <div className="border-b border-slate-100 py-3 text-slate-800 font-bold text-sm group-hover:border-[#00a884]/30 transition-colors break-words pl-1">
                    {value || <span className="text-slate-300 italic font-medium">Not Provided</span>}
>>>>>>> c1be5bc (Initial commit from new system)
                </div>
            )}
        </div>
    );
}