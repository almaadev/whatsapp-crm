"use client";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";

import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import {
  Send,
  Hash,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronRight,
  X,
  Type,
  Menu,
  History,
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useAuth } from "@/shared/hooks/useAuth";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import { bulkMessageRepository } from "@/shared/api/repositories/bulkMessageRepository";
import TemplateManagerPanel from "@/features/templates/components/TemplateManagerPanel";
import { useTemplateStore } from "@/features/templates/stores/templateStore";

export default function BulkTemplatePage() {
  const { setMobileOpen } = useCrmLayout();
  const { data: session, status } = useSession();
  const { user, isLoading, hasModuleAccess, isSuperAdmin } = useAuth();

  const [campaignName, setCampaignName] = useState("");
  const [campaigns, setCampaigns] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const campaignsPerPage = 5;

  const [numbersText, setNumbersText] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [selectedName, setSelectedName] = useState("");

  const { templates, fetchTemplates } = useTemplateStore();
  const [templateVariables, setTemplateVariables] = useState({});
  const [requiredVariablesCount, setRequiredVariablesCount] = useState(0);

  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0, failed: 0 });
  const [panelOpen, setPanelOpen] = useState(false);

  // Accordion & State Refs
  const [expandedCampaign, setExpandedCampaign] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const formRef = useRef(null);

  const [availableNumbers, setAvailableNumbers] = useState([]);
  const [selectedSender, setSelectedSender] = useState("");

  useEffect(() => {
    fetchTemplates();
    fetchCampaigns();

    // Fetch Twilio Numbers available to the user
    fetch("/api/admin/twilio")
      .then((res) => res.json())
      .then((data) => {
        if (data?.numbers && Array.isArray(data.numbers)) {
          setAvailableNumbers(data.numbers);
          if (data.numbers.length > 0) {
            setSelectedSender(data.numbers[0].phoneNumber);
          }
        }
      })
      .catch((err) => console.error("Failed to load Twilio senders:", err));
  }, [fetchTemplates]);

  const fetchCampaigns = async () => {
    try {
      const { data } = await bulkMessageRepository.getBulkMessages();
      if (data.success) {
        setCampaigns(data.campaigns);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("Failed to fetch campaigns");
    }
  };

  const handleTemplateSelect = (sid, name) => {
    setTemplateId(sid || "");
    setSelectedName(name || "");
    setTemplateVariables({});
    setRequiredVariablesCount(0);

    if (sid) {
      const selectedTemplate = templates.find(
        (t) => t.sid === sid || t._id === sid,
      );
      if (selectedTemplate && selectedTemplate.body) {
        const matches = selectedTemplate.body.match(/\{\{(\d+)\}\}/g);
        if (matches) {
          let highestVar = 0;
          matches.forEach((match) => {
            const num = parseInt(match.replace(/[{}]/g, ""));
            if (num > highestVar) highestVar = num;
          });
          setRequiredVariablesCount(highestVar);
        }
      }
    }
  };

  const handleVariableChange = (index, value) => {
    setTemplateVariables((prev) => ({ ...prev, [index.toString()]: value }));
  };

  const handleBulkSend = async () => {
    const extracted = numbersText.match(/\d{10,15}/g) || [];
    const uniqueNumbers = [...new Set(extracted)];

    if (!campaignName.trim())
      return toast.error("Please enter a Campaign Name");
    if (!uniqueNumbers.length || !templateId)
      return toast.error("Please enter numbers and select a Template");

    if (requiredVariablesCount > 0) {
      for (let i = 1; i <= requiredVariablesCount; i++) {
        if (
          !templateVariables[i.toString()] ||
          templateVariables[i.toString()].trim() === ""
        ) {
          return toast.error(`Please fill in Variable {{${i}}}`);
        }
      }
    }

    setIsSending(true);
    setProgress({ sent: 0, total: uniqueNumbers.length, failed: 0 });

    let totalSkipped = 0;
    let currentCampaignId = null;

    const batchSize = 50;
    for (let i = 0; i < uniqueNumbers.length; i += batchSize) {
      const batch = uniqueNumbers.slice(i, i + batchSize);
      try {
        const { data } = await bulkMessageRepository.createBulkMessage({
          campaignName,
          campaignId: currentCampaignId,
          numbers: batch,
          templateId,
          senderNumber: selectedSender,
          contentVariables:
            Object.keys(templateVariables).length > 0
              ? templateVariables
              : null,
        });

        if (data.success && data.campaignId) {
          currentCampaignId = data.campaignId;
          if (data.skippedCount) totalSkipped += data.skippedCount;
        }

        setProgress((prev) => ({
          ...prev,
          sent: prev.sent + (data.successCount || 0),
          failed:
            prev.failed +
            (data.failedCount || batch.length - (data.successCount || 0)),
        }));
      } catch {
        setProgress((prev) => ({
          ...prev,
          failed: prev.failed + batch.length,
        }));
      }
    }

    setIsSending(false);
    fetchCampaigns();

    if (totalSkipped > 0) {
      toast.success(
        `Campaign Completed! Skipped ${totalSkipped} opted-out numbers.`,
      );
    } else {
      toast.success("Campaign Completed successfully!");
    }
  };

  const handleRecallCampaign = (campaign) => {
    const validNumbers =
      campaign.successfulRecipients || campaign.recipients || [];
    const failedCount = campaign.failedSends || 0;

    if (validNumbers.length === 0) {
      return toast.warning(
        "No successful numbers found in this campaign to recall.",
      );
    }

    const confirmMsg = `Load ${validNumbers.length} successful numbers into a new campaign?\n\n(${failedCount} failed/undelivered numbers have been automatically excluded.)`;

    if (window.confirm(confirmMsg)) {
      const cleanNumbers = validNumbers.map((num) =>
        num.replace(/whatsapp:\+91/g, "").replace(/whatsapp:/g, ""),
      );
      setNumbersText(cleanNumbers.join(",\n"));
      toast.success("Numbers loaded successfully!");

      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const handleDeleteCampaign = async (id, name) => {
    const confirmMsg = `Are you sure you want to permanently delete the history for "${name}"?\n\nNote: This only removes the log from this dashboard. It does NOT un-send the messages from Twilio.`;

    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(id);
    try {
      const { data } = await bulkMessageRepository.deleteBulkMessage(id);

      if (data.success) {
        toast.success("Campaign history deleted");
        setCampaigns((prev) => prev.filter((c) => c._id !== id));
        if (expandedCampaign === id) setExpandedCampaign(null);
      } else {
        toast.error(data.error || "Failed to delete campaign");
      }
    } catch (err) {
      toast.error("An error occurred while deleting.");
    } finally {
      setIsDeleting(null);
    }
  };

  const done = progress.sent + progress.failed;
  const pct =
    progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
  const extracted = numbersText.match(/\d{10,15}/g) || [];
  const recipientCount = [...new Set(extracted)].length;

  const canSend =
    !isSending && recipientCount > 0 && !!templateId && !!campaignName.trim() && availableNumbers.length > 0;

  const totalPages = Math.ceil(campaigns.length / campaignsPerPage);
  const indexOfLastCampaign = currentPage * campaignsPerPage;
  const indexOfFirstCampaign = indexOfLastCampaign - campaignsPerPage;
  const currentCampaigns = campaigns.slice(indexOfFirstCampaign, indexOfLastCampaign);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm">
        <Loader2 className="animate-spin mr-2" size={20} /> Verifying Access...
      </div>
    );
  }

  const hasBulkAccess = hasModuleAccess("Bulk Messages");

  if (!hasBulkAccess) {
    return (
      <AccessDenied message="You do not have permission to access Bulk Messages." />
    );
  }

  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[#f8fafc]">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-6 lg:p-8 w-full max-w-none">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* LEFT MAIN PANEL: CAMPAIGN BUILDER */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-start gap-4 border-b border-slate-200/60 pb-6 mb-2">
                  <button
                    onClick={() => setMobileOpen(true)}
                    className="md:hidden mt-1 flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
                  >
                    <Menu size={20} />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-xs font-black uppercase tracking-[0.2em] text-[#00a884] bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md w-max">
                      Almaa Campaign
                    </span>
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight leading-none mt-2">
                      Bulk Template Messenger
                    </h1>
                    <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-2">
                      Send templated WhatsApp messages safely with auto opt-out filtering.
                    </p>
                  </div>
                </div>

                {/* Sub-grid: Left Form and Right Config */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                                    {/* Sub-column 2: Campaign Profile & Message Template */}
                  <div className="md:col-span-5 flex flex-col gap-5">
                    {/* Campaign Profile */}
                    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-200/60 overflow-hidden hover:border-slate-300 transition-all duration-300">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600 bg-slate-50/40">
                        <Type size={18} className="text-[#00a884]" /> Campaign Profile
                      </div>
                      <div className="p-5 flex flex-col gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                            Campaign Name
                          </label>
                          <input
                            type="text"
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
                            placeholder="e.g. Summer Sale 2026"
                            className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-[#00a884]/10 text-sm font-bold transition-all shadow-inner"
                          />
                        </div>

                        {/* Outbound Sender Number Control */}
                        {(() => {
                          const isSuperAdminUser = session?.user?.role === "superAdmin";
                          const isAdminUser = session?.user?.department === "admin" || session?.user?.role === "admin";
                          const isAssociateUser = !isSuperAdminUser && !isAdminUser;

                          if (availableNumbers.length === 0) {
                            return (
                              <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                                  Outgoing Business Sender Number
                                </label>
                                <div className="w-full bg-rose-50 border border-rose-200 rounded-2xl px-4 py-3 text-xs font-bold text-rose-700 select-none">
                                  No WhatsApp sender assigned. Contact administrator.
                                </div>
                              </div>
                            );
                          }

                          if (isAssociateUser && availableNumbers.length === 1) {
                            const assignedDoc = availableNumbers[0];
                            return (
                              <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                                  Assigned Outgoing Business Sender
                                </label>
                                <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-800 flex items-center gap-2 select-none">
                                  <Send size={12} className="text-emerald-600 shrink-0" />
                                  <span className="truncate">
                                    {assignedDoc.friendlyName} ({assignedDoc.phoneNumber})
                                  </span>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                                Outgoing Business Sender Number ({isSuperAdminUser ? "Super Admin" : isAdminUser ? "Admin Senders" : "Your Assigned Senders"})
                              </label>
                              <select
                                value={selectedSender}
                                onChange={(e) => setSelectedSender(e.target.value)}
                                className="w-full bg-slate-50/50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-[#00a884] focus:ring-4 focus:ring-[#00a884]/10 text-xs font-bold transition-all cursor-pointer"
                              >
                                {availableNumbers.map((num) => (
                                  <option key={num._id || num.phoneNumber} value={num.phoneNumber}>
                                    {num.friendlyName} ({num.phoneNumber})
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Message Template */}
                    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-200/60 overflow-hidden hover:border-slate-300 transition-all duration-300">
                      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600 bg-slate-50/40">
                        <Layers size={18} className="text-[#00a884]" /> Message Template
                      </div>
                      <div className="p-4 sm:p-5 flex flex-col gap-4">
                        <div
                          className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer ${templateId ? "bg-emerald-50/50 border-emerald-200 hover:bg-emerald-100/50 hover:border-emerald-300" : "bg-slate-50/50 border-dashed border-slate-300 hover:bg-slate-100"}`}
                          onClick={() => setPanelOpen(true)}
                        >
                          {templateId ? (
                            <>
                              <div className="w-8 h-8 rounded-lg flex-shrink-0 bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                                <Layers size={14} className="text-emerald-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs sm:text-sm font-extrabold text-emerald-800 truncate">
                                  {selectedName}
                                </div>
                              </div>
                              <button
                                className="p-1 text-emerald-500 hover:text-red-500 transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTemplateSelect(null, null);
                                }}
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <>
                              <div className="flex-1 text-xs sm:text-sm font-bold text-slate-500 px-2">
                                Select template
                              </div>
                              <ChevronRight size={16} className="text-slate-400" />
                            </>
                          )}
                        </div>

                        {requiredVariablesCount > 0 && (
                          <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-4 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 mb-3">
                              <Type size={14} className="text-blue-500" />
                              <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-slate-600">
                                Template Variables
                              </span>
                            </div>
                            <div className="space-y-3">
                              {Array.from(
                                { length: requiredVariablesCount },
                                (_, i) => i + 1,
                              ).map((num) => (
                                <div key={num} className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 text-blue-700 font-mono text-xs font-bold flex items-center justify-center shrink-0 shadow-sm">
                                    {"{"}
                                    {num}
                                    {"}"}
                                  </div>
                                  <input
                                    type="text"
                                    value={templateVariables[num.toString()] || ""}
                                    onChange={(e) =>
                                      handleVariableChange(num, e.target.value)
                                    }
                                    placeholder={`Value for variable ${num}...`}
                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all w-full shadow-sm"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Sub-column 1: Recipients, Stats, Launch */}
                  <div className="md:col-span-7 flex flex-col gap-5">
                    {/* Recipients Card */}
                    <div
                      ref={formRef}
                      className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-200/60 overflow-hidden hover:border-slate-300 transition-all duration-300"
                    >
                      <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/40">
                        <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-wider text-slate-600">
                          <Hash size={18} className="text-[#00a884]" /> Recipients
                        </div>
                        <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-500">
                          Detected{" "}
                          <span className="bg-emerald-100/80 text-emerald-800 border border-emerald-200/50 px-2.5 py-0.5 rounded-full font-mono font-bold shadow-sm">
                            {recipientCount}
                          </span>{" "}
                          unique numbers
                        </div>
                      </div>
                      <div className="p-5">
                        <textarea
                          className="w-full h-[280px] sm:h-[350px] p-5 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 text-xs sm:text-sm font-mono text-slate-700 leading-relaxed resize-none custom-scrollbar transition-all shadow-inner"
                          value={numbersText}
                          onChange={(e) => setNumbersText(e.target.value)}
                          placeholder={
                            "Paste numbers here...\n9876543210, 9988776655"
                          }
                        />
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
                            Separated by comma, space, or newline
                          </span>
                          {numbersText && (
                            <button
                              onClick={() => setNumbersText("")}
                              className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 border border-slate-200/60 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:scale-[1.02] duration-300">
                        <span className="text-2xl sm:text-3xl font-black text-slate-800 leading-none mb-1.5 font-mono">
                          {recipientCount}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Total
                        </span>
                      </div>
                      <div className="bg-gradient-to-br from-emerald-50/30 to-emerald-100/20 border border-emerald-100/80 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:scale-[1.02] duration-300">
                        <span className="text-2xl sm:text-3xl font-black text-[#00a884] leading-none mb-1.5 font-mono">
                          {progress.sent}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-emerald-600/80">
                          Sent
                        </span>
                      </div>
                      <div className="bg-gradient-to-br from-rose-50/30 to-rose-100/20 border border-rose-100/80 rounded-2xl p-4 flex flex-col items-center justify-center shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all hover:scale-[1.02] duration-300">
                        <span className="text-2xl sm:text-3xl font-black text-rose-500 leading-none mb-1.5 font-mono">
                          {progress.failed}
                        </span>
                        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-rose-500/80">
                          Failed
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar (if sending) */}
                    {(isSending || progress.total > 0) && (
                      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2">
                            {isSending && (
                              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                            {isSending ? "Broadcasting..." : "Campaign Complete"}
                          </span>
                          <span className="text-xs sm:text-sm font-bold text-[#00a884] font-mono">
                            {pct}%
                          </span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ease-out ${!isSending && pct === 100 ? "bg-[#059669]" : "bg-gradient-to-r from-emerald-400 to-[#00a884]"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] sm:text-xs font-semibold text-slate-500">
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 text-emerald-600">
                              <CheckCircle2 size={12} /> {progress.sent} Delivered
                            </span>
                            <span className="flex items-center gap-1.5 text-red-500">
                              <AlertCircle size={12} /> {progress.failed} Failed
                            </span>
                          </div>
                          <span className="font-mono text-slate-400">
                            {done} / {progress.total}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Launch Campaign Button */}
                    <button
                      onClick={handleBulkSend}
                      disabled={!canSend}
                      className={`w-full py-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-md ${!canSend ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none border border-slate-200/50" : "bg-gradient-to-r from-emerald-500 to-[#00a884] text-white hover:from-emerald-600 hover:to-[#009675] shadow-lg shadow-emerald-200/40 hover:shadow-emerald-300/40 active:scale-[0.98] hover:scale-[1.01]"}`}
                    >
                      {isSending ? (
                        <>
                          <Loader2 size={16} className="animate-spin mr-1" /> Batch{" "}
                          {Math.min(
                            Math.ceil((done + 1) / 50),
                            Math.ceil(progress.total / 50),
                          )}{" "}
                          of {Math.ceil(progress.total / 50)}...
                        </>
                      ) : (
                        <>
                          <Send size={16} className="mr-1" /> Launch Campaign
                        </>
                      )}
                    </button>
                  </div>

                </div>
              </div>

              {/* RIGHT MAIN PANEL: BROADCAST HISTORY */}
              <div className="lg:col-span-4 flex flex-col gap-6 lg:pl-8 border-t lg:border-t-0 lg:border-l border-slate-200/80 pt-6 lg:pt-0 h-full">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-black uppercase tracking-[0.1em] text-slate-700">
                    <History size={18} className="text-[#00a884]" /> Broadcast History
                  </div>
                  <span className="text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200/60 px-2 py-0.5 rounded-full">
                    {campaigns.length} Campaigns
                  </span>
                </div>
                <div className="overflow-y-auto max-h-[800px] pr-1.5 space-y-4 custom-scrollbar">
                  {campaigns.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-8 font-medium">
                      No campaigns sent yet.
                    </p>
                  ) : (
                    currentCampaigns.map((camp) => {
                      const isExpanded = expandedCampaign === camp._id;
                      const validNumbers =
                        camp.successfulRecipients || camp.recipients || [];

                      return (
                        <div
                          key={camp._id}
                          className={`border rounded-2xl transition-all duration-300 ${
                            isExpanded 
                              ? "border-[#00a884] bg-emerald-50/5 shadow-[0_8px_30px_rgb(0,168,132,0.03)]" 
                              : "border-slate-200/60 bg-white hover:border-slate-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)]"
                          }`}
                        >
                          {/* Card Header (Click to expand) */}
                          <div 
                            onClick={() => setExpandedCampaign(isExpanded ? null : camp._id)}
                            className="p-4.5 flex justify-between items-center cursor-pointer select-none"
                          >
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center gap-2 mb-1.5">
                                <h4 className="font-extrabold text-slate-800 text-[15px] truncate max-w-[180px]" title={camp.campaignName}>
                                  {camp.campaignName}
                                </h4>
                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                  camp.status === "active" || camp.status === "completed" || camp.status === "sent"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                    : "bg-amber-50 text-amber-700 border-amber-100"
                                }`}>
                                  {camp.status}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                {new Date(camp.createdAt).toLocaleDateString("en-GB", { 
                                  day: 'numeric', 
                                  month: 'short', 
                                  year: 'numeric', 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </p>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleRecallCampaign(camp)}
                                className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 px-2.5 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
                                title="Recall successful numbers"
                              >
                                <RefreshCw size={10} /> Recall
                              </button>

                              {isSuperAdmin && (
                                <button
                                  onClick={() => handleDeleteCampaign(camp._id, camp.campaignName)}
                                  disabled={isDeleting === camp._id}
                                  className="flex items-center justify-center text-rose-500 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg border border-transparent hover:border-rose-100 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  {isDeleting === camp._id ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={12} />
                                  )}
                                </button>
                              )}
                              
                              <div className="text-slate-400 pl-1.5">
                                <ChevronDown 
                                  size={16} 
                                  className={`transition-transform duration-300 ${isExpanded ? "rotate-180 text-[#00a884]" : ""}`} 
                                />
                              </div>
                            </div>
                          </div>

                          {/* Accordion Content */}
                          {isExpanded && (
                            <div className="px-4.5 pb-4.5 border-t border-slate-100 pt-4 bg-slate-50/20 rounded-b-2xl space-y-4 animate-in slide-in-from-top-2 duration-250">
                              {/* Detailed Metadata Grid */}
                              <div className="grid grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200/50 shadow-sm text-xs text-slate-600">
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Sent By</span>
                                  <span className="font-semibold text-slate-800">{camp.sentBy || "System"}</span>
                                </div>
                                <div>
                                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Template ID/SID</span>
                                  <span className="font-mono font-semibold text-slate-800 truncate block max-w-[120px]" title={camp.templateId}>
                                    {camp.templateId || "N/A"}
                                  </span>
                                </div>
                                {camp.errorMessage && (
                                  <div className="col-span-2 bg-rose-50 text-rose-700 border border-rose-100/50 p-2 rounded-lg text-[11px] font-medium mt-1">
                                    <span className="font-extrabold uppercase text-[9px] tracking-wider block mb-0.5">Error Message</span>
                                    {camp.errorMessage}
                                  </div>
                                )}
                              </div>

                              {/* Delivery Stats Summary */}
                              <div className="bg-white p-3.5 rounded-xl border border-slate-200/50 shadow-sm">
                                <span className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2.5">Delivery Status</span>
                                <div className="flex items-center justify-between text-xs font-extrabold">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-100/30 rounded-md">
                                      <Users size={12} /> {validNumbers.length} Recipient(s)
                                    </span>
                                    <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100/30 rounded-md">
                                      <CheckCircle2 size={12} /> {camp.successfulSends} Sent
                                    </span>
                                    {camp.failedSends > 0 && (
                                      <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-100/30 rounded-md">
                                        <AlertCircle size={12} /> {camp.failedSends} Failed
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[#00a884] font-mono text-sm">
                                    {((camp.successfulSends / (validNumbers.length || 1)) * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>

                              {/* Recipient Numbers Grid */}
                              <div className="bg-white p-3.5 rounded-xl border border-slate-200/50 shadow-sm">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                                  Recipient List
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                                  {validNumbers.map((num, i) => {
                                    const displayNum = num
                                      .replace(/whatsapp:\+91/g, "")
                                      .replace(/whatsapp:/g, "");
                                    return (
                                      <span
                                        key={i}
                                        className="text-[10px] font-mono bg-slate-50 text-slate-600 px-2 py-0.5 rounded border border-slate-200/50 shadow-inner"
                                      >
                                        {displayNum}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-4 mt-2">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold text-slate-500 font-mono">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shrink-0"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <TemplateManagerPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        selectedId={templateId}
        onSelect={(sid, name) => {
          handleTemplateSelect(sid, name);
          if (sid) setPanelOpen(false);
        }}
      />
    </>
  );
}
