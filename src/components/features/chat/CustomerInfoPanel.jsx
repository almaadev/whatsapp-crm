"use client";
import { useState, useEffect, useMemo } from "react";
import { useChatStore } from "@/stores/chatStore";
import {
  X, User, MapPin, Globe, HelpCircle, DollarSign, FileText,
  Save, History, Tag, ChevronDown, ChevronUp, Clock, BadgeCheck,
  AlertCircle, RefreshCw, Filter
} from "lucide-react";
import { toast } from "react-toastify";
import api from "@/lib/axios";

//  STATUS CONFIG  (colour + icon per status value)
const STATUS_CONFIG = {
  "New":            { color: "blue",    icon: <AlertCircle  size={11} /> },
  "Follow Up":      { color: "amber",   icon: <Clock        size={11} /> },
  "Closed":         { color: "emerald", icon: <BadgeCheck   size={11} /> },
  "Not Interested": { color: "slate",   icon: <X            size={11} /> },
};

const STATUS_BADGE = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["New"];
  const cls = {
    blue:   "bg-blue-50   text-blue-700   border-blue-200",
    amber:  "bg-amber-50  text-amber-700  border-amber-200",
    emerald:"bg-emerald-50 text-emerald-700 border-emerald-200",
    slate:  "bg-slate-100 text-slate-600  border-slate-200",
  }[cfg.color];

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}>
      {cfg.icon} {status}
    </span>
  );
};

//  EMPTY FORM STATE
const EMPTY_FORM = {
  name: "", city: "", address: "",
  source: "Whatsapp", enquiredFor: "", status: "New",
  priority: "Medium", saleAmount: "", remarks: "",
  day1Remarks: "", day2Remarks: "", day3Remarks: "",
  leadType: "Direct Lead", adType: "",
};

