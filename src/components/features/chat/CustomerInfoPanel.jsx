"use client";
import { useState, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { X, User, MapPin, Globe, HelpCircle, DollarSign, FileText, Save, History, List, Tag } from "lucide-react";
import { toast } from "react-toastify";

export default function CustomerInfoPanel({ isOpen, onClose, leadCategory = null, activeChat = null }) {
  const globalSelectedChat = useChatStore((s) => s.selectedChat);
  const updateChatDetails = useChatStore((s) => s.updateChatDetails);
  
  // Use passed activeChat if available, else fallback to global (for Main Chat Inbox)
  const selectedChat = activeChat || globalSelectedChat;

  const [loading, setLoading] = useState(false);
  const [leadHistory, setLeadHistory] = useState([]);

  const [formData, setFormData] = useState({
    name: "", city: "", address: "",
    source: "Whatsapp", enquiredFor: "", status: "New",
    saleAmount: "", remarks: "", day1Remarks: "", day2Remarks: "", day3Remarks: "",
    adType: ""
  });

  useEffect(() => {
    if (selectedChat && selectedChat.phone) {
      setFormData({
        name: selectedChat.name !== "Unknown" ? (selectedChat.name || "") : "",
        city: selectedChat.city || "",
        address: selectedChat.address || "",
        source: selectedChat.source || "Whatsapp",
        enquiredFor: selectedChat.enquiredFor || "",
        status: selectedChat.status || "New",
        saleAmount: selectedChat.saleAmount || "",
        remarks: selectedChat.remarks || selectedChat.lastClosedNote || "",
        day1Remarks: selectedChat.day1Remarks || "",
        day2Remarks: selectedChat.day2Remarks || "",
        day3Remarks: selectedChat.day3Remarks || "",
        adType: selectedChat.adType || ""
      });

      const rawPhone = selectedChat.phone.replace('whatsapp:', '');
      fetch("/api/customers")
        .then(res => res.json())
        .then(customers => {
          if (Array.isArray(customers)) {
            const existingCustomer = customers.find(c => c.phone && c.phone.includes(rawPhone));
            if (existingCustomer) {
              setFormData(prev => ({
                ...prev,
                name: prev.name ? prev.name : (existingCustomer.name !== "Unknown" ? existingCustomer.name : ""),
                city: prev.city ? prev.city : (existingCustomer.city || ""),
                address: prev.address ? prev.address : (existingCustomer.address || ""),
                source: (prev.source && prev.source !== "Whatsapp") ? prev.source : (existingCustomer.source || "Whatsapp"),
              }));
            }
          }
        })
        .catch(err => console.error("Auto-fill fetch failed", err));
    }
  }, [selectedChat?.phone]);

  useEffect(() => {
    if (selectedChat?.phone && !leadCategory) { 
      const rawPhone = selectedChat.phone.replace('whatsapp:', '');
      fetch(`/api/leads/${encodeURIComponent(rawPhone)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.leads) {
            setLeadHistory(data.leads);
            const activeLead = data.leads.find(l => !l.isClosed);
            if (activeLead) {
                setFormData(prev => ({
                    ...prev,
                    enquiredFor: activeLead.enquiredFor || prev.enquiredFor || "",
                    status: activeLead.status || prev.status || "New",
                    saleAmount: activeLead.saleAmount || prev.saleAmount || "",
                    remarks: activeLead.remarks || prev.remarks || "",
                    day1Remarks: activeLead.day1Remarks || prev.day1Remarks || "",
                    day2Remarks: activeLead.day2Remarks || prev.day2Remarks || "",
                    day3Remarks: activeLead.day3Remarks || prev.day3Remarks || ""
                }));
            }
          }
        })
        .catch(err => console.error("Failed to fetch lead history", err));
    }
  }, [selectedChat?.phone, leadCategory]);

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!selectedChat) return;
    setLoading(true);
    try {
      const endpoint = leadCategory ? `/api/category-leads-update/${leadCategory}` : "/api/leads";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: selectedChat.phone,
          ...formData, 
          checkDuplicates: false
        }),
      });

      if (!res.ok) throw new Error("Failed");

      updateChatDetails(selectedChat.phone, {
        ...formData,
        interest: formData.enquiredFor
      });

      toast.success("Lead details updated!");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Error saving details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`
      fixed inset-y-0 right-0 w-[400px] bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 border-l border-slate-200 flex flex-col
      ${isOpen ? "translate-x-0" : "translate-x-full"}
    `}>
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 shrink-0 bg-white">
        <h2 className="font-bold text-slate-800 text-lg">Customer Details</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition"><X size={20} /></button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar bg-slate-50/50">

        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-full flex items-center justify-center text-3xl font-bold text-emerald-700 shadow-sm border-4 border-white">
            {formData.name ? formData.name.charAt(0).toUpperCase() : "#"}
          </div>
          <p className="text-slate-900 font-bold text-lg mt-3">{formData.name || selectedChat?.phone}</p>

          {selectedChat?.visitCount > 1 && (
            <span className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
              <History size={12} />
              {selectedChat.visitCount} Visits (Returning)
            </span>
          )}
        </div>

        <div className="space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <InputGroup label="Full Name" name="name" value={formData.name} onChange={handleChange} icon={<User size={14} />} required />
          <div className="grid grid-cols-2 gap-4 items-end">
            <InputGroup label="City" name="city" value={formData.city} onChange={handleChange} icon={<MapPin size={14} />} />
            <InputGroup label="Address" name="address" value={formData.address} onChange={handleChange} icon={<MapPin size={14} />} placeholder="Full Address..." />
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><Globe size={12} /> Source</label>
              <select name="source" value={formData.source} onChange={handleChange} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm text-slate-700 transition-all cursor-pointer">
                {["Whatsapp", "Facebook", "Instagram", "Google", "Referral", "Direct", "Manual Entry", "Phone Call"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <InputGroup label="Enquired For" name="enquiredFor" value={formData.enquiredFor} onChange={handleChange} icon={<HelpCircle size={14} />} placeholder="e.g. Treatment" />
          
          {/* 👇 FIX: isAdsLead-ku pathila leadCategory vechu check pandrom */}
          {leadCategory && (
              <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                      <Tag size={12} /> Ad Type
                  </label>
                  <select name="adType" value={formData.adType} onChange={handleChange} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer transition-all">
                      <option value="">Select Ad Type</option>
                      <option value="productLead">Product Lead</option>
                      <option value="mdCamp">MD Camp</option>
                      <option value="therapy">Therapy</option>
                  </select>
              </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} required className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer">
                <option value="New">New</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Closed">Closed</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>
            <InputGroup label="Amount (₹)" name="saleAmount" value={formData.saleAmount} onChange={handleChange} type="number" placeholder="0" icon={<DollarSign size={14} />} />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><FileText size={12} /> Overall Remarks</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none h-24 resize-none text-sm bg-slate-50 text-slate-700 placeholder:text-slate-400"
              placeholder="Add general notes about the customer..."
            />
          </div>
        </div>

        {formData.status === "Follow Up" && (
          <div className="space-y-4 bg-emerald-50/50 p-5 rounded-2xl shadow-sm border border-emerald-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-sm font-bold text-emerald-800 border-b border-emerald-200/50 pb-2 mb-2">Current Enquiry Follow-up</h3>
            <div>
              <label className="block text-xs font-bold text-emerald-700 uppercase mb-1.5 flex items-center gap-1">Day 1 Remarks</label>
              <textarea name="day1Remarks" value={formData.day1Remarks} onChange={handleChange} className="w-full px-3 py-2.5 border border-emerald-200/60 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none h-20 resize-none text-sm bg-white text-slate-700" placeholder="Notes from Day 1..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-700 uppercase mb-1.5 flex items-center gap-1">Day 2 Remarks</label>
              <textarea name="day2Remarks" value={formData.day2Remarks} onChange={handleChange} className="w-full px-3 py-2.5 border border-emerald-200/60 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none h-20 resize-none text-sm bg-white text-slate-700" placeholder="Notes from Day 2..." />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-700 uppercase mb-1.5 flex items-center gap-1">Day 3 Remarks</label>
              <textarea name="day3Remarks" value={formData.day3Remarks} onChange={handleChange} className="w-full px-3 py-2.5 border border-emerald-200/60 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none h-20 resize-none text-sm bg-white text-slate-700" placeholder="Notes from Day 3..." />
            </div>
          </div>
        )}
      </div>

      <div className="p-5 border-t border-slate-100 bg-white shrink-0">
        <button onClick={handleSave} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
          {loading ? "Saving..." : <><Save size={18} /> Save Changes</>}
        </button>
      </div>
    </div>
  );
}

function InputGroup({ label, name, value, onChange, type = "text", placeholder = "", icon, required }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
        {icon} {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input type={type} name={name} value={value} onChange={onChange} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-700 bg-slate-50 placeholder:text-slate-400 transition-all" placeholder={placeholder} required={required} />
    </div>
  );
}