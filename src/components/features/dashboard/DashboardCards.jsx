"use client";
import { useChatStore } from "@/store/chatStore";
import { Clock, CheckCircle } from "lucide-react";

export default function DashboardCards() {
  const messages = useChatStore((s) => s.messages);
  const pendingCount = messages.filter(m => m.status === "New").length;
  const closedCount = messages.filter(m => m.status === "Closed").length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <Card 
        label="Pending Attention" 
        value={pendingCount} 
        icon={<Clock size={24} className="text-white" />} 
        gradient="from-amber-500 to-orange-600" 
        subtext="Leads waiting for reply"
      />
      <Card 
        label="Deals Closed" 
        value={closedCount} 
        icon={<CheckCircle size={24} className="text-white" />} 
        gradient="from-emerald-500 to-teal-600" 
        subtext="Successfully converted"
      />
    </div>
  );
}

function Card({ label, value, icon, gradient, subtext }) {
    return (
        <div className={`relative overflow-hidden rounded-2xl shadow-lg bg-gradient-to-br ${gradient} p-6 text-white`}>
            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <p className="text-white/80 text-sm font-medium uppercase tracking-wider">{label}</p>
                    <h3 className="text-4xl font-bold mt-2">{value}</h3>
                    <p className="text-white/60 text-xs mt-2">{subtext}</p>
                </div>
                <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md">
                    {icon}
                </div>
            </div>
            {/* Decorative Circle */}
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </div>
    );
}