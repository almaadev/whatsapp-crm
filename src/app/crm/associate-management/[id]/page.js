"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { message } from "antd";
import { User, Mail, Lock, Shield, Phone, Briefcase, Tag, ArrowLeft, Save, ShieldAlert, Building } from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";

export default function EditAssociatePage() {
  const { data: session, status } = useSession();
  const { id } = useParams();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "", preferredName: "", email: "", number: "", password: "", branch: "",
    role: "sales", department: "telecalling", isAdmin: false, active: true, accessModules: []
  });

  // 👇 FIX: Added New Modules (Product Lead, MD Camp, Therapy)
  const modulesList = ["Leads", "Customers", "Reports", "Chat Inbox", "Product Lead", "MD Camp", "Therapy"];

  const tamilNaduDistricts = [
    "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore", "Dharmapuri",
    "Dindigul", "Erode", "Kallakurichi", "Kanchipuram", "Kanyakumari", "Karur",
    "Krishnagiri", "Madurai", "Mayiladuthurai", "Nagapattinam", "Namakkal", "Nilgiris",
    "Perambalur", "Pudukkottai", "Ramanathapuram", "Ranipet", "Salem", "Sivaganga",
    "Tenkasi", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
    "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur", "Vellore",
    "Viluppuram", "Virudhunagar"
  ];

  const isAuthorized =
    session?.user?.role === 'superAdmin' ||
    (session?.user?.role === 'sales' && session?.user?.department === 'admin') ||
    (session?.user?.role === 'doctor' && session?.user?.department === 'admin');

  useEffect(() => {
    if (status === "loading") return;

    if (isAuthorized) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [session, status, id, isAuthorized]);

  const fetchUser = async () => {
    try {
      const res = await fetch(`/api/users/${id}`);
      if (res.ok) {
        const data = await res.json();
        setFormData({
          ...data,
          password: "",
          preferredName: data.preferredName || "",
          number: data.number || "",
          branch: data.branch || "" 
        });
      } else {
        message.error("Failed to load user data");
        router.push("/crm/associate-management");
      }
    } catch (error) {
      message.error("Error connecting to server");
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
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const contentType = res.headers.get("content-type");

      if (res.ok) {
        message.success("Profile updated successfully!");
        router.push("/crm/associate-management");
      } else {
        if (contentType && contentType.includes("application/json")) {
          const errorData = await res.json();
          message.error(errorData.error || "Failed to update user.");
        } else {
          message.error("Server HTML error. Check console.");
        }
      }
    } catch (err) {
      message.error("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) return <div className="flex h-[100dvh] items-center justify-center text-slate-500 font-medium">Loading Associate Data...</div>;

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
            <p className="text-slate-500 mt-2">Only administrators can edit user profiles.</p>
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
        <div className="md:hidden h-14 bg-white border-b flex items-center px-4 shrink-0 justify-between z-30 shadow-sm">
          <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-md">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="w-20 flex items-center justify-center shrink-0 p-1">
            <img src={AlmaaLogo.src} alt="Almaa" className="w-full h-full object-contain" />
          </div>
          <div className="w-8"></div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 w-full">
          <div className="max-w-4xl mx-auto">

            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => router.back()} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 text-gray-600 border border-gray-200 transition">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Edit Associate Profile</h2>
                <p className="text-sm text-slate-500">Update details, access, and status for {formData.name}</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Full Name *</label>
                    <div className="relative group"><User className="absolute left-3.5 top-3.5 text-slate-400" size={16} /><input required className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} /></div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Preferred Name</label>
                    <div className="relative group"><Tag className="absolute left-3.5 top-3.5 text-slate-400" size={16} /><input className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={formData.preferredName} onChange={e => setFormData({ ...formData, preferredName: e.target.value })} /></div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email Address *</label>
                    <div className="relative group"><Mail className="absolute left-3.5 top-3.5 text-slate-400" size={16} /><input required type="email" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mobile Number</label>
                    <div className="relative group"><Phone className="absolute left-3.5 top-3.5 text-slate-400" size={16} /><input type="text" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" value={formData.number} onChange={e => setFormData({ ...formData, number: e.target.value })} /></div>
                  </div>
                  
                  <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Branch *</label>
                      <div className="relative group">
                          <Building className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                          <select required className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer appearance-none" 
                              value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                              <option value="" disabled>Select Branch / District</option>
                              {tamilNaduDistricts.map((district) => (
                                  <option key={district} value={district}>
                                      {district}
                                  </option>
                              ))}
                          </select>
                      </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Role *</label>
                    <div className="relative group"><Shield className="absolute left-3.5 top-3.5 text-slate-400" size={16} /><select className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer" value={formData.role} onChange={handleRoleChange}><option value="sales">Sales</option><option value="doctor">Doctor</option><option value="superAdmin">Super Admin</option></select></div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Department *</label>
                    <div className="relative group"><Briefcase className="absolute left-3.5 top-3.5 text-slate-400" size={16} /><select className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })}><option value="telecalling">Telecalling</option><option value="support">Support</option><option value="admin">Admin</option></select></div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Change Password (Optional)</label>
                    <div className="relative group"><Lock className="absolute left-3.5 top-3.5 text-slate-400" size={16} /><input type="text" placeholder="Leave blank to keep current password" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} /></div>
                  </div>
                </div>

                <div className="flex gap-6 py-4 border-y border-slate-100">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isAdmin === true || String(formData.isAdmin) === "true"}
                      onChange={e => setFormData({ ...formData, isAdmin: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    Is Admin User
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.active === true || String(formData.active) === "true"}
                      onChange={e => setFormData({ ...formData, active: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    Active Account
                  </label>
                </div>

                {/* 👇 FIX: Displaying All Access Modules */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Access Modules</label>
                  <div className="flex flex-wrap gap-3">
                    {modulesList.map(mod => (
                      <label key={mod} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-all"><input type="checkbox" checked={formData.accessModules.includes(mod)} onChange={() => handleModuleChange(mod)} className="w-4 h-4 text-emerald-600 rounded" />{mod}</label>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button disabled={saving} className="bg-[#0b8343] hover:bg-[#0a7039] text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70">
                    {saving ? "Saving..." : <><Save size={18} /> Save Changes</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}