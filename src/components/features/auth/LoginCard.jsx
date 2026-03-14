"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, ArrowRight } from "lucide-react";
import Image from "next/image";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";
import { toast } from "react-toastify";

export default function LoginCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if(!email || !password) return toast.warning("Please enter email and password");
    setLoading(true);
    const result = await signIn("credentials", { redirect: false, email, password });
    if (result?.ok) {
        toast.success("Welcome back!");
        router.push("/dashboard");
    } else { 
        toast.error("Invalid Credentials"); 
        setLoading(false); 
    }
  };

  return (
    <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-2xl border border-slate-100">
      <div className="text-center mb-8">
        <div className="w-24 h-24 rounded-xl mx-auto flex items-center justify-center 0 mb-4">
          <Image src={AlmaaLogo} alt="Almaa Herbal Logo" className="w-full object-contain" draggable={false} />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome Back</h1>
        <p className="text-slate-500 text-sm mt-2">Enter your credentials to access the CRM</p>
      </div>

      <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input
              className="w-full border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-800 transition-all placeholder:text-slate-400"
              type="email"
              placeholder="associate@almaa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-500 uppercase ml-1">Password</label>
          <div className="relative">
            <Lock className="absolute left-4 top-3.5 text-slate-400" size={18} />
            <input
              type="password"
              className="w-full border border-slate-200 bg-slate-50 pl-11 pr-4 py-3 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-slate-800 transition-all placeholder:text-slate-400"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:pointer-events-none flex items-center justify-center gap-2 mt-4"
        >
          {loading ? "Verifying..." : <>Sign In <ArrowRight size={18}/></>}
        </button>
      </form>
      
      <p className="text-center text-xs text-slate-400 mt-8">
        Protected by Almaa Security Systems © {new Date().getFullYear()}
      </p>
    </div>
  );
}