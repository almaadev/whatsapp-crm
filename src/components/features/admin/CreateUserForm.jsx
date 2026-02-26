"use client";
import { useState } from "react";
import { User, Mail, Lock, Shield, CheckCircle, AlertCircle, Plus } from "lucide-react";

export default function CreateUserForm() {
  const [formData, setFormData] = useState({
    name: "", email: "", password: "", role: "sales_associate"
  });
  const [status, setStatus] = useState({ type: "", message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ type: "", message: "" });
    
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      
      if (res.ok) {
        setStatus({ type: "success", message: "User created successfully!" });
        setFormData({ name: "", email: "", password: "", role: "sales_associate" });
      } else {
        setStatus({ type: "error", message: "Failed to create user." });
      }
    } catch (err) {
      setStatus({ type: "error", message: "An unexpected error occurred." });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="bg-white p-0 md:p-2">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Name Input */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Full Name</label>
            <div className="relative group">
                <User className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                <input 
                    placeholder="e.g. John Doe" 
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 placeholder:text-slate-400" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    required
                />
            </div>
        </div>

        {/* Email Input */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email Address</label>
            <div className="relative group">
                <Mail className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                <input 
                    type="email" 
                    placeholder="e.g. john@almaa.com" 
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 placeholder:text-slate-400" 
                    value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    required
                />
            </div>
        </div>

        {/* Password Input */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Default Password</label>
            <div className="relative group">
                <Lock className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                <input 
                    type="text" 
                    placeholder="Set a strong password" 
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 placeholder:text-slate-400 font-mono" 
                    value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    required
                />
            </div>
        </div>

        {/* Role Select */}
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Assign Role</label>
            <div className="relative group">
                <Shield className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-emerald-600 transition-colors" size={18} />
                <select 
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700 appearance-none cursor-pointer"
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                >
                    <option value="sales_associate">Sales Associate</option>
                    <option value="doctor_associate">Doctor Associate</option>
                    <option value="admin">Administrator</option>
                </select>
                <div className="absolute right-4 top-4 w-2 h-2 border-r-2 border-b-2 border-slate-400 rotate-45 pointer-events-none"></div>
            </div>
        </div>
        
        {/* Status Message */}
        {status.message && (
            <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                {status.type === 'success' ? <CheckCircle size={16}/> : <AlertCircle size={16}/>}
                {status.message}
            </div>
        )}

        {/* Submit Button */}
        <button 
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0"
        >
            {loading ? "Creating Account..." : <><Plus size={18} /> Create Account</>}
        </button>
      </form>
    </div>
  );
}