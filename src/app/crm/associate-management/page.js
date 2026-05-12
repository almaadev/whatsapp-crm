"use client";

<<<<<<< HEAD
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Table, message, Modal, InputNumber, Popconfirm } from "antd";
import { Edit, Delete, UserPlus, ShieldAlert, UserCog } from "lucide-react"; 
import Link from "next/link";
import CreateUserForm from "@/components/features/admin/CreateUserForm";

import Sidebar from "@/components/layout/Sidebar";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";

const AssociateManagement = () => {
    const { data: session, status } = useSession();

    const [associates, setAssociates] = useState([]);
    const [loading, setLoading] = useState(false);

    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
=======
import React, { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { toast } from "react-toastify";
import { 
     Trash2, UserPlus, ShieldAlert, UserCog, 
    Search, MapPin, Mail, Phone, Briefcase, CheckCircle2, 
    XCircle, AlertTriangle, X, Loader2, Menu, Activity
} from "lucide-react"; 

import Sidebar from "@/components/layout/Sidebar";
import CreateUserForm from "@/components/features/admin/CreateUserForm";


export default function AssociateManagement() {
    const { data: session, status } = useSession();

    const [associates, setAssociates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal States
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [saving, setSaving] = useState(false);
    
    // Delete Confirmation State
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);

    const isAuthorized = session?.user?.role === 'superAdmin' || session?.user?.role === "sales" || session?.user?.department === "admin";
>>>>>>> c1be5bc (Initial commit from new system)

    const fetchAssociates = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setAssociates(data);
            } else {
<<<<<<< HEAD
                message.error("Failed to fetch associates");
            }
        } catch (error) {
            message.error("Error connecting to server");
        }
        setLoading(false);
    };

    useEffect(() => {
        if (session?.user?.role === 'superAdmin' || (session?.user?.role === "sales" || session?.user?.department === "admin")) {
            fetchAssociates();
        }
    }, [session]);
