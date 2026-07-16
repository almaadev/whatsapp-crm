"use client";
import { useState, useEffect } from "react";
import { User, Mail, Lock, Shield, CheckCircle, AlertCircle, Plus, Phone, Briefcase, Tag, Building, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { userRepository } from "@/shared/api/repositories/userRepository";
import { branchService } from "@/features/branches/services/branchService";

export default function CreateUserForm({ onSuccess }) {
    const { data: session } = useSession();

  const [formData, setFormData] = useState({
    name: "", preferredName: "", email: "", number: "", password: "",
    role: "sales", department: "telecalling", branch: "", isAdmin: false, active: true, accessModules: []
  });
  
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);


  const modulesList = ["Leads", "Customers", "Reports", "Bulk Messages", "Messages log" ,"Chat Inbox", "Product Lead", "MD Camp", "Therapy"];

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
      setFormData(prev => ({
        ...prev,
        role: "superAdmin", 
        department: "admin",
        isAdmin: true,
        accessModules: [...modulesList] 
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        role: selectedRole,
        isAdmin: false 
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });
    
    try {
      await userRepository.createUser(formData);
      setStatus({ type: "success", message: "User created successfully!" });
      setFormData({ 
        name: "", preferredName: "", email: "", number: "", password: "", branch: "",
        role: "sales", department: "telecalling", isAdmin: false, active: true, accessModules: [] 
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      const errorMessage = err.response?.data?.error || "An unexpected error occurred.";
      setStatus({ type: "error", message: errorMessage });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="bg-white p-0 md:p-2 max-h-[70vh] overflow-y-auto custom-scrollbar">
      <form onSubmit={handleSubmit} className="space-y-4 pr-2">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Full Name *</label>
                <div className="relative group">
                    <User className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <input required placeholder="Associate Name" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" 
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Preferred Name</label>
                <div className="relative group">
                    <Tag className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <input placeholder="Nick Name" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" 
                        value={formData.preferredName} onChange={e => setFormData({...formData, preferredName: e.target.value})} />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email Address *</label>
                <div className="relative group">
                    <Mail className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <input required type="email" placeholder="Associate@almaa.com" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm" 
                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Mobile Number</label>
                <div className="relative group">
                    <Phone className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <input type="number" placeholder="+91 9876543210" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} />
                </div>
            </div>

            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Branch *</label>
                <div className="relative group">
                    <Building className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <select required className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer appearance-none" 
                        value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                        <option value="" disabled>{loadingBranches ? "Loading branches..." : "Select Branch"}</option>
                        {branches.map((b) => (
                            <option key={b.id || b._id} value={b.name}>
                                {b.name} ({b.status})
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Role *</label>
                <div className="relative group">
                    <Shield className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <select className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer appearance-none"
                        value={formData.role} onChange={handleRoleChange}>
                        {
                            session?.user?.role === "superAdmin" ? (
                                <>
                                <option value="sales">Sales</option>
                                 <option value="doctor">Doctor</option>
                                </>
                            ) : session?.user?.role === "sales" ? (
                                <option value="sales">Sales</option>
                            ) : session?.user?.role === "doctor" ? (
                                <option value="doctor">Doctor</option>
                            ) : null

                        }
                        {session?.user?.role === "superAdmin" && (
                            <option value="superAdmin">Super Admin</option>
                        )}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Department *</label>
                <div className="relative group">
                    <Briefcase className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <select className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm cursor-pointer appearance-none"
                        value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}>
                        <option value="telecalling">Telecalling</option>
                        <option value="support">Support</option>
                        <option value="admin">Admin</option>
                        
                    </select>
                </div>
            </div>
            
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Password *</label>
                <div className="relative group">
                    <Lock className="absolute left-3.5 top-3.5 text-slate-400" size={16} />
                    <input required type="password" placeholder="Set a strong password" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-sm" 
                        value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
            </div>
        </div>

        <div className="flex gap-6 py-2 border-y border-slate-100">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={formData.isAdmin} onChange={e => setFormData({...formData, isAdmin: e.target.checked})} className="w-4 h-4 text-emerald-600 rounded" />
                Is Admin
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="w-4 h-4 text-emerald-600 rounded" />
                Active Account
            </label>
        </div>

        {/* 👇 FIX: Displaying All Access Modules */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2 ml-1">Access Modules</label>
            <div className="flex flex-wrap gap-3">
                {modulesList.map(mod => (
                    <label key={mod} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-all">
                        <input type="checkbox" checked={formData.accessModules.includes(mod)} onChange={() => handleModuleChange(mod)} className="w-3.5 h-3.5 text-emerald-600 rounded" />
                        {mod}
                    </label>
                ))}
            </div>
        </div>
        
        {status.message && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {status.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                {status.message}
            </div>
        )}

        <button disabled={loading} className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-70 mt-4">
            {loading ? "Creating..." : <><Plus size={18} /> Create Account</>}
        </button>
      </form>
    </div>
  );
}