//  COMPONENT
export default function CustomerInfoPanel({
  isOpen, onClose, activeChat = null,
}) {
  const globalSelectedChat = useChatStore((s) => s.selectedChat);
  const updateChatDetails  = useChatStore((s) => s.updateChatDetails);

  const selectedChat = activeChat || globalSelectedChat;

  const [loading,        setLoading]       = useState(false);
  const [leadData,       setLeadData]      = useState(null); 
  const [followUps,      setFollowUps]     = useState([]);   
  const [showHistory,    setShowHistory]   = useState(false);
  const [formData,       setFormData]      = useState(EMPTY_FORM);
  const [historyFilter,  setHistoryFilter] = useState("All"); 

  //   Derived Values (Memoized for Performance) 
  const latestFollowUp = useMemo(() => {
    return followUps.length > 0 ? followUps[followUps.length - 1] : null;
  }, [followUps]);

  const uniqueAssociates = useMemo(() => {
    return [...new Set(followUps.map(f => f.associateName).filter(Boolean))];
  }, [followUps]);

  //   THE FIX: Filter History & Cycle Counts
  const { filteredHistory, closedCycleCount } = useMemo(() => {
    // 1. Remove 'New' and 'Not Interested' to clean up the timeline
    let validHistory = followUps.filter(f => f.status !== "New" && f.status !== "Not Interested");
    
    // 2. Count ONLY 'Closed' statuses for the cycle badge metric
    const closedCount = followUps.filter(f => f.status === "Closed").length;

    // 3. Apply the Associate dropdown filter if selected
    if (historyFilter !== "All") {
        validHistory = validHistory.filter(f => f.associateName === historyFilter);
    }
    
    return { filteredHistory: validHistory, closedCycleCount: closedCount };
  }, [followUps, historyFilter]);

  //   Fetch lead data directly from Unified API 
  useEffect(() => {
    const phoneToFetch = activeChat?.phone || selectedChat?.phone;
    
    if (isOpen && phoneToFetch) {
      setLoading(true);
      api.get(`/api/leads/${encodeURIComponent(phoneToFetch)}`)
        .then(({ data }) => {
          if (!data || Object.keys(data).length === 0) return;
          
          setLeadData(data);
          const fetchedLeads = data.history || [];
          setFollowUps(fetchedLeads);
          const latest = fetchedLeads.length > 0 ? fetchedLeads[fetchedLeads.length - 1] : {};
          
          const initialFormData = {
            name: data.name || activeChat?.name || "",
            city: data.city || activeChat?.city || "",
            address: data.address || activeChat?.address || "",
            source: data.source || "Whatsapp",
            enquiredFor: latest.enquiredFor ?? "",
            status: latest.status?.trim() || "",
            priority: latest.priority || "Medium",
            remarks: latest.overAllRemarks || data.remarks || "",
            day1Remarks: latest.day1Remarks ?? "",
            day2Remarks: latest.day2Remarks ?? "",
            day3Remarks: latest.day3Remarks ?? "",
            saleAmount: latest.saleAmount || "0",
            leadType: latest.leadType || "Direct Lead",
            adType: data.adType || "",
          };

          setFormData(initialFormData);
          setTimeout(() => { setFormData(prev => ({ ...prev })); }, 0);
        })
        .catch((err) => console.error("Info Panel Fetch Error:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, activeChat, selectedChat]);
   
  //   Form handlers 
  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSave = async () => {
    if (!selectedChat) return;
    if (!formData.name?.trim()) {
      toast.error("Full name is required.");
      return;
    }

    let normalizedPhone = selectedChat.phone.trim();
    if (!normalizedPhone.startsWith("whatsapp:")) {
      normalizedPhone = `whatsapp:${normalizedPhone}`;
    }

    const payload = {
      phone: normalizedPhone,
      name: formData.name,
      city: formData.city,
      address: formData.address,
      source: formData.source,
      enquiredFor: formData.enquiredFor,
      status: formData.status,
      priority: formData.priority,
      saleAmount: formData.saleAmount,
      leadType: formData.leadType,
      adType: formData.adType,
      overAllRemarks: formData.remarks, 
      day1Remarks: formData.day1Remarks,
      day2Remarks: formData.day2Remarks,
      day3Remarks: formData.day3Remarks,
      date: new Date().toISOString(), 
    };

    setLoading(true);
    try {
      const { data } = await api.post("/api/leads", payload);
      
      updateChatDetails(selectedChat.phone, {
        ...formData,
        interest: formData.enquiredFor,
      });

      if (data.lead) {
        setLeadData(data.lead);
        setFollowUps(data.lead.leads || []);
      }

      const actionMsg = {
        created:          "New lead created!",
        updated_followup: "Follow-up updated!",
        updated_metadata: "Details saved!",
        new_cycle:        "New follow-up cycle started!",
        pushed_new_entry: "New status logged!",
        updated_existing_entry: "Details updated!"
      }[data.action] ?? "Saved successfully!";

      toast.success(actionMsg);
      onClose();
    } catch (error) {
      console.error("Catch Block Error:", error);
      toast.error(error.message || "Error saving details.");
    } finally {
      setLoading(false);
    }
  };

  const showDayWiseRemarks = 
    formData.status === "Follow Up" ||
    formData.day1Remarks ||
    formData.day2Remarks ||
    formData.day3Remarks;

  return (
    <div className={`
      absolute inset-y-0 right-0 w-[420px] bg-white shadow-2xl transform transition-transform
      duration-300 ease-in-out z-[60] border-l border-slate-200 flex flex-col
      ${isOpen ? "translate-x-0" : "translate-x-full"}
    `}>
      {/* 🚀 FIX: Ensure Header shows completely with a visible Close Button */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100 shrink-0 bg-white">
        <h2 className="font-bold text-slate-800 text-lg">Customer Details</h2>
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-colors">
          <X size={16} /> Close
        </button>
      </div>

      {/*   Scrollable body   */}
      <div className="flex-1 p-6 overflow-y-auto space-y-5 custom-scrollbar bg-slate-50/50">
        {/* Avatar + name */}
        <div className="flex flex-col items-center relative">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-200 rounded-full flex items-center justify-center text-3xl font-bold text-emerald-700 shadow-sm border-4 border-white">
            {formData.name ? formData.name.charAt(0).toUpperCase() : "#"}
          </div>
          <p className="text-slate-900 font-bold text-lg mt-3">
            {formData.name || selectedChat?.phone}
          </p>
          
          {closedCycleCount > 0 && (
            <span className="mt-1 flex items-center gap-1 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <History size={12} />
              {closedCycleCount} Closed {closedCycleCount === 1 ? "Cycle" : "Cycles"}
            </span>
          )}

          {/* Explicit Lead Closure Attribution */}
          {leadData?.isClosed && (
            <div className="mt-4 w-full bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-center">
              <span className="text-[13px] font-bold text-emerald-800 flex items-center justify-center gap-1.5 mb-1">
                <BadgeCheck size={16} className="text-emerald-500" /> Lead Closed
              </span>
              {leadData.closedBy && (
                <p className="text-[11px] text-emerald-600 font-medium">
                  by <span className="font-bold">{leadData.closedBy}</span> on {new Date(leadData.closedAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          )}
        </div>

        {/*   Core fields card   */}
        <div className="space-y-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
          <InputGroup label="Full Name" name="name" value={formData.name}
            onChange={handleChange} icon={<User size={14} />} required />

          <div className="grid grid-cols-2 gap-4">
            <InputGroup label="City" name="city" value={formData.city}
              onChange={handleChange} icon={<MapPin size={14} />} />
            <InputGroup label="Address" name="address" value={formData.address}
              onChange={handleChange} icon={<MapPin size={14} />} placeholder="Full address..." />
          </div>

          <SelectGroup label="Source" name="source" value={formData.source}
            onChange={handleChange} icon={<Globe size={14} />}
            options={["Whatsapp","Facebook","Instagram","Google","Referral","Direct","Manual Entry","Phone Call"]} />

          <InputGroup label="Enquired For" name="enquiredFor" value={formData.enquiredFor}
            onChange={handleChange} icon={<HelpCircle size={14} />} placeholder="e.g. Treatment" />

          <SelectGroup label="Lead Type" name="leadType" value={formData.leadType}
            onChange={handleChange} icon={<Tag size={14} />}
            options={["Direct Lead","Product Lead","MD Camp","Therapy"]} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Status</label>
              <select name="status" value={formData.status} onChange={handleChange}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer">
                {formData.status === "New" && <option value="New">New</option>}
                <option value="Follow Up">Follow Up</option>
                <option value="Closed">Closed</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Priority</label>
              <select name="priority" value={formData.priority} onChange={handleChange}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm font-medium text-slate-700 cursor-pointer">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          <InputGroup label="Amount (₹)" name="saleAmount" value={formData.saleAmount}
            onChange={handleChange} type="number" placeholder="0" icon={<DollarSign size={14} />} />

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
              <FileText size={12} /> Overall Remarks
            </label>
            <textarea name="remarks" value={formData.remarks} onChange={handleChange}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none h-24 resize-none text-sm bg-slate-50 text-slate-700 placeholder:text-slate-400"
              placeholder="Add general notes about the customer..." />
          </div>
        </div>

        {/*   Day-wise follow-up   */}
        {showDayWiseRemarks && (
          <div className="space-y-4 bg-emerald-50/50 p-5 rounded-2xl shadow-sm border border-emerald-100 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-sm font-bold text-emerald-800 border-b border-emerald-200/50 pb-2">
              Current Enquiry Follow-up
            </h3>
            {["day1Remarks","day2Remarks","day3Remarks"].map((field, i) => (
              <div key={field}>
                <label className="block text-xs font-bold text-emerald-700 uppercase mb-1.5">
                  Day {i + 1} Remarks
                </label>
                <textarea name={field} value={formData[field]} onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-emerald-200/60 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none h-20 resize-none text-sm bg-white text-slate-700"
                  placeholder={`Notes from Day ${i + 1}...`} />
              </div>
            ))}
          </div>
        )}

        {filteredHistory.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              <span className="flex items-center gap-2">
                <RefreshCw size={14} className="text-emerald-600" />
                Activity Timeline ({filteredHistory.length})
              </span>
              {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showHistory && (
              <div className="px-5 pb-4">
                
                {/* Associate Filter */}
                {uniqueAssociates.length > 1 && (
                  <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <Filter size={12} className="text-slate-400" />
                    <select 
                      className="text-xs border-none bg-slate-50 text-slate-600 rounded-md px-2 py-1 outline-none cursor-pointer"
                      value={historyFilter}
                      onChange={(e) => setHistoryFilter(e.target.value)}
                    >
                      <option value="All">All Associates</option>
                      {uniqueAssociates.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>
                )}

                <div className="divide-y divide-slate-100">
                  {[...filteredHistory].reverse().map((fu, idx) => (
                    <div key={fu._id || idx} className="py-4 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">
                           Entry {filteredHistory.length - idx}
                        </span>
                        <STATUS_BADGE status={fu.status} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[11px] font-mono text-slate-400">
                          {fu.date ? new Date(fu.date).toLocaleString("en-IN", {
                            day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute:"2-digit"
                          }) : "-"}
                        </p>
                        {fu.associateName && (
                          <p className="text-[10px] bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-slate-600 font-medium">
                            By: {fu.associateName}
                          </p>
                        )}
                      </div>
                      
                      {fu.enquiredFor && (
                        <p className="text-xs text-slate-700 mt-2">
                          <span className="font-bold text-slate-500">Enquiry:</span> {fu.enquiredFor}
                        </p>
                      )}
                      
                      {fu.overAllRemarks && (
                        <p className="text-xs text-slate-600 italic bg-slate-50 p-2 rounded-lg mt-1 border border-slate-100">
                          "{fu.overAllRemarks}"
                        </p>
                      )}
                      
                      {fu.day1Remarks && <p className="text-xs text-slate-600 mt-1"><span className="font-semibold text-emerald-700">Day 1:</span> {fu.day1Remarks}</p>}
                      {fu.day2Remarks && <p className="text-xs text-slate-600 mt-1"><span className="font-semibold text-emerald-700">Day 2:</span> {fu.day2Remarks}</p>}
                      {fu.day3Remarks && <p className="text-xs text-slate-600 mt-1"><span className="font-semibold text-emerald-700">Day 3:</span> {fu.day3Remarks}</p>}
                      
                      {fu.saleAmount && fu.saleAmount !== "0" && (
                        <p className="text-xs text-emerald-700 font-bold mt-1">₹ {fu.saleAmount}</p>
                      )}
                    </div>
                  ))}
                  {filteredHistory.length === 0 && (
                    <p className="text-xs text-center text-slate-400 py-4">No activities found for this filter.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-5 border-t border-slate-100 bg-white shrink-0">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-[#00a884] hover:bg-emerald-600 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200/50 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <RefreshCw size={16} className="animate-spin" /> Syncing Database...
            </span>
          ) : (
            <><Save size={18} /> Sync Lead Data</>
          )}
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
        type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder} required={required}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-700 bg-slate-50 placeholder:text-slate-400 transition-all"
      />
    </div>
  );
}

function SelectGroup({ label, name, value, onChange, icon, options }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1">
        {icon} {label}
      </label>
      <select
        name={name} value={value} onChange={onChange}
        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm text-slate-700 transition-all cursor-pointer"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}