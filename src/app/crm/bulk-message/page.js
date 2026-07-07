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
  ShieldAlert,
  Menu,
  History,
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { bulkMessageRepository } from "@/shared/api/repositories/bulkMessageRepository";
import TemplateManagerPanel from "@/features/templates/components/TemplateManagerPanel";
import { useTemplateStore } from "@/features/templates/stores/templateStore";

export default function BulkTemplatePage() {
  const { setMobileOpen } = useCrmLayout();
  const { data: session, status } = useSession();

  const [campaignName, setCampaignName] = useState("");
  const [campaigns, setCampaigns] = useState([]);

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

  useEffect(() => {
    fetchTemplates();
    fetchCampaigns();
  }, [fetchTemplates]);

  const fetchCampaigns = async () => {
    try {
      const { data } = await bulkMessageRepository.getBulkMessages();
      if (data.success) setCampaigns(data.campaigns);
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
    !isSending && recipientCount > 0 && !!templateId && !!campaignName.trim();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm">
        <Loader2 className="animate-spin mr-2" size={20} /> Verifying Access...
      </div>
    );
  }

  const isSuperAdmin = session?.user?.role === "superAdmin";
  const hasBulkAccess =
    isSuperAdmin || session?.user?.accessModules?.includes("Bulk Messages");

  if (!hasBulkAccess) {
    return (
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center">
          <ShieldAlert size={80} className="text-rose-400 mb-6" />
          <h2 className="text-3xl font-extrabold text-slate-800">
            Access Denied
          </h2>
        </div>
      </div>
    );
  }

  // 🚀 FIX: Wrapped everything in a Fragment to isolate the Panel from overflow-hidden constraints
  return (
    <>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-[#f8fafc]">
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
          <div className="p-4 sm:p-6 md:p-10 max-w-6xl mx-auto w-full space-y-6 sm:space-y-8">
            <div className="flex items-start gap-4 border-b border-slate-200 pb-5 sm:pb-6">
              <button
                onClick={() => setMobileOpen(true)}
                className="md:hidden mt-1 flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors shrink-0"
              >
                <Menu size={20} />
              </button>
              <div className="flex flex-col gap-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full w-max text-[10px] sm:text-xs font-bold uppercase tracking-wider">
                  <Send size={12} /> Almaa Campaign
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight leading-tight">
                  Bulk Template Messenger
                </h1>
                <p className="text-xs sm:text-sm font-medium text-slate-500">
                  Send templated WhatsApp messages safely with auto opt-out
                  filtering.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
              {/* LEFT COLUMN - RECIPIENTS */}
              <div
                ref={formRef}
                className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
              >
                <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600">
                    <Hash size={16} className="text-[#00a884]" /> Recipients
                  </div>
                  <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-slate-500">
                    Detected{" "}
                    <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      {recipientCount}
                    </span>{" "}
                    unique numbers
                  </div>
                </div>
                <div className="p-4 sm:p-6">
                  <textarea
                    className="w-full h-[300px] sm:h-[400px] p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 text-xs sm:text-sm font-mono text-slate-700 leading-relaxed resize-none custom-scrollbar transition-all"
                    value={numbersText}
                    onChange={(e) => setNumbersText(e.target.value)}
                    placeholder={
                      "Paste numbers here...\n9876543210, 9988776655"
                    }
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] sm:text-[11px] font-mono text-slate-500">
                      Separated by comma, space, or newline
                    </span>
                    {numbersText && (
                      <button
                        onClick={() => setNumbersText("")}
                        className="text-xs font-mono text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN - CONFIG & ACTIONS */}
              <div className="lg:col-span-5 flex flex-col gap-5 sm:gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-50/50">
                    <Type size={16} className="text-[#00a884]" /> Campaign
                    Profile
                  </div>
                  <div className="p-4 sm:p-6">
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g. Summer Sale 2026"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/20 text-sm font-medium transition-all"
                    />
                  </div>
                </div>

                {/* Template Selector Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-50/50">
                    <Layers size={16} className="text-[#00a884]" /> Message
                    Template
                  </div>
                  <div className="p-4 sm:p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className={`flex-1 min-w-0 flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer ${templateId ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/80 hover:border-emerald-300" : "bg-slate-50 border-dashed border-slate-300 hover:bg-slate-100"}`}
                        onClick={() => setPanelOpen(true)}
                      >
                        {templateId ? (
                          <>
                            <div className="w-8 h-8 rounded-lg flex-shrink-0 bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                              <Layers size={14} className="text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs sm:text-sm font-bold text-emerald-800 truncate">
                                {selectedName}
                              </div>
                            </div>
                            <button
                              className="p-1 text-emerald-500 hover:text-red-500 cursor-pointer"
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
                            <div className="flex-1 text-xs sm:text-sm font-semibold text-slate-500 px-2">
                              No template selected
                            </div>
                            <ChevronRight
                              size={16}
                              className="text-slate-400"
                            />
                          </>
                        )}
                      </div>
                    </div>

                    {requiredVariablesCount > 0 && (
                      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center gap-2 mb-3">
                          <Type size={14} className="text-blue-500" />
                          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-600">
                            Template Variables
                          </span>
                        </div>
                        <div className="space-y-3">
                          {Array.from(
                            { length: requiredVariablesCount },
                            (_, i) => i + 1,
                          ).map((num) => (
                            <div key={num} className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 border border-blue-200 text-blue-700 font-mono text-xs font-bold flex items-center justify-center shrink-0">
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
                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all w-full"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats & Progress UI */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center shadow-sm">
                    <span className="text-xl sm:text-2xl font-bold text-slate-800 leading-none mb-1">
                      {recipientCount}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Total
                    </span>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center shadow-sm">
                    <span className="text-xl sm:text-2xl font-bold text-emerald-600 leading-none mb-1">
                      {progress.sent}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-emerald-600/70">
                      Sent
                    </span>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 sm:p-4 flex flex-col items-center justify-center shadow-sm">
                    <span className="text-xl sm:text-2xl font-bold text-red-500 leading-none mb-1">
                      {progress.failed}
                    </span>
                    <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-red-600/70">
                      Failed
                    </span>
                  </div>
                </div>

                {(isSending || progress.total > 0) && (
                  <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-sm">
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
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-3 sm:mb-4">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ease-out ${!isSending && pct === 100 ? "bg-[#059669]" : "bg-gradient-to-r from-emerald-400 to-[#00a884]"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] sm:text-xs font-semibold text-slate-500">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <span className="flex items-center gap-1 sm:gap-1.5 text-emerald-600">
                          <CheckCircle2
                            size={12}
                            className="sm:w-3.5 sm:h-3.5"
                          />{" "}
                          {progress.sent} Delivered
                        </span>
                        <span className="flex items-center gap-1 sm:gap-1.5 text-red-500">
                          <AlertCircle
                            size={12}
                            className="sm:w-3.5 sm:h-3.5"
                          />{" "}
                          {progress.failed} Failed
                        </span>
                      </div>
                      <span className="font-mono text-slate-400">
                        {done} / {progress.total}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleBulkSend}
                  disabled={!canSend}
                  className={`w-full py-3 sm:py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md mt-auto ${!canSend ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" : "bg-[#00a884] text-white hover:bg-emerald-600 hover:shadow-lg active:scale-[0.98]"}`}
                >
                  {isSending ? (
                    <>
                      <Loader2
                        size={16}
                        className="animate-spin sm:w-[18px] sm:h-[18px]"
                      />{" "}
                      Batch{" "}
                      {Math.min(
                        Math.ceil((done + 1) / 50),
                        Math.ceil(progress.total / 50),
                      )}{" "}
                      of {Math.ceil(progress.total / 50)}...
                    </>
                  ) : (
                    <>
                      <Send size={16} className="sm:w-[18px] sm:h-[18px]" />{" "}
                      Launch Campaign
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CAMPAIGN HISTORY WITH ACCORDION & RECALL */}
            <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-50/50">
                <History size={16} className="text-blue-500" /> Broadcast
                History
              </div>
              <div className="p-4 sm:p-6 overflow-y-auto max-h-[600px] custom-scrollbar space-y-4">
                {campaigns.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">
                    No campaigns sent yet.
                  </p>
                ) : (
                  campaigns.map((camp) => {
                    const isExpanded = expandedCampaign === camp._id;
                    const validNumbers =
                      camp.successfulRecipients || camp.recipients || [];

                    return (
                      <div
                        key={camp._id}
                        className="border border-slate-100 bg-slate-50 rounded-xl p-4 transition-all hover:border-slate-200 hover:shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-extrabold text-slate-800 text-[15px]">
                            {camp.campaignName}
                          </h4>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2 py-1 rounded uppercase tracking-wider hidden sm:block">
                              {camp.status}
                            </span>
                            <button
                              onClick={() => handleRecallCampaign(camp)}
                              className="flex items-center gap-1 text-[10px] font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-2.5 py-1.5 rounded transition-colors"
                              title="Reuse successful numbers"
                            >
                              <RefreshCw size={12} />{" "}
                              <span className="hidden sm:inline">Recall</span>
                            </button>

                            {isSuperAdmin && (
                              <button
                                onClick={() =>
                                  handleDeleteCampaign(
                                    camp._id,
                                    camp.campaignName,
                                  )
                                }
                                disabled={isDeleting === camp._id}
                                className="flex items-center gap-1 text-[10px] font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 px-2.5 py-1.5 rounded transition-colors disabled:opacity-50"
                                title="Delete Campaign History"
                              >
                                {isDeleting === camp._id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-3 font-medium">
                          Sent on {new Date(camp.createdAt).toLocaleString()} by{" "}
                          {camp.sentBy}
                        </p>

                        <div className="flex flex-wrap items-center justify-between gap-4 text-[11px] font-bold text-slate-600 border-t border-slate-200/60 pt-3 mt-1">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5">
                              <Users size={14} className="text-blue-500" />{" "}
                              {validNumbers.length} Recipients
                            </span>
                            <span className="flex items-center gap-1.5">
                              <CheckCircle2
                                size={14}
                                className="text-emerald-500"
                              />{" "}
                              {camp.successfulSends} Sent
                            </span>
                            {camp.failedSends > 0 && (
                              <span className="flex items-center gap-1.5">
                                <AlertCircle
                                  size={14}
                                  className="text-rose-500"
                                />{" "}
                                {camp.failedSends} Failed
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() =>
                              setExpandedCampaign(isExpanded ? null : camp._id)
                            }
                            className="flex items-center gap-1 text-slate-400 hover:text-slate-700 transition-colors bg-white px-2 py-1 rounded border border-slate-200 shadow-sm"
                          >
                            {isExpanded ? "Hide Numbers" : "View Numbers"}
                            {isExpanded ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 p-3 bg-white border border-slate-200 rounded-lg max-h-48 overflow-y-auto custom-scrollbar animate-in slide-in-from-top-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                              Recipient List
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {validNumbers.map((num, i) => {
                                const displayNum = num
                                  .replace(/whatsapp:\+91/g, "")
                                  .replace(/whatsapp:/g, "");
                                return (
                                  <span
                                    key={i}
                                    className="text-[11px] font-mono bg-slate-50 text-slate-600 px-2 py-1 rounded border border-slate-200"
                                  >
                                    {displayNum}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🚀 FIX: Modal moved OUTSIDE the overflow-hidden relative page boundaries */}
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
