"use client";
import { useState, useEffect } from "react";
import { useChatStore } from "@/store/chatStore";
import { X, User, MapPin, Globe, HelpCircle, DollarSign, FileText, Save, History, List } from "lucide-react";
import { toast } from "react-toastify";

export default function CustomerInfoPanel({ isOpen, onClose }) {
  const selectedChat = useChatStore((s) => s.selectedChat);
  const updateChatDetails = useChatStore((s) => s.updateChatDetails);

  const [loading, setLoading] = useState(false);
  const [leadHistory, setLeadHistory] = useState([]);

const [formData, setFormData] = useState({
    name: "", city: "", address: "",
    source: "Facebook", enquiredFor: "", status: "New", 
    saleAmount: "", remarks: "", day1Remarks: "", day2Remarks: "", day3Remarks: ""
});

  useEffect(() => {
    if (selectedChat) {
      setFormData({
        name: selectedChat.name || "",
        city: selectedChat.city || "",
        address: selectedChat.address || "",
        source: selectedChat.source || "Whatsapp",
        enquiredFor: selectedChat.enquiredFor || "",
        status: selectedChat.status || "New",
        saleAmount: selectedChat.saleAmount || "",
        remarks: selectedChat.remarks || selectedChat.lastClosedNote || "",
        day1Remarks: selectedChat.day1Remarks || "",
        day2Remarks: selectedChat.day2Remarks || "",
        day3Remarks: selectedChat.day3Remarks || ""
      });

      if (selectedChat.phone) {
        // Extract just the number (e.g., +91... )
        const rawPhone = selectedChat.phone.replace('whatsapp:', '');

        // Use encodeURIComponent so the '+' safely travels through the URL
        fetch(`/api/leads/${encodeURIComponent(rawPhone)}`)
          .then(res => res.json())
          .then(data => {
            if (data.success) 
              
              setLeadHistory(data.leads); // Ensure it's an array
          })
          .catch(err => console.error("Failed to fetch lead history", err));
      }
    }
  }, [selectedChat?.phone]); // Re-run when chat changes

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSave = async () => {
    if (!selectedChat) return;
    setLoading(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: selectedChat.phone,
          ...formData,
          checkDuplicates: false
        }),
      });

      if (!res.ok) throw new Error("Failed");

      // Update local store immediately
      updateChatDetails(selectedChat.phone, {
        ...formData,
        // Map interest back to store property if needed
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
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 shrink-0 bg-white">
        <h2 className="font-bold text-slate-800 text-lg">Customer Details</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-700 transition"><X size={20} /></button>
      </div>

      <div className="flex-1 p-6 overflow-y-auto space-y-6 custom-scrollbar bg-slate-50/50">

        {/* Profile Card */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-full flex items-center justify-center text-3xl font-bold text-emerald-700 shadow-sm border-4 border-white">
            {formData.name ? formData.name.charAt(0).toUpperCase() : "#"}
          </div>
          <p className="text-slate-900 font-bold text-lg mt-3">{selectedChat?.name || selectedChat?.phone}</p>

          {selectedChat?.visitCount > 1 && (
            <span className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-200">
              <History size={12} />
              {selectedChat.visitCount} Visits (Returning)
            </span>
          )}
        </div>

        {/* Main Info Form */}
        <div className="space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <InputGroup label="Full Name" name="name" value={formData.name} onChange={handleChange} icon={<User size={14} />} required />
          <div className="grid grid-cols-2 gap-4 items-end">
            <InputGroup label="City" name="city" value={formData.city} onChange={handleChange} icon={<MapPin size={14} />} />
            <InputGroup label="Address" name="address" value={formData.address} onChange={handleChange} icon={<MapPin size={14} />} placeholder="Full Address..." />
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><Globe size={12} /> Source</label>
              <select name="source" value={formData.source} onChange={handleChange} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm text-slate-700 transition-all cursor-pointer">
                {["Whatsapp", "Facebook", "Instagram", "Google", "Referral", "Direct", "Manual Entry", "Phone Call"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <InputGroup label="Enquired For" name="enquiredFor" value={formData.enquiredFor} onChange={handleChange} icon={<HelpCircle size={14} />} placeholder="e.g. Treatment" />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} required className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer">
                <option value="New">New</option>
                <option value="Follow Up">Follow Up</option>
                <option value="Closed">Closed</option>
                <option value="Not Closed">Not Closed</option>
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

        {/* Current Active Lead Daily Remarks Section */}
        <div className="space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-2">Current Enquiry Follow-up</h3>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">Day 1 Remarks</label>
            <textarea
              name="day1Remarks"
              value={formData.day1Remarks}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none h-20 resize-none text-sm bg-slate-50 text-slate-700 placeholder:text-slate-400"
              placeholder="Notes from Day 1..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">Day 2 Remarks</label>
            <textarea
              name="day2Remarks"
              value={formData.day2Remarks}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none h-20 resize-none text-sm bg-slate-50 text-slate-700 placeholder:text-slate-400"
              placeholder="Notes from Day 2..."
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">Day 3 Remarks</label>
            <textarea
              name="day3Remarks"
              value={formData.day3Remarks}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none h-20 resize-none text-sm bg-slate-50 text-slate-700 placeholder:text-slate-400"
              placeholder="Notes from Day 3..."
            />
          </div>
        </div>


        {leadHistory && leadHistory.length > 1 && (
          <div className="space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3 flex items-center gap-2">
              <List size={16} className="text-emerald-600" /> Last Closed Enquiry
            </h3>

            <div className="space-y-4">
              {leadHistory
                // 1. Keep track of the original index so "Visit X" calculates correctly
                .map((lead, index) => ({ lead, originalIndex: index }))
                // 2. Ignore the current active lead (index 0), and only keep "Closed" status
                .filter(({ lead, originalIndex }) => originalIndex !== 0 && (lead.status === 'Closed' || lead.isClosed))
                // 3. Take ONLY the first one (which is the most recent past closed lead)
                .slice(0, 1)
                .map(({ lead, originalIndex }) => (
                  <div key={lead._id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-emerald-700 text-sm">Visit {leadHistory.length - originalIndex}</span>
                      <span className="text-[10px] px-2 py-1 rounded-full font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700">
                        {lead.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <p className="text-xs text-slate-600 truncate"><strong className="text-slate-800">For:</strong> {lead.enquiredFor || "N/A"}</p>
                      <p className="text-xs text-slate-600 truncate"><strong className="text-slate-800">Assigned:</strong> {lead.assignedTo}</p>
                    </div>

                    {/* Read-only Follow Up Remarks tied to this past visit */}
                    <div className="mt-2 text-xs text-slate-700 space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-100">
                      <p className="font-bold text-slate-400 uppercase text-[10px] mb-1">Follow-up Notes</p>
                      {lead.day1Remarks ? <p><span className="font-semibold text-slate-800">Day 1:</span> {lead.day1Remarks}</p> : null}
                      {lead.day2Remarks ? <p><span className="font-semibold text-slate-800">Day 2:</span> {lead.day2Remarks}</p> : null}
                      {lead.day3Remarks ? <p><span className="font-semibold text-slate-800">Day 3:</span> {lead.day3Remarks}</p> : null}
                      {lead.remarks ? <p><span className="font-semibold text-slate-800">Remark:</span> {lead.remarks}</p> : null}

                      {!lead.day1Remarks && !lead.day2Remarks && !lead.day3Remarks && !lead.remarks && (
                        <span className="text-slate-400 italic">No remarks recorded for this visit.</span>
                      )}
                    </div>
                  </div>
                ))}
                
              {/* Fallback if they have past history but none of them are closed yet */}
              {leadHistory.filter((l, idx) => idx !== 0 && (l.status === 'Closed' || l.isClosed)).length === 0 && (
                 <p className="text-xs text-slate-400 italic text-center py-2">No previously closed enquiries found.</p>
              )}
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
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-700 bg-slate-50 placeholder:text-slate-400 transition-all"
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}