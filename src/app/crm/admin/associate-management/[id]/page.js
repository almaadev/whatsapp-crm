"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { branchService } from "@/features/branches/services/branchService";
import { 
    User, Mail, Lock, Shield, Phone, Briefcase, Tag, 
    ArrowLeft, Save, Building, LayoutGrid, 
    Menu, Loader2, ChevronDown
} from "lucide-react";
import { userRepository } from "@/shared/api/repositories/userRepository";
import { useAuth } from "@/shared/hooks/useAuth";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import AssignedNumbersSelector from "@/shared/components/ui/AssignedNumbersSelector";


export default function EditAssociatePage() {
  const { data: session, status } = useSession();
  const { user, isLoading, isAdmin } = useAuth();
  const { id } = useParams();
  const router = useRouter();

  const {setMobileOpen} = useCrmLayout()
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "", preferredName: "", email: "", number: "", password: "", branch: "",
    role: "sales", department: "telecalling", isAdmin: false, active: true, accessModules: [],
    assignedSenderNumbers: []
  });

  const modulesList = ["Leads", "Customers", "Reports", "Bulk Messages", "Messages log", "Chat Inbox"];

  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [twilioNumbers, setTwilioNumbers] = useState([]);

  useEffect(() => {
    async function loadBranches() {
      setLoadingBranches(true);
      try {
        const res = await branchService.getBranches({ limit: 1000 });
        if (res.success) {
          setBranches(res.branches || []);
        }
      } catch (err) {
        console.error("Failed to load branches:", err);
      } finally {
        setLoadingBranches(false);
      }
    }

    async function loadTwilioNumbers() {
      try {
        const res = await fetch("/api/admin/twilio");
        const data = await res.json();
        if (data?.numbers && Array.isArray(data.numbers)) {
          setTwilioNumbers(data.numbers);
        }
      } catch (err) {
        console.error("Failed to load twilio numbers:", err);
      }
    }

    loadBranches();
    loadTwilioNumbers();
  }, []);

  const isAuthorized = isAdmin;

  useEffect(() => {
    if (status === "loading" || isLoading) return;

    if (isAuthorized) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [session, status, isLoading, id, isAuthorized]);

  const fetchUser = async () => {
    try {
      const { data } = await userRepository.getUserById(id);
      const existingSenderIds = Array.isArray(data.assignedSenderNumbers) && data.assignedSenderNumbers.length > 0
        ? data.assignedSenderNumbers.map((n) => (n._id || n).toString())
        : Array.isArray(data.assignedTwilioNumbers) && data.assignedTwilioNumbers.length > 0
          ? data.assignedTwilioNumbers.map((n) => (n._id || n).toString())
          : data.assignedSenderNumber
            ? [(data.assignedSenderNumber._id || data.assignedSenderNumber).toString()]
            : [];

      setFormData({
        ...data,
        password: "",
        preferredName: data.preferredName || "",
        number: data.number || "",
        branch: data.branch || "",
        accessModules: data.accessModules || [],
        assignedSenderNumbers: existingSenderIds,
      });
    } catch (error) {
      toast.error("Error connecting to server");
      router.push("/crm/admin/associate-management");
    } finally {
      setLoading(false);
    }
  };

  const handleModuleChange = (module) => {
    setFormData(prev => ({
      ...prev,
      accessModules: prev.accessModules.includes(module)
        ? prev.accessModules.filter(m => m !== module)
        : [...prev.accessModules, module]
    }));
  };

  const handleRoleChange = (e) => {
    const selectedRole = e.target.value;
    if (selectedRole === "superAdmin") {
      setFormData(prev => ({ ...prev, role: "superAdmin", department: "admin", isAdmin: true, accessModules: [...modulesList] }));
    } else {
      setFormData(prev => ({ ...prev, role: selectedRole, isAdmin: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await userRepository.updateUser(id, formData);
      toast.success("Profile updated successfully!");
      router.push("/crm/admin/associate-management");
    } catch (err) {
      const errorMessage = err.response?.data?.error || "An unexpected error occurred.";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || isLoading || loading) {
      return <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm"><Loader2 className="animate-spin mr-2" size={20}/> Fetching Profile...</div>;
  }

  if (!isAuthorized) {
    return (
      <AccessDenied message="Only administrators can edit user profiles." />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
      <div className="flex flex-1 w-full h-full relative overflow-hidden flex-col min-w-0">
        
        {/* --- HEADER --- */}
        <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 shadow-sm gap-4">
            <div className="flex items-center gap-3 w-full md:w-auto">
                <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Menu size={24} />
                </button>
                <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition border border-transparent hover:border-slate-200 hidden md:block">
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Edit Associate Profile</h1>
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 ml-1">Identity & Access Configuration</p>
                </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                <button onClick={() => router.back()} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all shadow-sm">
                    Cancel
                </button>
                <button 
                    onClick={handleSubmit} 
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-[#00a884] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-200/50 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    <span className="hidden sm:inline">Save Changes</span>
                </button>
            </div>
        </header>

        {/* --- MAIN CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar flex flex-col">
          
          {/* Responsive Grid Container */}
          <div className="max-w-7xl w-full mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 flex-1">

            {/* --- COLUMN 1 --- */}
            <div className="flex flex-col gap-6 lg:gap-8 h-full">
              
                {/* Block 1: Personal Information */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden shrink-0 flex flex-col">
                    <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><User size={20} /></div>
                        <div>
                            <h3 className="text-lg font-extrabold text-slate-800">Personal Information</h3>
                            <p className="text-xs text-slate-500 font-medium">Core identity and contact details.</p>
                        </div>
                    </div>
                    
                    <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 ml-1">Full Name <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input required type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all shadow-sm" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                            </div>
                        </div>
                        
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 ml-1">Preferred Name</label>
                            <div className="relative">
                                <Tag size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input type="text" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all shadow-sm" value={formData.preferredName} onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })} />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 ml-1">Mobile Number</label>
                            <div className="relative">
                                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input type="number" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={formData.number} onChange={(e) => setFormData({ ...formData, number: e.target.value })} />
                            </div>
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 ml-1">Email Address <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input required type="email" disabled className="w-full bg-slate-100 border border-slate-200 rounded-lg py-3 pl-11 pr-4 text-sm font-bold text-slate-500 outline-none cursor-not-allowed shadow-sm opacity-70" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Block 2: Security & Authentication */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col ">
                    <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl"><Lock size={20} /></div>
                        <div>
                            <h3 className="text-lg font-extrabold text-slate-800">Security & Authentication</h3>
                            <p className="text-xs text-slate-500 font-medium">Manage access levels and password resets.</p>
                        </div>
                    </div>
                    
                    <div className="p-6 md:p-8 flex flex-col gap-6 flex-1 justify-start">
                        <div className="space-y-1.5 w-full">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between ml-1">
                                Reset Password 
                                <span className="text-[9px] font-semibold text-slate-400 normal-case tracking-normal">(Leave blank to keep current)</span>
                            </label>
                            <div className="relative">
                                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input type="password" placeholder="••••••••" className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all shadow-sm font-mono" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 w-full">
                            <label className="flex flex-1 items-center justify-center gap-3 cursor-pointer group bg-slate-50 px-4 py-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-all">
                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                    formData.isAdmin ? 'bg-rose-500 border-rose-500 text-white' : 'bg-white border-slate-300 text-transparent'
                                }`}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <input type="checkbox" className="hidden" checked={formData.isAdmin} onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })} />
                                <span className="text-sm font-bold text-slate-700 group-hover:text-rose-600 transition-colors">Grant Admin Privileges</span>
                            </label>

                            <label className="flex flex-1 items-center justify-center gap-3 cursor-pointer group bg-slate-50 px-4 py-3 rounded-lg border border-slate-100 hover:border-slate-200 transition-all">
                                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                    formData.active ? 'bg-[#00a884] border-[#00a884] text-white' : 'bg-white border-slate-300 text-transparent'
                                }`}>
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <input type="checkbox" className="hidden" checked={formData.active} onChange={(e) => setFormData({ ...formData, active: e.target.checked })} />
                                <span className="text-sm font-bold text-slate-700 group-hover:text-[#00a884] transition-colors">Account is Active</span>
                            </label>
                        </div>
                    </div>
                </div>

            </div>

            {/* --- COLUMN 2 --- */}
            <div className="flex flex-col gap-6 lg:gap-8 w-full h-full">

                {/* Block 3: Organization Structure */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden shrink-0">
                    <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                        <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><Building size={20} /></div>
                        <div>
                            <h3 className="text-lg font-extrabold text-slate-800">Organization Structure</h3>
                            <p className="text-xs text-slate-500 font-medium">Define roles, departments, and branch locations.</p>
                        </div>
                    </div>
                    
                    <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1.5 sm:col-span-2">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 ml-1">Branch Location <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <Building size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <select required className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-11 pr-10 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all shadow-sm appearance-none cursor-pointer" value={formData.branch} onChange={(e) => setFormData({ ...formData, branch: e.target.value })}>
                                    <option value="" disabled>{loadingBranches ? "Loading branches..." : "Select Branch"}</option>
                                    {branches.map(b => (
                                        <option key={b.id || b._id} value={b.id || b._id}>{b.name} ({b.status})</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 ml-1">System Role <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <Shield size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <select required className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-11 pr-10 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all shadow-sm appearance-none cursor-pointer" value={formData.role} onChange={handleRoleChange}>
                                    <option value="sales">Sales</option>
                                    <option value="doctor">Doctor</option>
                                   { session?.user?.role === 'superAdmin' && <option value="superAdmin">Super Admin</option> }
                                </select>
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 ml-1">Department <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <select required className="w-full bg-slate-50 border border-slate-200 rounded-lg py-3 pl-11 pr-10 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all shadow-sm appearance-none cursor-pointer" value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })}>
                                    <option value="telecalling">Telecalling</option>
                                    <option value="support">Support</option>
                                    <option value="admin">Admin</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Assigned WhatsApp Sender Numbers (Hierarchical Multi-Select) */}
                        <div className="sm:col-span-2 border-t border-slate-100 pt-4 mt-2">
                          <AssignedNumbersSelector
                            availableNumbers={twilioNumbers}
                            selectedIds={formData.assignedSenderNumbers || []}
                            onChange={(selectedIds) =>
                              setFormData({ ...formData, assignedSenderNumbers: selectedIds })
                            }
                            label={formData.department === "admin" ? "Assigned WhatsApp Numbers (Admin)" : "Assigned WhatsApp Numbers (Associate)"}
                            subtitle={
                              formData.department === "admin"
                                ? "Assign sender numbers to this Admin directly from system inventory."
                                : "Select sender numbers already assigned to this Associate's Admin."
                            }
                            emptyMessage={
                              formData.department === "admin"
                                ? "No active sender numbers found in system."
                                : "No sender numbers are assigned to this Admin yet."
                            }
                          />
                        </div>
                    </div>
                </div>

                {/* Block 4: Access Modules */}
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden flex flex-col flex-1">
                    <div className="px-6 md:px-8 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50 shrink-0">
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><LayoutGrid size={20} /></div>
                        <div>
                            <h3 className="text-lg font-extrabold text-slate-800">System Access Modules</h3>
                            <p className="text-xs text-slate-500 font-medium">Control which CRM sections this associate can view.</p>
                        </div>
                    </div>
                    
                    <div className="p-6 md:p-8 flex flex-col flex-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 content-start">
                            {modulesList.map((mod) => {
                                const isChecked = formData.accessModules?.includes(mod);
                                return (
                                    <label 
                                        key={mod} 
                                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                                            isChecked 
                                                ? 'border-indigo-500 bg-indigo-50/50 shadow-sm' 
                                                : 'border-slate-100 bg-white hover:border-indigo-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className={`text-sm font-bold ${isChecked ? 'text-indigo-700' : 'text-slate-600'}`}>{mod}</span>
                                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                            isChecked ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-slate-300'
                                        }`}>
                                            {isChecked && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                        </div>
                                        <input type="checkbox" className="hidden" checked={isChecked} onChange={() => handleModuleChange(mod)} />
                                    </label>
                                )
                            })}
                        </div>
                    </div>
                </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}