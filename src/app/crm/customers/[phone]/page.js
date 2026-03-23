"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathStore } from "@/store/pathStore";

import Sidebar from "@/components/layout/Sidebar";
import {
    ChevronLeft, Edit2, Save, User, MapPin, Globe, 
    Briefcase, FileText, Menu
} from "lucide-react";

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
    }, [phone, session]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const rawPhone = phone.replace(/\D/g, ''); // Number mattum edukkurom
            const res = await fetch(`/api/customers/${rawPhone}`, { 
                method: "PUT", // POST-ku bathila PUT use pandrom (update panrathuku)
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            
            if (!res.ok) throw new Error("Failed to update");

            setCustomer(prev => ({ ...prev, ...formData }));
            setIsEditing(false);
        } catch (e) {
            alert("Failed to save changes");
        } finally {
            setSaving(false);
        }
    };

    const getDuration = (dateStr) => {
        if (!dateStr) return "New Lead";
        const start = new Date(dateStr);
        const now = new Date();
        const diffTime = Math.abs(now - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 30) return `${diffDays} Days`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} Months`;
        return `${Math.floor(diffDays / 365)} Years`;
    };

    if (!session) return null;
    if (loading) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">Loading Profile...</div>;
    if (!customer) return <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-400">Customer Not Found</div>;

    const followUpLabel = getFollowUpLabel(customer);

    return (
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
                                    </div>
                                </div>
                            </div>
                        </div>

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

                    </div>
                </div>
            </main>
        </div>
    );
}

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
                </div>
            )}
        </div>
    );
}