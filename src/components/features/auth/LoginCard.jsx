"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
<<<<<<< HEAD
import { Lock, Mail, ArrowRight } from "lucide-react";
=======
import { Lock, Mail, ArrowRight, Eye, EyeOff, Loader2, LayoutDashboard,  } from "lucide-react";
>>>>>>> c1be5bc (Initial commit from new system)
import Image from "next/image";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";
import { toast } from "react-toastify";

<<<<<<< HEAD
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
        router.push("/crm");
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
=======




export default function LoginCard() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) return toast.warning("Please enter both email and password.");
        
        setLoading(true);
        const result = await signIn("credentials", { redirect: false, email, password });
        
        if (result?.ok) {
            toast.success("Authentication successful. Securing session...");
            router.push("/crm");
        } else { 
            toast.error("Invalid Credentials. Access denied."); 
            setLoading(false); 
        }
    };

    return (
        <div className="w-full max-w-md bg-white/80 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white relative z-10 animate-in fade-in zoom-in-95 duration-500">
            
            {/* --- Brand Identity Header --- */}
            <div className="text-center mb-10">
                <div className="relative w-24 h-24 mx-auto mb-6">
                    {/* Soft Logo Halo */}
                    <div className="absolute inset-0 bg-[#00a884] blur-xl opacity-20 rounded-full animate-pulse"></div>
                    <div className="relative w-full h-full bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center p-3">
                        <Image src={AlmaaLogo} alt="Almaa Herbal Logo" className="w-full h-full object-contain drop-shadow-sm" draggable={false} priority />
                    </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                    Secure Portal Login
                </h1>
                <p className="text-slate-500 text-sm font-medium mt-2 flex items-center justify-center gap-1.5">
                    <LayoutDashboard size={14} className="text-[#00a884]" /> Smart CRM Intelligence
                </p>
            </div>

            {/* --- Form Section --- */}
            <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
                
                {/* Floating Label Email Input */}
                <div className="relative group h-14">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00a884] transition-colors z-10" size={20} />
                    <input
                        id="email"
                        type="email"
                        placeholder=" "
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="peer w-full h-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 pt-4 pb-1 focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] focus:bg-white outline-none text-sm font-medium text-slate-800 transition-all shadow-sm"
                        required
                    />
                    <label 
                        htmlFor="email" 
                        className="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400 text-sm transition-all pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-focus:top-3.5 peer-focus:-translate-y-1/2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-[#00a884] valid:top-3.5 valid:-translate-y-1/2 valid:text-[10px] valid:font-bold valid:uppercase"
                    >
                        Email Address
                    </label>
                </div>
                
                {/* Floating Label Password Input with Eye Toggle */}
                <div className="relative group h-14">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00a884] transition-colors z-10" size={20} />
                    <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder=" "
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="peer w-full h-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-12 pt-4 pb-1 focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] focus:bg-white outline-none text-sm font-medium text-slate-800 transition-all shadow-sm"
                        required
                    />
                    <label 
                        htmlFor="password" 
                        className="absolute left-12 top-1/2 -translate-y-1/2 text-slate-400 text-sm transition-all pointer-events-none peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-focus:top-3.5 peer-focus:-translate-y-1/2 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-[#00a884] valid:top-3.5 valid:-translate-y-1/2 valid:text-[10px] valid:font-bold valid:uppercase"
                    >
                        Security Key
                    </label>

                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-[#00a884] hover:bg-emerald-50 rounded-lg transition-colors z-10"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                </div>

                {/* --- Action Button --- */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full relative overflow-hidden bg-gradient-to-r from-[#00a884] to-[#059669] text-white py-3.5 rounded-xl font-bold transition-all duration-300 shadow-[0_8px_20px_-6px_rgba(0,168,132,0.4)] hover:shadow-[0_12px_25px_-6px_rgba(0,168,132,0.5)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-80 disabled:pointer-events-none flex items-center justify-center gap-2 mt-8 group"
                >
                    {/* Subtle button glare effect */}
                    <div className="absolute top-0 left-[-100%] w-[50%] h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[30deg] group-hover:left-[200%] transition-all duration-1000 ease-in-out"></div>
                    
                    {loading ? (
                        <>
                            <Loader2 size={18} className="animate-spin" />
                            <span>Authenticating...</span>
                        </>
                    ) : (
                        <>
                            <span>Access Workspace</span>
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
            </form>
            
            <div className="mt-8 pt-6 border-t border-slate-100 text-center lg:hidden">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                    Protected System
                </p>
            </div>
        </div>
    );
>>>>>>> c1be5bc (Initial commit from new system)
}