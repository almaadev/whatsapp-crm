"use client";
import api from "@/shared/lib/axios";
import { useState, useEffect, useMemo } from "react";
import { useChatStore } from "@/features/chat/stores/chatStore";
import {
  X,
  User,
  MapPin,
  Globe,
  HelpCircle,
  DollarSign,
  FileText,
  Save,
  History,
  Tag,
  ChevronDown,
  ChevronUp,
  Clock,
  BadgeCheck,
  AlertCircle,
  RefreshCw,
  Filter,
  Lock,
  Paperclip,
  Share2,
  ToggleRight,
  Building2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { usePresenceStore } from "@/features/chat/stores/presenceStore";
import { toast } from "react-toastify";
import {
  formatEventDateTime,
  getSystemEventDetails,
} from "@/shared/utils/chatUtils";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";

function BranchSearchableSelect({ value, onChange, branches, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const selectedBranch = (branches || []).find(
    (b) => (b._id || b.id)?.toString() === value?.toString(),
  );
  const selectedLabel = selectedBranch
    ? `${selectedBranch.name} (${selectedBranch.phone || selectedBranch.code || "Branch"})`
    : "Unassigned ";

  const filteredBranches = (branches || []).filter(
    (b) =>
      (b.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.code || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.phone || "").includes(searchTerm),
  );

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm font-semibold text-slate-700 flex items-center justify-between cursor-pointer transition-all shadow-2xs"
      >
        <span className="truncate flex items-center gap-1.5 min-w-0">
          <Building2 size={14} className="text-indigo-600 shrink-0" />
          <span className="truncate">{selectedLabel}</span>
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl p-2 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95">
          <input
            type="text"
            placeholder="Search branch name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-2.5 py-1.5 mb-1.5 text-xs border border-slate-200 rounded-lg outline-none focus:border-emerald-500 font-medium"
            autoFocus
          />
          <div
            onClick={() => {
              onChange({ target: { name: "branchId", value: "" } });
              setIsOpen(false);
              setSearchTerm("");
            }}
            className={`px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors ${
              !value
                ? "bg-emerald-50 text-emerald-700 font-bold"
                : "hover:bg-slate-50 text-slate-700"
            }`}
          >
            Unassigned (Visible to All Branches)
          </div>
          {filteredBranches.map((b) => {
            const bId = (b._id || b.id)?.toString();
            const isSelected = value?.toString() === bId;
            return (
              <div
                key={bId}
                onClick={() => {
                  onChange({ target: { name: "branchId", value: bId } });
                  setIsOpen(false);
                  setSearchTerm("");
                }}
                className={`px-3 py-2 text-xs font-semibold rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                  isSelected
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <span className="truncate">
                  {b.name} ({b.phone || b.code || "Branch"})
                </span>
                {isSelected && (
                  <BadgeCheck
                    size={14}
                    className="text-emerald-600 shrink-0 ml-1"
                  />
                )}
              </div>
            );
          })}
          {filteredBranches.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400 text-center font-medium">
              No matching branches found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_CONFIG = {
  New: { color: "blue", icon: <AlertCircle size={11} /> },
  "Follow Up": { color: "amber", icon: <Clock size={11} /> },
  Closed: { color: "emerald", icon: <BadgeCheck size={11} /> },
  "Not Interested": { color: "slate", icon: <X size={11} /> },
};

const STATUS_BADGE = ({ status }) => {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["New"];
  const cls = {
    blue: "bg-blue-50   text-blue-700   border-blue-200",
    amber: "bg-amber-50  text-amber-700  border-amber-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    slate: "bg-slate-100 text-slate-600  border-slate-200",
  }[cfg.color];

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${cls}`}
    >
      {cfg.icon} {status}
    </span>
  );
};

const EMPTY_FORM = {
  name: "",
  city: "",
  address: "",
  source: "Whatsapp",
  enquiredFor: "",
  status: "New",
  priority: "Medium",
  saleAmount: "",
  remarks: "",
  day1Remarks: "",
  day2Remarks: "",
  day3Remarks: "",
  leadType: "Direct Lead",
  adType: "",
};

export default function CustomerInfoPanel({
  isOpen,
  onClose,
  activeChat = null,
}) {
  const globalSelectedChat = useChatStore((s) => s.selectedChat);
  const updateChatDetails = useChatStore((s) => s.updateChatDetails);

  const selectedChat = activeChat || globalSelectedChat;

  const { data: session } = useSession();
  const activeHandlers = usePresenceStore((s) => s.activeHandlers);
  const handler = selectedChat ? activeHandlers[selectedChat.phone] : null;
  const isLockedByOther =
    handler &&
    handler.userId !== (session?.user?.id || session?.user?.email) &&
    (!handler.lockedUntil || handler.lockedUntil > Date.now());

  const [loading, setLoading] = useState(false);
  const [leadData, setLeadData] = useState(null);
  const [followUps, setFollowUps] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [historyFilter, setHistoryFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("details"); // tabs: details, timeline, remarks, attachments

  // Derived Values
  const uniqueAssociates = useMemo(() => {
    return [...new Set(followUps.map((f) => f.associateName).filter(Boolean))];
  }, [followUps]);

  const { filteredHistory, closedCycleCount } = useMemo(() => {
    let validHistory = followUps.filter(
      (f) => f.status !== "New" && f.status !== "Not Interested",
    );
    const closedCount = followUps.filter((f) => f.status === "Closed").length;

    if (historyFilter !== "All") {
      validHistory = validHistory.filter(
        (f) => f.associateName === historyFilter,
      );
    }

    return { filteredHistory: validHistory, closedCycleCount: closedCount };
  }, [followUps, historyFilter]);

  const router = useRouter();

  const recentCycles = useMemo(() => {
    if (!followUps || followUps.length === 0) return [];
    return followUps
      .map((cycle, index) => ({
        cycleNumber: index + 1,
        ...cycle,
      }))
      .reverse()
      .slice(0, 3);
  }, [followUps]);

  const handleSeeCompleteHistory = () => {
    const phone =
      selectedChat?.phone || activeChat?.phone || leadData?.phone || "";
    const cleanPhone = phone.replace("whatsapp:", "").replace("+", "").trim();
    if (cleanPhone) {
      router.push(`/crm/leads/${encodeURIComponent(cleanPhone)}`);
    } else {
      router.push("/crm/leads");
    }
  };

  // Extract shared media attachments in conversation history
  const mediaAttachments = useMemo(() => {
    const chatHistory =
      selectedChat?.history || globalSelectedChat?.history || [];
    return chatHistory.filter((msg) => msg.mediaUrl);
  }, [selectedChat?.history, globalSelectedChat?.history]);

  const [branches, setBranches] = useState([]);

  // Fetch branches list and lead details in a unified flow to prevent race conditions
  useEffect(() => {
    const phoneToFetch = activeChat?.phone || selectedChat?.phone;

    if (isOpen && phoneToFetch) {
      setLoading(true);
      Promise.all([
        api.get("/api/branches")
          .then(({ data }) => {
            if (Array.isArray(data)) return data;
            if (data?.branches && Array.isArray(data.branches)) return data.branches;
            return [];
          })
          .catch(() => []),
        api.get(`/api/leads/${encodeURIComponent(phoneToFetch)}?scope=chat`)
          .then(({ data }) => data)
          .catch((err) => {
            console.error("Info Panel Fetch Error:", err);
            return null;
          })
      ]).then(([branchList, data]) => {
        setBranches(branchList);
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
          branchId: data.branchId || activeChat?.branchId || "",
        };

        setFormData(initialFormData);
        setTimeout(() => {
          setFormData((prev) => ({ ...prev }));
        }, 0);
      }).catch((err) => {
        console.error("Info Panel Initial Load Error:", err);
      }).finally(() => {
        setLoading(false);
      });
    }
  }, [isOpen, activeChat, selectedChat]);

  // Form handlers
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
      branchId: formData.branchId || null,
      overAllRemarks: formData.remarks,
      day1Remarks: formData.day1Remarks,
      day2Remarks: formData.day2Remarks,
      day3Remarks: formData.day3Remarks,
      date: new Date().toISOString(),
    };

    const selectedBranchObj = branches.find(
      (b) => (b.id || b._id)?.toString() === formData.branchId?.toString(),
    );
    const selectedBranchName = selectedBranchObj
      ? selectedBranchObj.name
      : "Unassigned Branch";

    setLoading(true);
    try {
      const { data } = await api.post("/api/leads", payload);

      if (formData.branchId !== undefined) {
        await api
          .put(`/api/customers/${encodeURIComponent(normalizedPhone)}`, {
            branchId: formData.branchId || null,
          })
          .catch((e) => {
            console.error("PUT Customer Branch Error:", e);
          });
      }

      updateChatDetails(selectedChat.phone, {
        ...formData,
        interest: formData.enquiredFor,
        branchId: formData.branchId,
        branchName: selectedBranchName,
      });

      if (data.lead) {
        setLeadData({
          ...data.lead,
          branchId: formData.branchId,
          branchName: selectedBranchName,
        });
        setFollowUps(data.lead.leads || []);
      }

      const actionMsg =
        {
          created: "New lead created!",
          updated_followup: "Follow-up updated!",
          updated_metadata: "Details saved!",
          new_cycle: "New follow-up cycle started!",
          pushed_new_entry: "New status logged!",
          updated_existing_entry: "Details updated!",
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

  const getTimelineIcon = (action) => {
    switch (action) {
      case "Started":
        return <Clock size={12} className="text-emerald-500" />;
      case "Closed":
        return <BadgeCheck size={12} className="text-rose-500" />;
      case "Reopened":
        return <ToggleRight size={12} className="text-blue-500" />;
      case "Assigned":
        return <User size={12} className="text-indigo-500" />;
      case "Transferred":
        return <Share2 size={12} className="text-amber-500" />;
      default:
        return <History size={12} className="text-slate-500" />;
    }
  };

  return (
    <div className="contents">
      {/* Backdrop overlay for small laptop, tablet, and mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[90] xl:hidden transition-opacity"
          onClick={onClose}
        />
      )}
      <div
        className={`
          fixed xl:static inset-y-0 right-0 h-full bg-white border-l border-slate-200 flex flex-col
          transition-all duration-300 shrink-0 z-[100] xl:z-auto shadow-2xl xl:shadow-none select-none
          ${
            isOpen
              ? "w-[100vw] sm:w-[360px] xl:w-[clamp(340px,22vw,360px)] 2xl:w-[380px] translate-x-0 opacity-100"
              : "w-0 translate-x-full opacity-0 pointer-events-none xl:w-0 xl:translate-x-0"
          }
        `}
      >
        {/* Sidebar Header */}
        <div className="border-b border-slate-100 px-5 py-4 bg-white shrink-0 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold text-slate-500 text-[10px] tracking-wider uppercase">Customer Info</h2>
            <button
              onClick={onClose}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 rounded-lg transition-colors border border-transparent"
            >
              <X size={14} /> Hide
            </button>
          </div>
          <div className="flex items-center justify-between mt-1 min-w-0">
            <h3 className="font-black text-slate-850 text-sm truncate pr-2">
              {resolveCustomerDisplayName({ name: formData.name, customer: selectedChat, history: selectedChat?.history, phone: selectedChat?.phone })}
            </h3>
            <div className="flex gap-1 shrink-0 select-none">
              {formData.status && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-150 uppercase tracking-tight">
                  {formData.status}
                </span>
              )}
              {formData.priority && (
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-indigo-50 text-indigo-705 border border-indigo-150 uppercase tracking-tight">
                  {formData.priority}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs Row */}
        <div className="flex border-b border-slate-250 border-slate-200 shrink-0 bg-white sticky top-0 z-20">
          {["details", "timeline", "remarks", "attachments"].map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-center py-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2
                ${
                  active
                    ? "text-[#00a884] border-[#00a884] bg-emerald-50/10 font-bold"
                    : "text-slate-400 border-transparent hover:text-slate-650"
                }
              `}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 custom-scrollbar bg-slate-50/40">
          {/* DETAILS TAB */}
          {activeTab === "details" && (
            <div className="space-y-4">

              {/* Form Fields Card */}
              <div className="space-y-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200/60">
                <InputGroup
                  label="Full Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  icon={<User size={12} />}
                  required
                />

                <div className="grid grid-cols-2 gap-4">
                  <InputGroup
                    label="City"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    icon={<MapPin size={12} />}
                  />
                  <InputGroup
                    label="Address"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    icon={<MapPin size={12} />}
                    placeholder="Full address..."
                  />
                </div>

                <SelectGroup
                  label="Source"
                  name="source"
                  value={formData.source}
                  onChange={handleChange}
                  icon={<Globe size={12} />}
                  options={[
                    "Whatsapp",
                    "Facebook",
                    "Instagram",
                    "Google",
                    "Referral",
                    "Direct",
                    "Manual Entry",
                    "Phone Call",
                  ]}
                />

                <InputGroup
                  label="Enquired For"
                  name="enquiredFor"
                  value={formData.enquiredFor}
                  onChange={handleChange}
                  icon={<HelpCircle size={12} />}
                  placeholder="e.g. Treatment"
                />

                <SelectGroup
                  label="Lead Type"
                  name="leadType"
                  value={formData.leadType}
                  onChange={handleChange}
                  icon={<Tag size={12} />}
                  options={[
                    "Direct Lead",
                  ]}
                />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer"
                    >
                      {formData.status === "New" && (
                        <option value="New">New</option>
                      )}
                      <option value="Follow Up">Follow Up</option>
                      <option value="Closed">Closed</option>
                      <option value="Not Interested">Not Interested</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm font-semibold text-slate-700 cursor-pointer"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Building2 size={12} /> Assigned Branch
                  </label>
                  <BranchSearchableSelect
                    value={formData.branchId}
                    onChange={handleChange}
                    branches={branches}
                    disabled={loading || isLockedByOther}
                  />
                </div>

                <InputGroup
                  label="Amount (₹)"
                  name="saleAmount"
                  value={formData.saleAmount}
                  onChange={handleChange}
                  type="number"
                  placeholder="0"
                  icon={<DollarSign size={12} />}
                />
              </div>


              {/* Lead History / Lead Cycles Widget (Last 3 Cycles) */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200/60 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <History size={13} className="text-indigo-600" /> Lead
                    History
                  </h3>
                  {recentCycles.length > 0 && (
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Last 3 Cycles
                    </span>
                  )}
                </div>

                {recentCycles.length > 0 ? (
                  <div className="space-y-2.5">
                    {recentCycles.map((cycle) => (
                      <div
                        key={cycle._id || cycle.cycleNumber}
                        className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/60 text-xs space-y-2 transition-all hover:bg-slate-50 shadow-2xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-800 text-xs">
                            Cycle #{cycle.cycleNumber}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              cycle.status === "Closed"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : cycle.status === "Follow Up"
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : cycle.status === "Not Interested"
                                    ? "bg-slate-100 text-slate-600 border-slate-200"
                                    : "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {cycle.status || "New"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
                          <div>
                            <span className="text-slate-400 font-semibold">
                              Lead Type:{" "}
                            </span>
                            <span className="font-bold text-slate-700">
                              {cycle.leadType || "Direct Lead"}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-semibold">
                              Created:{" "}
                            </span>
                            <span className="font-bold text-slate-700">
                              {cycle.date
                                ? new Date(cycle.date).toLocaleDateString(
                                    "en-GB",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    },
                                  )
                                : "N/A"}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400 font-semibold">
                              Handled By:{" "}
                            </span>
                            <span className="font-extrabold text-slate-800">
                              {cycle.associateName ||
                                leadData?.assignedTo ||
                                "Unassigned"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleSeeCompleteHistory}
                      className="w-full mt-1.5 py-2 px-3 text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50/70 hover:bg-indigo-50 rounded-xl border border-indigo-100 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      See Complete History →
                    </button>
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-2 select-none">
                    <div className="w-11 h-11 rounded-full bg-slate-100/90 text-slate-400 flex items-center justify-center border border-slate-200/50 shadow-2xs">
                      <History size={22} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-slate-700">
                        No Lead History Found
                      </p>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        This customer has no previous lead cycles.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TIMELINE TAB */}
          {activeTab === "timeline" && (
            <div className="space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">
                Audit Activity Log
              </h3>

              {/* Interactive Timeline resolved from chatHistory */}
              {leadData?.chatHistory && leadData.chatHistory.length > 0 ? (
                <div className="relative pl-5 border-l border-slate-200 space-y-5 py-2">
                  {[...leadData.chatHistory].reverse().map((audit, idx) => {
                    const evt = getSystemEventDetails(audit);
                    const formattedDate = formatEventDateTime(
                      audit.performedAt || audit.timestamp,
                    );
                    return (
                      <div key={idx} className="relative">
                        {/* Timeline bullet icon wrapper */}
                        <span className="absolute -left-[27px] top-1 bg-white p-1 rounded-full border border-slate-200 shadow-sm shrink-0">
                          {evt.icon}
                        </span>
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            {evt.title}
                          </span>
                          <span className="text-[11px] text-slate-600 mt-0.5 font-medium">
                            by{" "}
                            <strong className="font-semibold text-slate-700">
                              {evt.performedBy}
                            </strong>
                          </span>
                          {audit.notes && (
                            <span className="text-[10px] text-slate-400 italic mt-0.5">
                              "{audit.notes}"
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium mt-1">
                            {formattedDate}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                  No timeline history items found.
                </div>
              )}
            </div>
          )}

          {/* REMARKS / NOTES TAB */}
          {activeTab === "remarks" && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 flex items-center gap-1">
                    <FileText size={12} /> Overall Remarks
                  </label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none h-24 resize-none text-sm bg-slate-50 text-slate-700 placeholder:text-slate-400"
                    placeholder="Add general notes about the customer..."
                  />
                </div>
              </div>

              <div className="space-y-4 bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 shadow-sm">
                <h3 className="text-xs font-black text-emerald-800 border-b border-emerald-200/50 pb-2 uppercase tracking-wide">
                  Current Enquiry Follow-up
                </h3>
                {["day1Remarks", "day2Remarks", "day3Remarks"].map(
                  (field, i) => (
                    <div key={field}>
                      <label className="block text-[10px] font-black text-emerald-700 uppercase mb-1.5">
                        Day {i + 1} Remarks
                      </label>
                      <textarea
                        name={field}
                        value={formData[field]}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-emerald-200/60 rounded-xl focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 outline-none h-20 resize-none text-sm bg-white text-slate-700"
                        placeholder={`Notes from Day ${i + 1}...`}
                      />
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* ATTACHMENTS TAB */}
          {activeTab === "attachments" && (
            <div className="space-y-3">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">
                Conversation Files
              </h3>
              {mediaAttachments.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {mediaAttachments.map((msg, idx) => (
                    <a
                      key={idx}
                      href={msg.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 p-3 bg-white border border-slate-250 border-slate-200/80 rounded-xl hover:bg-slate-50 transition-colors shadow-sm select-none"
                    >
                      <div className="p-2 bg-slate-55 bg-slate-100 text-slate-500 rounded-lg shrink-0 border border-slate-200/60">
                        <Paperclip size={14} className="text-[#00a884]" />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col text-left">
                        <span className="text-xs font-bold text-slate-700 truncate">
                          {msg.mediaType?.includes("image")
                            ? "Image Attachment"
                            : msg.mediaType?.includes("video")
                              ? "Video Attachment"
                              : msg.mediaType?.includes("audio")
                                ? "Voice Note"
                                : "Document File"}
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold font-mono uppercase tracking-tight mt-0.5">
                          {new Date(
                            msg.timestamp || msg.createdAt,
                          ).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                  No file attachments shared in this chat.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Sync Button (only visible when details/remarks are editable) */}
        {(activeTab === "details" || activeTab === "remarks") && (
          <div className="p-5 border-t border-slate-100 bg-white shrink-0">
            <button
              onClick={handleSave}
              disabled={loading || isLockedByOther}
              className={`w-full text-white py-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center gap-2 ${
                loading || isLockedByOther
                  ? "bg-slate-400 opacity-70 cursor-not-allowed shadow-none"
                  : "bg-[#00a884] hover:bg-emerald-600 shadow-emerald-200/50"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <RefreshCw size={16} className="animate-spin" /> Syncing
                  Database...
                </span>
              ) : isLockedByOther ? (
                <span className="flex items-center gap-2">
                  <Lock size={18} /> {session?.user?.role === "superAdmin" ? `Locked by ${handler?.name ? handler.name.split(" ")[0] : "Other"}` : "Currently Active"}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save size={18} /> Sync Lead Data
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function InputGroup({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  icon,
  required,
}) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 flex items-center gap-1 tracking-wider">
        {icon} {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none text-sm text-slate-750 bg-slate-50 placeholder:text-slate-400 transition-all font-semibold"
      />
    </div>
  );
}

function SelectGroup({ label, name, value, onChange, icon, options }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 uppercase mb-1.5 flex items-center gap-1 tracking-wider">
        {icon} {label}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-slate-50 text-sm text-slate-750 font-semibold transition-all cursor-pointer"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
