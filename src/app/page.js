"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { 
  TrendingUp, Users, Sparkles
} from "lucide-react";
import LoginCard from "@/features/auth/components/LoginCard";
import AlmaaLogo from "@/../public/logo/Almaa Herbal Logo.png";


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
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00a884] to-teal-400">
                            Welcome to Almaa CRM
                        </span> <br /> 
                        Almaa Herbal Nature Pvt. Ltd.
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
                    © {new Date().getFullYear()} Almaa Herbal Nature Pvt. Ltd. All rights reserved.
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

