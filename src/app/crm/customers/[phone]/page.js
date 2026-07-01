"use client";
import { useCrmLayout } from "@/components/layout/CrmShell";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { usePathStore } from "@/stores/pathStore";
import {
    ChevronLeft, Edit2, Save, User, MapPin, Globe, 
    Briefcase, FileText, Menu, Phone, Copy, Check, 
    Calendar, Clock, ShieldAlert, Loader2
} from "lucide-react";
import { getStatusColor } from "@/utils/colorUtils";
import { toast } from "react-toastify";


export default function CustomerDetailPage({ params }) {
    const unwrappedParams = use(params);
    const phone = decodeURIComponent(unwrappedParams.phone);
    const {setMobileOpen} =  useCrmLayout()
    const lastPath = usePathStore((state) => state.lastpath);
    const { data: session } = useSession();

    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
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
                        priority: data.priority || "Medium",
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
    }, [phone, session]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const rawPhone = phone.replace(/\D/g, ''); 
            const res = await fetch(`/api/customers/${rawPhone}`, { 
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Failed to update profile");

            setCustomer(prev => ({ ...prev, ...formData }));
            setIsEditing(false);
            toast.success("Profile updated successfully");
        } catch (e) {
            toast.error(e.message || "Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const handleCopyPhone = () => {
        navigator.clipboard.writeText(customer?.phone?.replace('whatsapp:', '') || phone);
        setCopied(true);
        toast.success("Phone copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
    };

    const getDuration = (dateStr) => {
        if (!dateStr) return "New Lead";
        const start = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Joined Today";
        if (diffDays < 30) return `${diffDays} Days`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} Months`;
        return `${Math.floor(diffDays / 365)} Years`;
    };

    if (!session) return null;

    if (loading) {
        return (
            <div className="flex h-screen w-screen bg-[#f8fafc]">
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

    const followUpLabel = getFollowUpLabel(customer);

    return (
        <div className="flex h-[100dvh] w-full bg-[#f8fafc] font-sans">
            <main className="flex-1 flex flex-col  overflow-hidden relative">
                
                {/* --- HEADER --- */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 md:py-5 flex items-center justify-between shrink-0 z-20 shadow-sm sticky top-0">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
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
                    {/* CHANGED LINE BELOW: Removed max-w-[1400px] mx-auto and added w-full */}
                    <div className="w-full space-y-6 lg:space-y-8">

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
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Priority Level</p>
                                        <p className={`text-sm font-bold uppercase tracking-wider flex items-center gap-1.5 ${getStatusColor(customer.priority)}`}>
                                            <ShieldAlert size={14} className="shrink-0" /> {customer.priority || "Medium"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

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
                                            <InfoField type="textArea" label="Address" value={formData.address} onChange={v => setFormData({ ...formData, address: v })} isEditing={isEditing} icon={<MapPin size={14} />} />
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
                    </div>
                </div>
            </main>
        </div>
    );
}

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
                </div>
            )}
        </div>
    );
}