=======
                toast.error("Failed to fetch associate roster");
            }
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
>>>>>>> c1be5bc (Initial commit from new system)

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
            if (res.ok) {
<<<<<<< HEAD
                message.success("Associate deleted successfully");
                fetchAssociates(); 
            } else {
                message.error("Failed to delete associate");
            }
        } catch (error) {
            message.error("Error deleting associate");
=======
                toast.success("Associate removed from system");
                setAssociates(prev => prev.filter(a => a.id !== id));
            } else {
                toast.error("Failed to delete associate");
            }
        } catch (error) {
            toast.error("Error deleting associate");
        } finally {
            setDeleteConfirmId(null);
>>>>>>> c1be5bc (Initial commit from new system)
        }
    };

    const handleEditSave = async () => {
<<<<<<< HEAD
=======
        setSaving(true);
>>>>>>> c1be5bc (Initial commit from new system)
        try {
            const res = await fetch("/api/users", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rowId: editingUser.id,
                    leads: editingUser.leads,
                    target: editingUser.target,
                    achieved: editingUser.achieved
                })
            });

            if (res.ok) {
<<<<<<< HEAD
                message.success("Details updated successfully");
                setIsEditModalOpen(false);
                fetchAssociates(); 
            } else {
                message.error("Failed to update details");
            }
        } catch (error) {
            message.error("Error updating details");
        }
    };

    const columns = [
        { title: "Name", dataIndex: "name", key: "name", render: (text) => <span className="font-semibold text-slate-700 whitespace-nowrap">{text}</span> },
        { title: "Email", dataIndex: "email", key: "email" },
        { title: "Mobile", dataIndex: "number", key: "number", render: (text) => <span className="whitespace-nowrap">{text || "-"}</span> },
        { title: "Preferred Name", dataIndex: "preferredName", key: "preferredName", render: (text) => <span className="whitespace-nowrap">{text || "-"}</span> },
        
        // 👇 FIX: Branch Column Added
        { title: "Branch", dataIndex: "branch", key: "branch", render: (text) => <span className="whitespace-nowrap font-medium text-slate-600">{text || "-"}</span> },

        { title: "Role", dataIndex: "role", key: "role", render: (text) => <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px]  uppercase font-bold w-max">{text}</span> },
        { title: "Department", dataIndex: "department", key: "department", render: (text) => <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px]  uppercase font-bold w-max">{text || 'sales'}</span> },
        { title: "Status", dataIndex: "active", key: "active", render: (active) => (<span className={`px-2 py-1 text-xs font-bold whitespace-nowrap ${active ? ' text-green-700' : 'bg-red-100 text-red-700'}`}>{active ? 'Active' : 'Inactive'}</span>) },
        { title: "Target", dataIndex: "target", key: "target" },
        { title: "Achieved", dataIndex: "achieved", key: "achieved" },
        { title: "Actions", key: "actions",
            render: (_, record) => (
                <div className="flex gap-3">
                    <Link href={`/crm/associate-management/${record.id}`}>
                        <button className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="Edit Full Profile">
                            <UserCog size={18} />
                        </button>
                    </Link>

                    <button
                        onClick={() => { setEditingUser(record); setIsEditModalOpen(true); }}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                        title="Edit Targets"
                    >
                        <Edit size={18} />
                    </button>

                    <Popconfirm
                        title="Delete Associate"
                        description="Are you sure to delete this user?"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Yes"
                        cancelText="No"
                        okButtonProps={{ danger: true }}
                    >
                        <button className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition" title="Delete User">
                            <Delete size={18} />
                        </button>
                    </Popconfirm>
                </div>
            ),
        },
    ];

    if (status === "loading") return <div className="p-8 flex justify-center text-slate-500">Loading Access...</div>;

    const isAuthorized = 
        session?.user?.role === 'superAdmin' || 
        (session?.user?.role === 'sales' && session?.user?.department === 'admin') ||  (session?.user?.role === 'doctor' && session?.user?.department === 'admin')

    if (!isAuthorized) {
        return (
            <div className="flex h-[100dvh] bg-gray-100 overflow-hidden relative">
                <div className="flex-shrink-0 z-40">
                    <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
                </div>

                <div className="flex flex-1 w-full h-full relative overflow-hidden flex-col">
                    <div className="md:hidden h-14 bg-white border-b flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
                        <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                        </button>
                    </div>
                    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                        <ShieldAlert size={60} className="text-red-400 mb-4" />
                        <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
                        <p className="text-slate-500 mt-2">Only administrators can access this page.</p>
                    </div>
=======
                toast.success("Performance targets updated successfully");
                setIsEditModalOpen(false);
                fetchAssociates(); 
            } else {
                toast.error("Failed to update targets");
            }
        } catch (error) {
            toast.error("Error updating details");
        } finally {
            setSaving(false);
        }
    };

    // --- Access Control Gates ---
    if (status === "loading") {
        return <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm"><Loader2 className="animate-spin mr-2" size={20}/> Verifying Access...</div>;
    }

    if (!isAuthorized) {
        return (
            <div className="flex h-[100dvh] bg-slate-50 overflow-hidden relative">
                <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
                <div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center">
                    <ShieldAlert size={80} className="text-rose-400 mb-6" />
                    <h2 className="text-3xl font-extrabold text-slate-800">Clearance Required</h2>
                    <p className="text-slate-500 mt-2 font-medium">This command center is restricted to administrative personnel.</p>
>>>>>>> c1be5bc (Initial commit from new system)
                </div>
            </div>
        );
    }

    return (
<<<<<<< HEAD
        <div className="flex h-[100dvh] bg-gray-100 overflow-hidden relative">
            <div className="flex-shrink-0 z-40">
                <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />
            </div>

            <div className="flex flex-1 w-full h-full relative overflow-hidden flex-col">

                {/* Mobile Header */}
                <div className="md:hidden h-14 bg-white border-b flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
                    <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <div className="font-semibold text-gray-700">
                        <div className="w-20 flex items-center justify-center shrink-0 p-1">
                            <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" />
                        </div>
                    </div>
                    <div className="w-8"></div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
                    <div className="max-w-8xl mx-auto">

                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                            <div>
                                <h2 className="text-xl md:text-2xl font-bold text-slate-800">Associate Management</h2>
                                <p className="text-xs md:text-sm text-slate-500 mt-1">Manage all your associates, targets, and leads performance.</p>
                            </div>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#0b8343] hover:bg-[#0a7039] text-white px-4 py-2.5 rounded-xl font-medium shadow-sm transition"
                            >
                                <UserPlus size={18} />
                                <span>Add Associate</span>
                            </button>
                        </div>

                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <Table
                                columns={columns}
                                dataSource={associates}
                                loading={loading}
                                rowKey="id"
                                pagination={{ 
                                    pageSize: 10,
                                    responsive: true, 
                                    size: "small" 
                                }}
                                scroll={{ x: 1100, y: 'calc(100vh - 280px)' }} 
                            />
                        </div>

                    </div>
                </div>
            </div>

            <Modal
                title={<span className="text-lg md:text-xl">Create New Associate</span>}
                open={isCreateModalOpen}
                onCancel={() => {
                    setIsCreateModalOpen(false);
                    fetchAssociates(); 
                }}
                footer={null}
                destroyOnHidden
                width={700}
                className="top-4 md:top-20"
            >
                <div className="pt-4">
                    <CreateUserForm />
                </div>
            </Modal>

            <Modal
                title="Update Associate Targets"
                open={isEditModalOpen}
                onOk={handleEditSave}
                onCancel={() => setIsEditModalOpen(false)}
                okText="Save Changes"
                okButtonProps={{ className: "bg-[#0b8343]" }}
                centered 
            >
                {editingUser && (
                    <div className="space-y-4 pt-4">
                        <div className="p-3 bg-slate-50 rounded-lg border">
                            <p className="text-sm font-semibold text-slate-700">{editingUser.name}</p>
                            <p className="text-xs text-slate-500 truncate">{editingUser.email}</p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Target</label>
                                <InputNumber
                                    className="w-full"
                                    min={0}
                                    value={editingUser.target}
                                    onChange={(val) => setEditingUser({ ...editingUser, target: val })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Total Leads Assigned</label>
                                <InputNumber
                                    className="w-full"
                                    min={0}
                                    value={editingUser.leads}
                                    onChange={(val) => setEditingUser({ ...editingUser, leads: val })}
                                />
                            </div>
                            <div className="sm:col-span-2 md:col-span-1">
                                <label className="block text-xs font-bold text-slate-500 mb-1">Achieved Leads</label>
                                <InputNumber
                                    className="w-full"
                                    min={0}
                                    value={editingUser.achieved}
                                    onChange={(val) => setEditingUser({ ...editingUser, achieved: val })}
                                />
=======
        <div className="flex h-[100dvh] bg-[#f8fafc] overflow-hidden font-sans relative">
            
            {/* Mobile Sidebar Overlay */}
            {mobileMenuOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)} />}
            
            <Sidebar role={session?.user?.role} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

            <div className="flex flex-1 w-full h-full flex-col min-w-0 overflow-hidden relative">
                
                {/* --- HEADER --- */}
                <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 shadow-sm gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={() => setMobileMenuOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
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
                                            <th className="px-6 py-4 text-center">Performance Targets</th>
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
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-center gap-4 text-xs font-bold">
                                                            <div className="text-center"><span className="block text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Target</span> <span className="text-slate-800">{associate.target || 0}</span></div>
                                                            <div className="text-center"><span className="block text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Achieved</span> <span className="text-[#00a884]">{associate.achieved || 0}</span></div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <button onClick={() => { setEditingUser(associate); setIsEditModalOpen(true); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-200" title="Edit Targets">
                                                                <Activity size={16} />
                                                            </button>
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
                                            <button onClick={() => { setEditingUser(associate); setIsEditModalOpen(true); }} className="flex-1 py-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1.5"><Activity size={14}/> Targets</button>
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
>>>>>>> c1be5bc (Initial commit from new system)
                            </div>
                        </div>
                    </div>
                )}
<<<<<<< HEAD
            </Modal>

        </div>
    );
};

