"use client";

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

    const fetchAssociates = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/users");
            if (res.ok) {
                const data = await res.json();
                setAssociates(data);
            } else {
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

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
            if (res.ok) {
                message.success("Associate deleted successfully");
                fetchAssociates(); 
            } else {
                message.error("Failed to delete associate");
            }
        } catch (error) {
            message.error("Error deleting associate");
        }
    };

    const handleEditSave = async () => {
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
                </div>
            </div>
        );
    }

    return (
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
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

        </div>
    );
};

export default AssociateManagement;