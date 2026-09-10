"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { branchService } from "@/features/branches/services/branchService";
import { 
  User, Mail, Lock, Shield, Phone, Briefcase, Tag, 
  ArrowLeft, Save, Building2, LayoutGrid, 
  Loader2, ChevronRight, Copy, Check, Info,
  Eye, EyeOff, KeyRound, UserCheck, Pencil
} from "lucide-react";
import { userRepository } from "@/shared/api/repositories/userRepository";
import { useAuth } from "@/shared/hooks/useAuth";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import { useQueryClient } from "@tanstack/react-query";

export default function EditAssociatePage() {
  const { data: session, status } = useSession();
  const { isLoading, isAdmin, user } = useAuth();
  const { id } = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  const [rawUserData, setRawUserData] = useState(null);
  const [copiedId, setCopiedId] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingField, setEditingField] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    preferredName: "",
    email: "",
    number: "",
    password: "",
    branch: "",
    role: "sales",
    department: "telecalling",
    isAdmin: false,
    active: true,
    accessModules: [],
  });

  const modulesList = [
    "Leads",
    "Customers",
    "Reports",
    "Bulk Messages",
    "Messages log",
    "Chat Inbox"
  ];

  const [branches, setBranches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);

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

    loadBranches();
  }, []);

  const isAuthorized = isAdmin;
  const isSuperAdminRole =
    session?.user?.role === "superAdmin" || user?.role === "superAdmin";
  const currentSessionUserId =
    session?.user?.id?.toString() ||
    user?.id?.toString() ||
    user?._id?.toString();

  useEffect(() => {
    if (status === "loading" || isLoading) return;

    if (!isAuthorized) {
      setLoading(false);
      return;
    }

    // Super Admin is the only role allowed to see or manage their own account inside Associate Management.
    if (!isSuperAdminRole && currentSessionUserId && id === currentSessionUserId) {
      toast.error("You cannot view or manage your own account in Associate Management.");
      router.replace("/crm/admin/associate&branch/associate-management");
      return;
    }

    fetchUser();
  }, [session, status, isLoading, id, isAuthorized, isSuperAdminRole, currentSessionUserId]);

  const fetchUser = async () => {
    try {
      const { data } = await userRepository.getUserById(id);
      setRawUserData(data);

      setFormData({
        name: data.name || "",
        preferredName: data.preferredName || "",
        email: data.email || "",
        number: data.number || "",
        password: "",
        branch: data.branch || "",
        role: data.role || "sales",
        department: data.department || "telecalling",
        isAdmin: Boolean(data.isAdmin),
        active: data.active !== undefined ? Boolean(data.active) : true,
        accessModules: data.accessModules || [],
      });
    } catch (error) {
      toast.error("Error connecting to server");
      router.push("/crm/admin/associate&branch/associate-management");
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

  const handleSelectAllModules = () => {
    if (formData.accessModules.length === modulesList.length) {
      setFormData(prev => ({ ...prev, accessModules: [] }));
    } else {
      setFormData(prev => ({ ...prev, accessModules: [...modulesList] }));
    }
  };

  const handleRoleChange = (e) => {
    const selectedRole = e.target.value;
    setFormData(prev => ({ ...prev, role: selectedRole }));
  };

  const handleCopyId = () => {
    const targetId = rawUserData?._id || id;
    if (targetId) {
      navigator.clipboard.writeText(String(targetId));
      setCopiedId(true);
      toast.success("User ID copied to clipboard");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);

    try {
      const { assignedSenderNumbers, assignedTwilioNumbers, assignedSenderNumber, ...updatePayload } = formData;
      await userRepository.updateUser(id, updatePayload);

      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["chats"] });
      queryClient.invalidateQueries({ queryKey: ["detailed-customer"] });

      toast.success("Profile updated successfully!");
      router.push("/crm/admin/associate&branch/associate-management");
    } catch (err) {
      const errorMessage = err.response?.data?.error || "An unexpected error occurred.";
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    });
  };

  const currentBranchName = useMemo(() => {
    if (!formData.branch) return "Not assigned";
    const match = branches.find(
      b => String(b.id || b._id) === String(formData.branch) || b.name === formData.branch
    );
    return match ? match.name : String(formData.branch);
  }, [branches, formData.branch]);

  const roleDisplayLabel = useMemo(() => {
    if (formData.role === "sales") return "Associate";
    if (formData.role === "doctor") return "Doctor";
    if (formData.role === "superAdmin") return "SuperAdmin";
    return formData.role ? formData.role.charAt(0).toUpperCase() + formData.role.slice(1) : "Associate";
  }, [formData.role]);

  const departmentDisplayLabel = useMemo(() => {
    if (formData.department === "telecalling") return "Sales Department";
    if (formData.department === "support") return "Support Department";
    if (formData.department === "admin") return "Admin Department";
    return formData.department ? formData.department.charAt(0).toUpperCase() + formData.department.slice(1) : "Department";
  }, [formData.department]);

  const initialLetter = useMemo(() => {
    return (formData.name || "A").trim().charAt(0).toUpperCase();
  }, [formData.name]);

  if (status === "loading" || isLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm">
        <Loader2 className="animate-spin mr-2 text-[#00a884]" size={20} /> Fetching Profile...
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <AccessDenied message="Only administrators can edit user profiles." />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-[#f8fafc] custom-scrollbar">
      <div className="max-w-9xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* 1. BREADCRUMB */}
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <button 
            type="button"
            onClick={() => router.push("/crm/admin/associate&branch/associate-management")}
            className="p-1 hover:bg-slate-200/60 rounded-md text-blue-600 transition"
            title="Back to Associates"
          >
            <ArrowLeft size={16} />
          </button>
          <Link 
            href="/crm/admin/associate&branch/associate-management" 
            className="text-blue-600 hover:text-blue-700 hover:underline"
          >
            Associates
          </Link>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="text-slate-800 font-bold">
            Edit Associate - {formData.name || "Associate"}
          </span>
        </div>

        {/* 2. PAGE HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#e8f8f3] text-[#00a884] flex items-center justify-center shrink-0 shadow-xs border border-emerald-100">
              <UserCheck size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Edit Associate Profile
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Update identity, access, and permissions for this associate.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end sm:self-auto">
            <button
              type="button"
              onClick={() => router.push("/crm/admin/associate&branch/associate-management")}
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 hover:border-slate-300 transition shadow-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex items-center justify-center gap-2 bg-[#00a884] hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        {/* 3. MAIN CONTENT: TWO-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* LEFT COLUMN: FIXED/STICKY PROFILE & VERTICAL TABS (~320px / 4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-6">

            {/* Profile & Navigation Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 flex flex-col relative overflow-hidden">
              
              {/* Active Status Badge (Top Right) */}
              <div className="absolute top-5 right-5">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  formData.active 
                    ? "bg-[#e6f7f2] text-[#00a884] border border-emerald-200/60"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${formData.active ? "bg-[#00a884]" : "bg-slate-400"}`}></span>
                  {formData.active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Profile Avatar Initials */}
              <div className="w-20 h-20 rounded-full bg-[#e6f7f2] text-[#00a884] flex items-center justify-center text-3xl font-extrabold border-2 border-emerald-100 mx-auto mt-2 mb-3 shadow-inner">
                {initialLetter}
              </div>

              {/* Associate Info */}
              <div className="text-center flex flex-col items-center">
                <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  {formData.name || "Associate"}
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5 max-w-[240px] truncate">
                  {formData.email}
                </p>
                <div className="text-xs text-slate-600 font-medium mt-2 flex items-center gap-1.5">
                  <span>{roleDisplayLabel}</span>
                  <span className="text-slate-300">•</span>
                  <span>{departmentDisplayLabel}</span>
                </div>
                <div className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-1.5">
                  <Building2 size={13} className="text-slate-400 shrink-0" />
                  <span>{currentBranchName}</span>
                </div>
              </div>

              {/* Separator */}
              <div className="h-px bg-slate-100 my-5" />

              {/* Vertical Tab Navigation */}
              <nav className="flex flex-col gap-1">
                {[
                  { id: "personal", label: "Personal Information", icon: User },
                  { id: "organization", label: "Organization Structure", icon: Building2 },
                  { id: "access", label: "Access & Permissions", icon: Shield },
                  { id: "security", label: "Security & Authentication", icon: Lock },
                  { id: "modules", label: "System Modules", icon: LayoutGrid },
                ].map((tab) => {
                  const IconComponent = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left text-sm transition-all relative ${
                        isActive
                          ? "bg-[#eaf8f4] text-[#00a884] font-bold border-l-[3px] border-[#00a884]"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium border-l-[3px] border-transparent"
                      }`}
                    >
                      <IconComponent
                        size={17}
                        className={isActive ? "text-[#00a884]" : "text-slate-400"}
                      />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Metadata Card (Compact footer in left panel) */}
              <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-100 mt-6 flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">User ID</span>
                  <button 
                    type="button"
                    onClick={handleCopyId}
                    className="p-1 hover:bg-slate-200/60 rounded text-slate-400 hover:text-slate-600 transition flex items-center gap-1"
                    title="Copy User ID"
                  >
                    {copiedId ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-700 truncate -mt-1">
                  {rawUserData?._id || id}
                </div>

                <div className="h-px bg-slate-200/60 my-0.5" />

                <div>
                  <span className="text-slate-500 font-medium block">Created At</span>
                  <span className="text-slate-700 font-semibold mt-0.5 block">
                    {formatDate(rawUserData?.createdAt)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Last Updated</span>
                  <span className="text-slate-700 font-semibold mt-0.5 block">
                    {formatDate(rawUserData?.updatedAt)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block">Status</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${formData.active ? "bg-[#00a884]" : "bg-slate-400"}`}></span>
                    <span className="text-slate-800 font-bold">
                      {formData.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* RIGHT COLUMN: TAB CONTENT CARD (8 cols) */}
          <div className="lg:col-span-8 flex flex-col">

            {/* TAB 1: PERSONAL INFORMATION */}
            {activeTab === "personal" && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8 flex flex-col">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60">
                    <User size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Personal Information</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Core identity and contact details for this associate.
                    </p>
                  </div>
                </div>

                {/* Horizontal List Form */}
                <div className="divide-y divide-slate-100 mt-6">
                  
                  {/* Row 1: Full Name * */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                        <User size={15} />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        Full Name <span className="text-rose-500">*</span>
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0">
                      <input
                        type="text"
                        required
                        id="fullNameInput"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        onFocus={() => setEditingField("name")}
                        onBlur={() => setEditingField(null)}
                        placeholder="Enter full name"
                        className={`text-sm font-medium text-slate-800 bg-transparent px-3 py-1.5 rounded-lg transition-all outline-none text-left sm:text-right max-w-xs w-full ${
                          editingField === "name" 
                            ? "bg-slate-50 border border-slate-300 ring-2 ring-[#00a884]/20" 
                            : "hover:bg-slate-50/80 border border-transparent"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditingField("name");
                          document.getElementById("fullNameInput")?.focus();
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Edit Full Name"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Preferred Name */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                        <Tag size={15} />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        Preferred Name
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0">
                      <input
                        type="text"
                        id="preferredNameInput"
                        value={formData.preferredName}
                        onChange={(e) => setFormData({ ...formData, preferredName: e.target.value })}
                        onFocus={() => setEditingField("preferredName")}
                        onBlur={() => setEditingField(null)}
                        placeholder="Not set"
                        className={`text-sm font-medium text-slate-800 bg-transparent px-3 py-1.5 rounded-lg transition-all outline-none text-left sm:text-right max-w-xs w-full ${
                          editingField === "preferredName" 
                            ? "bg-slate-50 border border-slate-300 ring-2 ring-[#00a884]/20" 
                            : !formData.preferredName ? "text-slate-400 hover:bg-slate-50/80 border border-transparent" : "hover:bg-slate-50/80 border border-transparent"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditingField("preferredName");
                          document.getElementById("preferredNameInput")?.focus();
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Edit Preferred Name"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Row 3: Mobile Number */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                        <Phone size={15} />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        Mobile Number
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0">
                      <input
                        type="text"
                        id="mobileNumberInput"
                        value={formData.number}
                        onChange={(e) => setFormData({ ...formData, number: e.target.value })}
                        onFocus={() => setEditingField("number")}
                        onBlur={() => setEditingField(null)}
                        placeholder="Not set"
                        className={`text-sm font-medium text-slate-800 bg-transparent px-3 py-1.5 rounded-lg transition-all outline-none text-left sm:text-right max-w-xs w-full ${
                          editingField === "number" 
                            ? "bg-slate-50 border border-slate-300 ring-2 ring-[#00a884]/20" 
                            : !formData.number ? "text-slate-400 hover:bg-slate-50/80 border border-transparent" : "hover:bg-slate-50/80 border border-transparent"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setEditingField("number");
                          document.getElementById("mobileNumberInput")?.focus();
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                        title="Edit Mobile Number"
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Row 4: Email Address * (Read Only Primary Key) */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                        <Mail size={15} />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        Email Address <span className="text-rose-500">*</span>
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0">
                      <span className="text-sm font-medium text-slate-700 px-3 py-1.5">
                        {formData.email}
                      </span>
                      <div className="p-1.5 text-slate-300" title="Email is the primary login identifier and cannot be modified">
                        <Lock size={15} />
                      </div>
                    </div>
                  </div>

                </div>

                {/* Blue Information Notice */}
                <div className="bg-[#eff6ff] border border-blue-100 rounded-xl p-4 flex items-start gap-3.5 mt-8">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    i
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Information</h4>
                    <p className="text-xs text-blue-700/85 font-medium mt-0.5 leading-relaxed">
                      This information will be used across the CRM system for identification and communication.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: ORGANIZATION STRUCTURE */}
            {activeTab === "organization" && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8 flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/60">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Organization Structure</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Define roles, departments, and branch locations for this associate.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 mt-6">
                  
                  {/* Branch Location */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                        <Building2 size={15} />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        Branch Location <span className="text-rose-500">*</span>
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-end pl-11 sm:pl-0">
                      <select
                        required
                        value={formData.branch}
                        onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                        className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all max-w-xs w-full cursor-pointer"
                      >
                        <option value="" disabled>{loadingBranches ? "Loading branches..." : "Select Branch"}</option>
                        {branches.map(b => (
                          <option key={b.id || b._id} value={b.id || b._id}>
                            {b.name} ({b.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* System Role */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                        <Shield size={15} />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        System Role <span className="text-rose-500">*</span>
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-end pl-11 sm:pl-0">
                      <select
                        required
                        value={formData.role}
                        onChange={handleRoleChange}
                        className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all max-w-xs w-full cursor-pointer"
                      >
                        <option value="sales">Sales Associate</option>
                        <option value="doctor">Doctor</option>
                        {formData.role === "superAdmin" && (
                          <option value="superAdmin">Super Admin</option>
                        )}
                      </select>
                    </div>
                  </div>

                  {/* Department */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                        <Briefcase size={15} />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        Department <span className="text-rose-500">*</span>
                      </span>
                    </div>

                    <div className="flex-1 flex items-center justify-end pl-11 sm:pl-0">
                      <select
                        required
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                        className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all max-w-xs w-full cursor-pointer"
                      >
                        <option value="telecalling">Telecalling</option>
                        <option value="support">Support</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                </div>

                <div className="bg-[#eff6ff] border border-blue-100 rounded-xl p-4 flex items-start gap-3.5 mt-8">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    i
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Organization Hierarchy</h4>
                    <p className="text-xs text-blue-700/85 font-medium mt-0.5 leading-relaxed">
                      Branch and role assignments govern customer visibility, lead assignment queues, and team supervision.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 3: ACCESS & PERMISSIONS */}
            {activeTab === "access" && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8 flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/60">
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Access & Permissions</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Configure administrative privileges and account activation.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 mt-6">
                  
                  {/* Admin Privileges */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0 mt-0.5">
                        <KeyRound size={15} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-800 block">
                          Administrator Privileges
                        </span>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          Allows this user to access administrative management tools and branch controls.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 pl-11 sm:pl-0">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.isAdmin} 
                        onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })} 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884]"></div>
                    </label>
                  </div>

                  {/* Active Account Status */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0 mt-0.5">
                        <UserCheck size={15} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-800 block">
                          Account Status
                        </span>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          When deactivated, the associate is immediately prevented from logging into the CRM.
                        </p>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer shrink-0 pl-11 sm:pl-0">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={formData.active} 
                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })} 
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00a884]"></div>
                    </label>
                  </div>

                </div>

                <div className="bg-[#eff6ff] border border-blue-100 rounded-xl p-4 flex items-start gap-3.5 mt-8">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    i
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Access Control Policy</h4>
                    <p className="text-xs text-blue-700/85 font-medium mt-0.5 leading-relaxed">
                      Changes to access levels take effect immediately on the associate&apos;s next server request or session sync.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 4: SECURITY & AUTHENTICATION */}
            {activeTab === "security" && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8 flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100/60">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Security & Authentication</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Manage login credentials and password resets.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 mt-6">
                  
                  {/* Reset Password */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0 mt-0.5">
                        <Lock size={15} />
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-slate-800 block">
                          Reset Password
                        </span>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          Leave blank to keep current password.
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 flex items-center justify-end pl-11 sm:pl-0 max-w-xs w-full">
                      <div className="relative w-full">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-3 pr-10 text-sm font-mono text-slate-800 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Credential Status */}
                  <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                        <Shield size={15} />
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        Authentication Status
                      </span>
                    </div>

                    <div className="pl-11 sm:pl-0">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Standard Password Protected
                      </span>
                    </div>
                  </div>

                </div>

                <div className="bg-[#eff6ff] border border-blue-100 rounded-xl p-4 flex items-start gap-3.5 mt-8">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    i
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Authentication Notice</h4>
                    <p className="text-xs text-blue-700/85 font-medium mt-0.5 leading-relaxed">
                      Passwords must be at least 6 characters. If changed, the associate will need to log in with their new credentials on their next session.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 5: SYSTEM MODULES */}
            {activeTab === "modules" && (
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 md:p-8 flex flex-col">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/60">
                      <LayoutGrid size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">System Modules</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Control which CRM sections this associate can view and operate.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSelectAllModules}
                    className="text-xs font-bold text-[#00a884] hover:text-emerald-700 transition self-end sm:self-auto"
                  >
                    {formData.accessModules.length === modulesList.length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
                  {modulesList.map((mod) => {
                    const isChecked = formData.accessModules?.includes(mod);
                    return (
                      <label 
                        key={mod} 
                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isChecked 
                            ? "border-[#00a884] bg-emerald-50/30 shadow-xs" 
                            : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <span className={`text-sm font-semibold ${isChecked ? "text-slate-900" : "text-slate-600"}`}>
                          {mod}
                        </span>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                          isChecked ? "bg-[#00a884] border-[#00a884] text-white" : "bg-white border-slate-300"
                        }`}>
                          {isChecked && (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <input 
                          type="checkbox" 
                          className="hidden" 
                          checked={isChecked} 
                          onChange={() => handleModuleChange(mod)} 
                        />
                      </label>
                    );
                  })}
                </div>

                <div className="bg-[#eff6ff] border border-blue-100 rounded-xl p-4 flex items-start gap-3.5 mt-8">
                  <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    i
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Module Permissions</h4>
                    <p className="text-xs text-blue-700/85 font-medium mt-0.5 leading-relaxed">
                      Associates will only see the selected modules in their navigation sidebar and will be restricted from accessing unassigned tools.
                    </p>
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}