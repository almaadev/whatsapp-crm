"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/layout/Sidebar";
import ChatArea from "@/components/features/chat/ChatArea";
import { useChatStore } from "@/store/chatStore";
import { 
  ArrowLeft, User, Phone, MapPin, Briefcase, 
  FileText, Save, Loader2, MessageSquarePlus, CheckCircle 
} from "lucide-react";
import { toast } from "react-toastify";

export default function NewCustomerPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const setSelectedChat = useChatStore((s) => s.setSelectedChat);
  const selectedChat = useChatStore((s) => s.selectedChat);

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [existingCustomer, setExistingCustomer] = useState(null);
  
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    city: "",
    enquiredFor: "",
    status: "New",
    saleAmount: "",
    remarks: "",
    source: "Direct"
  });

  // Debounce check for existing customer
  useEffect(() => {
      const cleanMobile = formData.mobile.replace(/\D/g, "");
      if (cleanMobile.length >= 10) {
          const timeoutId = setTimeout(() => checkExistence(cleanMobile), 800);
          return () => clearTimeout(timeoutId);
      } else {
          setExistingCustomer(null);
      }
  }, [formData.mobile]);

  const checkExistence = async (rawMobile) => {
      setChecking(true);
      const formattedPhone = `whatsapp:+91${rawMobile.slice(-10)}`;
      try {
          const chatRes = await fetch("/api/chats");
          if (chatRes.ok) {
              const chats = await chatRes.json();
              const found = chats.find(c => c.phone === formattedPhone);
              if (found) {
                  setExistingCustomer(found);
                  // Auto-select chat if found so right panel shows history
                  setSelectedChat(found);
              } else {
                  setExistingCustomer(null);
                  // Clear selection if not found so right panel is blank/ready
                  setSelectedChat(null);
              }
          }
      } catch (e) { console.error(e); }
      finally { setChecking(false); }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // If existing, just redirect/open chat
    if (existingCustomer) {
        setSelectedChat(existingCustomer);
        router.push("/dashboard/chat");
        return;
    }

    const cleanMobile = formData.mobile.replace(/\D/g, "");
    if (!cleanMobile || cleanMobile.length < 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);
    const formattedPhone = `whatsapp:+91${cleanMobile.slice(-10)}`;

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...formData,
            mobile: formattedPhone 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create customer");

      toast.success("Customer added!");
      
      const newChatObj = {
          phone: formattedPhone,
          name: formData.name || formattedPhone,
          status: formData.status,
          history: [], 
          lastSeenAt: new Date().toISOString()
      };
      
      setSelectedChat(newChatObj);
      router.push("/dashboard/chat"); 
      
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error(error.message || "Error adding customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden">
        
        {/* 1. Sidebar */}
        <Sidebar role={session?.user?.role || "sales"} mobileOpen={mobileMenuOpen} setMobileOpen={setMobileMenuOpen} />

        {/* 2. LEFT PANEL: Add Customer Form (Replaces ChatList) */}
        <div className="flex flex-col w-full md:w-[400px] border-r border-slate-200 bg-white h-full shrink-0 z-20 shadow-xl md:shadow-none absolute md:relative">
             
             {/* Header */}
             <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => router.push('/dashboard/chat')} className="p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <h1 className="font-bold text-lg text-slate-800">Add Customer</h1>
                </div>
             </div>

             {/* Scrollable Form Area */}
             <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    
                    {/* Mobile Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 ml-1">
                            <Phone size={12} /> Mobile Number <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                            <input 
                                type="tel" 
                                name="mobile"
                                value={formData.mobile}
                                onChange={handleChange}
                                placeholder="Enter Whatsapp Number..."
                                className={`w-full p-4 bg-slate-50 border ${existingCustomer ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'} rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all font-mono text-lg font-medium text-slate-800 placeholder:text-slate-400`}
                                autoFocus
                                required
                            />
                            {checking && <div className="absolute right-4 top-4"><Loader2 size={20} className="animate-spin text-slate-400"/></div>}
                            {existingCustomer && !checking && <div className="absolute right-4 top-4 text-emerald-600"><CheckCircle size={20}/></div>}
                        </div>
                        
                        {existingCustomer && (
                            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex items-start gap-3 mt-2">
                                <div className="p-1.5 bg-white rounded-full text-emerald-600 shadow-sm"><User size={14}/></div>
                                <div>
                                    <p className="text-sm font-bold text-emerald-900">Customer Exists!</p>
                                    <p className="text-xs text-emerald-700">Name: {existingCustomer.name || "Unknown"}</p>
                                    <p className="text-xs text-emerald-700">Status: {existingCustomer.status}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {!existingCustomer && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup icon={<User size={14}/>} label="Name" name="name" value={formData.name} onChange={handleChange} placeholder="Optional" />
                                <InputGroup icon={<MapPin size={14}/>} label="City" name="city" value={formData.city} onChange={handleChange} placeholder="Optional" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <InputGroup icon={<Briefcase size={14}/>} label="Enquiry" name="enquiredFor" value={formData.enquiredFor} onChange={handleChange} placeholder="Optional" />
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Status</label>
                                    <select name="status" value={formData.status} onChange={handleChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm font-medium text-slate-700 h-[46px]">
                                        <option>New</option>
                                        <option>Follow Up</option>
                                        <option>Closed</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 ml-1"><FileText size={12}/> Note</label>
                                <textarea name="remarks" value={formData.remarks} onChange={handleChange} rows="3" className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm resize-none" placeholder="Initial remarks (optional)..."></textarea>
                            </div>
                        </>
                    )}

                    <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 active:scale-[0.98] mt-4">
                        {loading ? <Loader2 size={20} className="animate-spin"/> : (existingCustomer ? <MessageSquarePlus size={20}/> : <Save size={20}/>)}
                        <span>{existingCustomer ? "Open Chat" : "Save & Start Chat"}</span>
                    </button>

                </form>
             </div>
        </div>

        <main className="flex-1 hidden md:flex flex-col h-full bg-[#e5ddd5]/30 relative">
            {selectedChat ? (
                <ChatArea />
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
                        <User size={40} className="opacity-50"/>
                    </div>
                    <p className="font-medium">Enter a number to check records</p>
                </div>
            )}
        </main>
    </div>
  );
}

function InputGroup({ label, name, value, onChange, placeholder, icon }) {
    return (
        <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 ml-1">{icon} {label}</label>
            <input type="text" name={name} value={value} onChange={onChange} placeholder={placeholder} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm transition-all" />
        </div>
    )
}