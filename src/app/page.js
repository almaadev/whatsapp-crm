"use client";

<<<<<<< HEAD
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginCard from "@/components/features/auth/LoginCard";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // If already authenticated, go to dashboard
    if (status === "authenticated") {
      router.replace("/crm");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500 animate-pulse">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gray-100">
      <LoginCard />
    </div>
  );
=======
import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { toast } from "react-toastify";
import { 
    Lock, Mail, ArrowRight, Eye, EyeOff, Loader2, 
    TrendingUp, Users, LayoutDashboard, Sparkles
} from "lucide-react";

import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";

// ─────────────────────────────────────────────────────────────────────────────
//  PAGE SHELL & AUTH REDIRECT LOGIC
// ─────────────────────────────────────────────────────────────────────────────
export default function LoginPage() {
    const { status } = useSession();
    const router = useRouter();

    useEffect(() => {
        if (status === "authenticated") {
            router.replace("/crm");
        }
    }, [status, router]);

    // Premium Loading State
    if (status === "loading" || status === "authenticated") {
        return (
            <div className="h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc]">
                <div className="relative w-20 h-20 flex items-center justify-center mb-6">
                    <div className="absolute inset-0 border-4 border-[#00a884]/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-[#00a884] rounded-full border-t-transparent animate-spin"></div>
                    <Image src={AlmaaLogo} alt="Almaa Logo" className="w-10 h-10 object-contain animate-pulse" />
                </div>
                <p className="text-slate-500 font-bold tracking-widest uppercase text-xs animate-pulse">
                    Authenticating Session...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full flex bg-[#f8fafc] font-sans">
            {/* ── LEFT SIDE: Immersive Brand Showcase (Hidden on Mobile) ── */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-[#0f172a] flex-col justify-between p-12">
                
                {/* Abstract Background Elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#00a884] rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse"></div>
                    <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-500 rounded-full mix-blend-screen filter blur-[120px] opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
                    {/* Subtle dot grid pattern overlay */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
                </div>

                <div className="relative z-10">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 mb-6">
                        <Sparkles className="text-[#00a884]" size={24} />
                    </div>
                    <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
                        Almaa Herbal Nature <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00a884] to-teal-400">
                            Command Center
                        </span>
                    </h2>
                    <p className="text-slate-400 mt-4 text-lg max-w-md leading-relaxed">
                        The intelligent platform driving sales, nurturing leads, and accelerating herbal therapy reach worldwide.
                    </p>
                </div>

                {/* Floating Glass Cards to simulate CRM value */}
                <div className="relative z-10 space-y-4 max-w-sm">
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center gap-4 transform transition-transform hover:-translate-y-1">
                        <div className="w-12 h-12 rounded-full bg-[#00a884]/20 flex items-center justify-center text-[#00a884]">
                            <TrendingUp size={20} />
                        </div>
                        <div>
                            <p className="text-white font-bold text-lg">Accelerate Growth</p>
                            <p className="text-slate-400 text-sm">Close deals faster with intelligent routing.</p>
                        </div>
                    </div>
                    
                    <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-2xl flex items-center gap-4 transform transition-transform hover:-translate-y-1">
                        <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400">
                            <Users size={20} />
                        </div>
                        <div>
                            <p className="text-white font-bold text-lg">Lead Management</p>
                            <p className="text-slate-400 text-sm">Track follow-ups and interactions seamlessly.</p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-slate-500 text-sm font-medium">
                    © {new Date().getFullYear()} Almaa Security Systems. All rights reserved.
                </div>
            </div>

            {/* ── RIGHT SIDE: Elevated Authentication Panel ── */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 relative overflow-hidden">
                {/* Mobile-only background blur */}
                <div className="absolute lg:hidden inset-0 bg-gradient-to-br from-emerald-50 to-slate-100 z-0"></div>
                <div className="absolute lg:hidden top-0 right-0 w-64 h-64 bg-[#00a884] rounded-full mix-blend-multiply filter blur-[100px] opacity-20 z-0"></div>
                
                <LoginCard />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  LOGIN CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function LoginCard() {
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
        <div className="w-full max-w-md bg-white/90 backdrop-blur-2xl p-8 sm:p-10 rounded-[2rem] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)] border border-white relative z-10 animate-in fade-in zoom-in-95 duration-500">
            
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
                <div className="relative group h-[60px]">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00a884] transition-colors z-10" size={20} />
                    <input
                        id="email"
                        type="email"
                        placeholder=" "
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="peer w-full h-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 pt-6 pb-2 focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] focus:bg-white outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        required
                    />
                    <label 
                        htmlFor="email" 
                        className="absolute left-12 top-2 text-[10px] font-bold uppercase text-slate-400 transition-all pointer-events-none 
                        peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case 
                        peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-[#00a884]"
                    >
                        Email Address
                    </label>
                </div>
                
                {/* Floating Label Password Input with Eye Toggle */}
                <div className="relative group h-[60px]">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00a884] transition-colors z-10" size={20} />
                    <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder=" "
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="peer w-full h-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-12 pt-6 pb-2 focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] focus:bg-white outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
                        required
                    />
                    <label 
                        htmlFor="password" 
                        className="absolute left-12 top-2 text-[10px] font-bold uppercase text-slate-400 transition-all pointer-events-none 
                        peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case 
                        peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-[#00a884]"
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
                    className="w-full relative overflow-hidden bg-gradient-to-r from-[#00a884] to-[#059669] text-white py-4 rounded-xl font-bold transition-all duration-300 shadow-[0_8px_20px_-6px_rgba(0,168,132,0.4)] hover:shadow-[0_12px_25px_-6px_rgba(0,168,132,0.5)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-80 disabled:pointer-events-none flex items-center justify-center gap-2 mt-8 group"
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