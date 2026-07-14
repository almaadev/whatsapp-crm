"use client";
import api from "@/shared/lib/axios";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathStore } from "@/features/chat/stores/pathStore";
import { useChatStore } from "@/features/chat/stores/chatStore";
import {
    ChevronLeft, Edit2, Save, User, MapPin, Globe,
    Briefcase, FileText, Menu, Phone, Copy, Check,
    Calendar, Clock, ShieldAlert, Loader2, Tag, IndianRupee,
    MessageCircle, Building, AlertCircle, XCircle
} from "lucide-react";
import { toast } from "react-toastify";
import { customerRepository } from "@/shared/api/repositories/customerRepository";
import { useAuth } from "@/shared/hooks/useAuth";
import AccessDenied from "@/shared/components/ui/AccessDenied";

// Modern Enterprise Status Badges
const StatusBadge = ({ status, labelOverride }) => {
    const configs = {
        'New': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: <Tag size={12} /> },
        'Follow Up': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: <Clock size={12} /> },
        'Closed': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', icon: <Check size={12} /> },
        'Not Interested': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: <XCircle size={12} /> },
        'High': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: <AlertCircle size={12} /> },
        'Medium': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', icon: <ShieldAlert size={12} /> },
        'Low': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <Check size={12} /> },
    };
    
    const config = configs[status] || { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: <Tag size={12} /> };

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider border shadow-sm ${config.bg} ${config.text} ${config.border}`}>
            {config.icon} {labelOverride || status}
        </span>
    );
};

export default function CustomerDetailPage({ params }) {
    const unwrappedParams = use(params);
    const router = useRouter();
    const phone = decodeURIComponent(unwrappedParams.phone);
    const { setMobileOpen } = useCrmLayout();
    const lastPath = usePathStore((state) => state.lastpath);
    const { data: session } = useSession();
    const { user, isLoading, hasModuleAccess } = useAuth();
    const { setSelectedChat }     = useChatStore();
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [formData, setFormData] = useState({
        name: "", city: "", address: "", associate: "", source: "",
        enquiredFor: "", status: "New", saleAmount: "", remarks: "", priority: "Medium"
    });

    const getFollowUpLabel = (cust) => {
        if (!cust?.followUpStartDate) return "Follow Up";
        const start = new Date(cust.followUpStartDate);
        const diffDays = Math.floor(Math.abs(new Date() - start) / (1000 * 60 * 60 * 24));
        return `Day ${diffDays} Follow Up`;
    };

    useEffect(() => {
        if (!session) return;
        const rawPhone = phone.replace(/\D/g, '');

        api.get(`/api/customers/${rawPhone}`)
            .then(({ data }) => {
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
            const { data } = await customerRepository.updateCustomer(rawPhone, formData);

            setCustomer(prev => ({ ...prev, ...formData }));
            setIsEditing(false);
            toast.success("Profile updated successfully");
        } catch (e) {
            toast.error(e.message || "Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

      const handleOpenChat = () => {
    
    setSelectedChat({
      phone:     customer.phone,
      name:      customer.name || customer.phone.replace('whatsapp:', ''),
      status:    customer.status,
      priority:  customer.priority,
      direction: "OUTBOUND",
      read:      "TRUE",
      timestamp: new Date().toISOString(),
    });
    router.push("/crm/chat");
  };

    const handleCopyPhone = () => {
        navigator.clipboard.writeText(customer?.phone?.replace('whatsapp:', '') || phone);
        setCopied(true);
        toast.success("Phone copied");
        setTimeout(() => setCopied(false), 2000);
    };

    const getDuration = (dateStr) => {
        if (!dateStr) return "New Lead";
        const diffDays = Math.ceil(Math.abs(new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return "Joined Today";
        if (diffDays < 30) return `${diffDays} Days`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} Months`;
        return `${Math.floor(diffDays / 365)} Years`;
    };

    const isAuthorized = hasModuleAccess("Customers");

    if (isLoading) {
        return (
            <div className="flex h-screen w-screen bg-[#f8fafc]">
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 size={32} className="animate-spin text-[#00a884] mb-4" />
                    <p className="text-sm font-semibold tracking-wide">Loading Intelligence Profile...</p>
                </div>
            </div>
        );
    }

    if (!user && !session) return null;

    if (!isAuthorized) {
        return (
            <AccessDenied message="You do not have permission to access Customer Details." />
        );
    }

    if (loading) {
        return (
            <div className="flex h-screen w-screen bg-[#f8fafc]">
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 size={32} className="animate-spin text-[#00a884] mb-4" />
                    <p className="text-sm font-semibold tracking-wide">Loading Intelligence Profile...</p>
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="flex h-screen bg-[#f8fafc]">
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 bg-white rounded-full shadow-sm border border-slate-200 flex items-center justify-center mb-6">
                        <User size={32} className="text-slate-300" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Customer Not Found</h2>
                    <p className="text-slate-500 mb-8 max-w-sm text-sm">The requested identity could not be resolved in the database.</p>
                    <Link href={lastPath ? lastPath : "/crm/customers"} className="px-6 py-2.5 bg-[#00a884] text-white rounded-xl font-semibold shadow-sm hover:bg-emerald-600 transition">
                        Return to Directory
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full w-full bg-[#f4f7f9] font-sans">
            <main className="flex-1 flex flex-col overflow-hidden relative">
                
                {/* --- HEADER --- */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 z-20 sticky top-0 shadow-sm shadow-slate-100/50">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={20} /></button>
                        <Link href={lastPath ? lastPath : "/crm/customers"} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition">
                            <ChevronLeft size={20} />
                        </Link>
                        <div className="pl-2 border-l border-slate-200">
                            <h1 className="text-[18px] font-bold text-slate-900 leading-tight">Customer Profile</h1>
                            
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!isEditing ? (
                            <button onClick={() => setIsEditing(true)} className="bg-white text-slate-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-50 border border-slate-200 shadow-sm flex items-center gap-2 transition-all text-[13px]">
                                <Edit2 size={16} /> <span className="hidden sm:inline" title="Edit Customer Details">Edit</span>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300">
                                <button onClick={() => { setIsEditing(false); setFormData({...customer}); }} className="px-4 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors text-[13px]">
                                    Cancel
                                </button>
                                <button onClick={handleSave} disabled={saving} className="bg-[#00a884] text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-600 shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all text-[13px] disabled:opacity-70">
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                                    <span className="hidden sm:inline" title="Save Customer changes">Save Changes</span>
                                </button>
                            </div>
                        )}
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    <div className="w-full max-w-[1400px] mx-auto space-y-6 lg:space-y-8">

                        {/* --- 1. PREMIUM HERO SECTION --- */}
                        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/80 p-6 md:p-8 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-[#00a884]/5 to-transparent rounded-bl-full -z-0"></div>
                            
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
                                <div className="flex items-start md:items-center gap-6">
                                    <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 rounded-2xl flex items-center justify-center text-4xl font-extrabold text-[#00a884] border border-slate-200 shadow-sm shrink-0">
                                        {customer.name && customer.name !== "Unknown" ? customer.name.charAt(0).toUpperCase() : "#"}
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <h2 className="text-[32px] font-bold text-slate-900 tracking-tight leading-none">{customer.name || "Unknown Identity"}</h2>
                                            <StatusBadge status={customer.status} labelOverride={customer.status === "Follow Up" ? getFollowUpLabel(customer) : null} />
                                            {customer.priority && <StatusBadge status={customer.priority} />}
                                        </div>
                                        <div className="flex flex-wrap items-center gap-4 pt-1">
                                            <div className="flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors" onClick={handleCopyPhone}>
                                                <Phone size={14} className="text-slate-500"  />
                                                <span className="text-[15px] font-semibold text-slate-800">{customer.phone?.replace('whatsapp:', '')}</span>
                                                {copied ? <Check size={14} className="text-[#00a884]" /> : <Copy size={12} className="text-slate-400" />}
                                            </div>
                                            {customer.city && (
                                                <span className="flex items-center gap-1.5 text-[15px] font-medium text-slate-600 px-2">
                                                    <MapPin size={16} className="text-slate-400"/> {customer.city}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 border-t lg:border-none border-slate-100 pt-6 lg:pt-0">
                                    <button className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold shadow-sm flex items-center gap-2 transition-all text-sm" title="Call feature will be available soon">
                                        <Phone size={16} className="text-slate-500" /> Call
                                    </button>
                                    <button onClick={handleOpenChat} className="px-4 py-2.5 bg-[#25D366]/10 border border-[#25D366]/20 text-[#075E54] hover:bg-[#25D366]/20 rounded-xl font-semibold shadow-sm flex items-center gap-2 transition-all text-sm" >
                                        <MessageCircle size={16} className="text-[#25D366]"  /> WhatsApp
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* --- 2. KPI DASHBOARD CARDS --- */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            <KPICard title="Deal Value" value={`₹${customer.saleAmount || '0'}`} icon={<IndianRupee size={20}/>} accent="text-[#00a884] bg-emerald-50 border-emerald-100" />
                            <KPICard title="Priority Level" value={customer.priority || "Medium"} icon={<ShieldAlert size={20}/>} />
                            <KPICard title="Customer Since" value={getDuration(customer.date)} icon={<Clock size={20}/>} />
                            <KPICard title="Follow-Up" value={customer.status === "Follow Up" ? getFollowUpLabel(customer) : "None"} icon={<Calendar size={20}/>} />
                        </div>

                        {/* --- MAIN CONTENT GRID --- */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
                            
                            {/* --- 3. INTELLIGENCE PANEL (Left Sidebar) --- */}
                            <div className="lg:col-span-4 space-y-6">
                                <div className={`bg-white rounded-3xl shadow-sm border p-6 md:p-8 transition-colors duration-300 ${isEditing ? 'border-[#00a884]/30 ring-4 ring-[#00a884]/5' : 'border-slate-200/80'}`}>
                                    <h3 className="text-[18px] font-bold text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
                                        <Globe size={18} className="text-slate-400" /> Intelligence Panel
                                    </h3>
                                    <div className="space-y-6">
                                        <DetailRow icon={<Globe size={16} />} label="Lead Source" value={formData.source} onChange={v => setFormData({ ...formData, source: v })} isEditing={isEditing} type="select" options={["Facebook", "Instagram", "Google", "Referral", "Walk-in", "Whatsapp", "Manual Entry", "Direct Call"]} />
                                        <DetailRow icon={<Building size={16} />} label="Enquiry Context" value={formData.enquiredFor} onChange={v => setFormData({ ...formData, enquiredFor: v })} isEditing={isEditing} />
                                        <DetailRow icon={<User size={16} />} label="Assigned Associate" value={formData.associate} onChange={v => setFormData({ ...formData, associate: v })} isEditing={isEditing} />
                                        <DetailRow icon={<IndianRupee size={16} />} label="Deal Value (₹)" value={formData.saleAmount} onChange={v => setFormData({ ...formData, saleAmount: v })} isEditing={isEditing} type="number" />
                                    </div>
                                </div>
                            </div>

                            <div className="lg:col-span-8 space-y-6 lg:space-y-8">
                                
                                {/* --- 4. CUSTOMER DETAILS --- */}
                                <div className={`bg-white rounded-3xl shadow-sm border p-6 md:p-8 transition-colors duration-300 ${isEditing ? 'border-[#00a884]/30 ring-4 ring-[#00a884]/5' : 'border-slate-200/80'}`}>
                                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                                        <h3 className="text-[18px] font-bold text-slate-900 flex items-center gap-2">
                                            <Briefcase size={18} className="text-slate-400" /> Customer Details
                                        </h3>
                                        {isEditing && (
                                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-md animate-pulse">Editing Data</span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                                        <div className="space-y-6">
                                            <DetailRow icon={<User size={16} />} label="Full Name" value={formData.name} onChange={v => setFormData({ ...formData, name: v })} isEditing={isEditing} />
                                            <DetailRow icon={<MapPin size={16} />} label="City / Location" value={formData.city} onChange={v => setFormData({ ...formData, city: v })} isEditing={isEditing} />
                                        </div>
                                        <div className="space-y-6">
                                            <DetailRow icon={<Tag size={16} />} label="Lifecycle Status" value={formData.status} onChange={v => setFormData({ ...formData, status: v })} isEditing={isEditing} type="select" options={["New", "Follow Up", "Closed", "Not Interested"]} />
                                            <DetailRow icon={<AlertCircle size={16} />} label="Priority Level" value={formData.priority} onChange={v => setFormData({ ...formData, priority: v })} isEditing={isEditing} type="select" options={["Low", "Medium", "High"]} />
                                        </div>
                                        <div className="md:col-span-2 pt-2">
                                            <DetailRow icon={<MapPin size={16} />} label="Full Address" value={formData.address} onChange={v => setFormData({ ...formData, address: v })} isEditing={isEditing} type="textArea" />
                                        </div>
                                    </div>
                                </div>

                                {/* --- 5. AGENT NOTES (Remarks) --- */}
                                <div className={`bg-white rounded-3xl shadow-sm border p-6 md:p-8 transition-colors duration-300 ${isEditing ? 'border-[#00a884]/30 ring-4 ring-[#00a884]/5' : 'border-slate-200/80'}`}>
                                    <h3 className="text-[18px] font-bold text-slate-900 mb-6 flex items-center gap-2">
                                        <FileText size={18} className="text-slate-400" /> Agent Notes
                                    </h3>
                                    {isEditing ? (
                                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <textarea
                                                value={formData.remarks}
                                                onChange={e => setFormData({ ...formData, remarks: e.target.value })}
                                                className="w-full p-4 border border-slate-200 rounded-2xl h-40 focus:ring-4 focus:ring-[#00a884]/10 focus:border-[#00a884] outline-none text-[15px] font-medium text-slate-800 bg-slate-50 transition-all resize-none custom-scrollbar"
                                                placeholder="Add structured meeting notes, requirements, or interaction history here..."
                                            />
                                        </div>
                                    ) : (
                                        formData.remarks ? (
                                            <div className="p-5 bg-slate-50 rounded-2xl text-[15px] text-slate-800 min-h-[120px] whitespace-pre-wrap border border-slate-100 leading-relaxed font-medium shadow-inner">
                                                {formData.remarks}
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">
                                                <FileText size={32} className="text-slate-300 mb-3" />
                                                <p className="text-[15px] font-semibold text-slate-600">No notes available yet.</p>
                                                <p className="text-[13px] text-slate-400 mt-1">Enter edit mode to add important customer context.</p>
                                            </div>
                                        )
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
//  ENTERPRISE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

// KPI Dashboard Card
function KPICard({ title, value, icon, accent = "bg-white border-slate-200/80 text-slate-800 hover:border-slate-300 hover:shadow-md transition-all duration-300" }) {
    return (
        <div className={`rounded-3xl p-5 md:p-6 border shadow-sm flex flex-col justify-between group ${accent}`}>
            <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{title}</p>
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-400 group-hover:scale-110 group-hover:text-slate-600 transition-all duration-300">
                    {icon}
                </div>
            </div>
            <p className="text-2xl md:text-3xl font-extrabold tracking-tight leading-none break-words">{value}</p>
        </div>
    );
}

// Read / Edit Data Row
function DetailRow({ label, value, onChange, isEditing, type = "text", options = [], icon }) {
    return (
        <div className="flex flex-col gap-2 group w-full">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="text-slate-400">{icon}</span> {label}
            </label>
            
            {isEditing ? (
                <div className="animate-in fade-in zoom-in-[0.98] duration-200">
                    {type === "select" ? (
                        <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-[15px] font-semibold text-slate-800 bg-white shadow-sm transition-all cursor-pointer">
                            {options.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                    ) : type === "textArea" ? (
                        <textarea
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            className="w-full p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-[15px] font-semibold text-slate-800 bg-white transition-all shadow-sm resize-none custom-scrollbar"
                            placeholder={`Enter ${label.toLowerCase()}`}
                            rows={3}
                        />
                    ) : (
                        <input
                            type={type}
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-[15px] font-semibold text-slate-800 transition-all bg-white shadow-sm"
                            placeholder={`Enter ${label.toLowerCase()}`}
                        />
                    )}
                </div>
            ) : (
                <div className="min-h-[44px] flex items-center pt-1 border-b border-transparent group-hover:border-slate-100 transition-colors">
                    {value ? (
                        <span className={`text-[15px] font-semibold text-slate-800 break-words w-full ${type === 'textArea' ? 'whitespace-pre-wrap' : ''}`}>
                            {value}
                        </span>
                    ) : (
                        <div className="flex items-center gap-2 text-slate-400 bg-slate-50/50 px-3 py-1.5 rounded-lg text-sm border border-slate-100 w-max">
                            <span className="italic">No data recorded</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}