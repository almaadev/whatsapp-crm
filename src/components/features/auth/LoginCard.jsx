"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LayoutDashboard,
} from "lucide-react";
import Image from "next/image";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";
import { toast } from "react-toastify";

export default function LoginCard() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password)
      return toast.warning("Please enter both email and password.");

    setLoading(true);
    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

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
        <div className="relative w-32 h-32 mx-auto mb-2">
          {/* Soft Logo Halo */}

          <div className="relative w-full h-full  flex items-center justify-center p-3">
            <Image
              src={AlmaaLogo}
              alt="Almaa Herbal Logo"
              className="w-full h-full object-contain drop-shadow-sm"
              draggable={false}
              priority
            />
          </div>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
          Almaa CRM Portal
        </h1>
        <p className="text-slate-500 text-sm font-medium mt-2 flex items-center justify-center gap-1.5">
          <LayoutDashboard size={14} className="text-[#00a884]" /> Smart CRM
          Intelligence
        </p>
      </div>

      {/* --- Form Section --- */}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin();
        }}
      >
        {/* Floating Label Email Input */}
        <div className="relative group h-[60px] flex items-center justify-center">
          <Mail
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00a884] transition-colors z-10"
            size={20}
          />
          <label
            htmlFor="email"
            className="absolute left-12 top-2 text-[10px] font-bold uppercase text-slate-400 transition-all pointer-events-none 
                        peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case 
                        peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-[#00a884]"
          >
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder=" "
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="peer w-full h-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 pt-6 pb-2 focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] focus:bg-white outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
            required
          />
        </div>

        {/* Floating Label Password Input with Eye Toggle */}
        <div className="relative group h-[60px]">
          <Lock
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#00a884] transition-colors z-10"
            size={20}
          />
          <label
            htmlFor="password"
            className="absolute left-12 top-2 text-[10px] font-bold uppercase text-slate-400 transition-all pointer-events-none 
                        peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm peer-placeholder-shown:font-medium peer-placeholder-shown:normal-case 
                        peer-focus:top-2 peer-focus:-translate-y-0 peer-focus:text-[10px] peer-focus:font-bold peer-focus:uppercase peer-focus:text-[#00a884]"
          >
            Security Key
          </label>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder=" "
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="peer w-full h-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-12 pt-6 pb-2 focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] focus:bg-white outline-none text-sm font-bold text-slate-800 transition-all shadow-sm"
            required
          />

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
              <span>Sign In</span>
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
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
}