export default AssociateManagement;
=======

                {/* Edit Targets Modal */}
                {isEditModalOpen && editingUser && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in">
                        <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4">
                            <div className="px-6 py-5 flex items-center justify-between border-b border-slate-100">
                                <div>
                                    <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Performance Targets</h3>
                                </div>
                                <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors"><X size={20} /></button>
                            </div>
                            
                            <div className="p-6 space-y-5 bg-slate-50/50">
                                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">{editingUser.name.charAt(0).toUpperCase()}</div>
                                    <div>
                                        <p className="text-sm font-extrabold text-slate-800">{editingUser.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{editingUser.role.replace('_', ' ')}</p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Monthly Target Goal</label>
                                        <input type="number" min="0" className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all shadow-sm" value={editingUser.target || 0} onChange={e => setEditingUser({ ...editingUser, target: e.target.value })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1 text-blue-600"><AlertTriangle size={12}/> Leads Handled</label>
                                            <input type="number" min="0" className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm" value={editingUser.leads || 0} onChange={e => setEditingUser({ ...editingUser, leads: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1 text-emerald-600"><CheckCircle2 size={12}/> Closed Achieved</label>
                                            <input type="number" min="0" className="w-full bg-white border border-slate-200 rounded-xl py-3 px-4 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm" value={editingUser.achieved || 0} onChange={e => setEditingUser({ ...editingUser, achieved: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button onClick={() => setIsEditModalOpen(false)} className="flex-1 py-3 text-sm rounded-xl text-slate-500 font-bold hover:bg-slate-200 transition-all bg-slate-100">Cancel</button>
                                    <button onClick={handleEditSave} disabled={saving} className="flex-1 py-3 bg-[#00a884] text-white text-sm rounded-xl font-bold hover:bg-emerald-600 shadow-md shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : "Save Metrics"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
>>>>>>> c1be5bc (Initial commit from new system)
