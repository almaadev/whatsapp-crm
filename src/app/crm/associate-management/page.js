"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "react-toastify";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { 
     Trash2, UserPlus, ShieldAlert, UserCog, 
    Search, MapPin, Mail, Phone, Briefcase, CheckCircle2, 
    XCircle, AlertTriangle, X, Loader2, Menu, Activity
} from "lucide-react"; 
import { userRepository } from "@/shared/api/repositories/userRepository";


import CreateUserForm from "@/components/features/admin/CreateUserForm";


export default function AssociateManagement() {
    const { data: session, status } = useSession();

    const {setMobileOpen} = useCrmLayout()
    const [associates, setAssociates] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [searchQuery, setSearchQuery] = useState("");

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    
    // Delete Confirmation State
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const isAuthorized = session?.user?.role === 'superAdmin' || session?.user?.role === "sales" || session?.user?.department === "admin";

    const fetchAssociates = async () => {
        setLoading(true);
        try {
            const { data } = await userRepository.getUsers();
            setAssociates(data);
        } catch (error) {
            toast.error("Error connecting to server");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) fetchAssociates();
    }, [isAuthorized]);

    // --- Search & Filter Logic ---
    const filteredAssociates = useMemo(() => {
        if (!searchQuery) return associates;
        const lower = searchQuery.toLowerCase();
        return associates.filter(a => 
            a.name?.toLowerCase().includes(lower) || 
            a.email?.toLowerCase().includes(lower) || 
            a.branch?.toLowerCase().includes(lower) ||
            a.number?.includes(lower)
        );
    }, [associates, searchQuery]);

    const handleDelete = async (id) => {
        try {
            await userRepository.deleteUser(id);
            toast.success("Associate removed from system");
            setAssociates(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            toast.error("Error deleting associate");
        } finally {
            setDeleteConfirmId(null);
        }
    };



    // --- Access Control Gates ---
    if (status === "loading") {
        return <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm"><Loader2 className="animate-spin mr-2" size={20}/> Verifying Access...</div>;
    }

    if (!isAuthorized) {
        return (
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                <div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center">
                    <ShieldAlert size={80} className="text-rose-400 mb-6" />
                    <h2 className="text-3xl font-extrabold text-slate-800">Clearance Required</h2>
                    <p className="text-slate-500 mt-2 font-medium">This command center is restricted to administrative personnel.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
            
            
            <div className="flex flex-1 w-full h-full flex-col min-w-0 overflow-hidden relative">
                
                {/* --- HEADER --- */}
                <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 shadow-sm gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto select-none">
                        <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
                        <div>
                            <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                                <Briefcase className="text-[#00a884]" size={24} /> Roster Management
                            </h1>
                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 ml-1">Team configuration & targets</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
                        <div className="flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-[#00a884] focus-within:ring-2 focus-within:ring-[#00a884]/20 transition-all w-full md:w-64 lg:w-80">
                            <Search size={16} className="text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Search associate, email, branch..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm font-medium ml-2 w-full text-slate-700 placeholder:text-slate-400" 
                            />
                        </div>
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="flex items-center justify-center gap-2 bg-[#00a884] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-200/50 transition-all active:scale-95 shrink-0 w-full sm:w-auto"
                        >
                            <UserPlus size={18} /> <span className="hidden sm:inline">Add Associate</span>
                        </button>
                    </div>
                </header>

                {/* --- MAIN CONTENT --- */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
                    <div className="max-w-[1600px] mx-auto">
                        
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                                        <tr>
                                            <th className="px-6 py-4">Identity</th>
                                            <th className="px-6 py-4">Contact</th>
                                            <th className="px-6 py-4">Organization</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                            <th className="px-6 py-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-sm">
                                        {loading ? (
                                            <tr>
                                                <td colSpan="6" className="p-12 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                                                    <Loader2 className="animate-spin mx-auto mb-2" size={24}/> Loading Roster...
                                                </td>
                                            </tr>
                                        ) : filteredAssociates.length === 0 ? (
                                            <tr>
                                                <td colSpan="6" className="p-12 text-center text-slate-500 font-medium">No associates found matching criteria.</td>
                                            </tr>
                                        ) : (
                                            filteredAssociates.map((associate) => (
                                                <tr key={associate.id} className="hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center text-emerald-700 font-extrabold shadow-sm border border-emerald-200 shrink-0">
                                                                {associate.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <div className="font-extrabold text-slate-800">{associate.name}</div>
                                                                <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                                                                    <Mail size={10} /> {associate.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded w-max mb-1 flex items-center gap-1.5"><Phone size={12}/> {associate.number || "N/A"}</div>
                                                        {associate.preferredName && <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">AKA: {associate.preferredName}</div>}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1.5 items-start">
                                                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] uppercase font-bold rounded border border-blue-100 tracking-wider">
                                                                {associate.role?.replace('_', ' ')}
                                                            </span>
                                                            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                                                                <span className="flex items-center gap-1"><Activity size={10}/> {associate.department || 'Sales'}</span>
                                                                <span className="flex items-center gap-1"><MapPin size={10}/> {associate.branch || 'HQ'}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${associate.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                                                            {associate.active ? <CheckCircle2 size={12}/> : <XCircle size={12}/>}
                                                            {associate.active ? 'Active' : 'Suspended'}
                                                        </span>
                                                    </td>

                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">

                                                            <Link href={`/crm/associate-management/${associate.id}`}>
                                                                <button className="p-1.5 text-[#00a884] hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-200" title="Edit Full Profile">
                                                                    <UserCog size={16} />
                                                                </button>
                                                            </Link>
                                                            
                                                            {deleteConfirmId === associate.id ? (
                                                                <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-1 animate-in fade-in zoom-in-95">
                                                                    <button onClick={() => handleDelete(associate.id)} className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded hover:bg-rose-600 transition">Confirm</button>
                                                                    <button onClick={() => setDeleteConfirmId(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={14}/></button>
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => setDeleteConfirmId(associate.id)} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200" title="Delete User">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden flex flex-col p-4 gap-4 bg-slate-50">
                                {loading ? <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-slate-400"/></div> : filteredAssociates.map(associate => (
                                    <div key={associate.id} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex flex-col gap-3">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center font-bold text-emerald-700 shrink-0 border border-emerald-100">{associate.name.charAt(0).toUpperCase()}</div>
                                                <div className="min-w-0">
                                                    <div className="font-extrabold text-slate-800 text-sm truncate">{associate.name}</div>
                                                    <div className="text-[10px] font-bold text-slate-400 truncate">{associate.email}</div>
                                                </div>
                                            </div>
                                            <span className={`w-2 h-2 rounded-full shrink-0 ${associate.active ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-600">
                                            <span className="flex items-center gap-1.5"><Briefcase size={12} className="text-slate-400"/> {associate.role.replace('_', ' ')}</span>
                                            <span className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-400"/> {associate.branch || "HQ"}</span>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-50">
                                            <Link href={`/crm/associate-management/${associate.id}`} className="flex-1">
                                                <button className="w-full py-2 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 flex items-center justify-center gap-1.5"><UserCog size={14}/> Edit Profile</button>
                                            </Link>
                                            
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </div>
                </main>

                {/* --- MODALS --- */}
                
                {/* Create User Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in">
                        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4">
                            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100 shrink-0">
                                <div>
                                    <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Onboard Associate</h3>
                                    <p className="text-xs text-slate-500 font-medium mt-1">Add a new team member to the CRM platform.</p>
                                </div>
                                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"><X size={20} /></button>
                            </div>
                            
                            <div className="p-6 overflow-y-auto custom-scrollbar">
                                <CreateUserForm onSuccess={() => { setIsCreateModalOpen(false); fetchAssociates(); }} />
                            </div>
                        </div>
                    </div>
                )}



            </div>
        </div>
    );
}
