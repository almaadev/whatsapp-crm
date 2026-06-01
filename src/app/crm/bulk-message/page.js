"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
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
  ShieldAlert, // Added ShieldAlert for Unauthorized state
} from "lucide-react";
import { useSession } from "next-auth/react";
import TemplateManagerPanel from "@/components/features/chat/Templatemanagerpanel";
import { useTemplateStore } from "@/store/templateStore";

export default function BulkTemplatePage() {
  // 🚨 Added status to useSession to handle loading state
  const { data: session, status } = useSession();
  const userRole = session?.user?.role || "associate";
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ─── Messaging state ──────────────────────────────────────────────────────
  const [numbersText, setNumbersText] = useState("");
  const [templateId, setTemplateId] = useState(""); // internal SID
  const [selectedName, setSelectedName] = useState(""); // display label

  // ─── New Variable State ───────────────────────────────────────────────────
  const { templates, fetchTemplates } = useTemplateStore();
  const [templateVariables, setTemplateVariables] = useState({});
  const [requiredVariablesCount, setRequiredVariablesCount] = useState(0);

  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0, failed: 0 });

  // ─── Template panel state ─────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);

  // Load templates so we can analyze them for variables when selected
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleTemplateSelect = (sid, name) => {
    setTemplateId(sid || "");
    setSelectedName(name || "");

    // Reset variables when template changes
    setTemplateVariables({});
    setRequiredVariablesCount(0);

    if (sid) {
      const selectedTemplate = templates.find(
        (t) => t.sid === sid || t._id === sid,
      );
      if (selectedTemplate && selectedTemplate.body) {
        // Find highest variable number e.g. {{1}}, {{2}}
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
    setTemplateVariables((prev) => ({
      ...prev,
      [index.toString()]: value,
    }));
  };

  // ─── Bulk send logic ──────────────────────────────────────────────────────
  const handleBulkSend = async () => {
    const extracted = numbersText.match(/\d{10,15}/g) || [];
    const uniqueNumbers = [...new Set(extracted)];

    if (!uniqueNumbers.length || !templateId) {
      return toast.error("Please enter numbers and select a Template");
    }

    // Validate variables
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

    const batchSize = 50;
    for (let i = 0; i < uniqueNumbers.length; i += batchSize) {
      const batch = uniqueNumbers.slice(i, i + batchSize);
      try {
        const res = await fetch("/api/bulk-message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            numbers: batch,
            templateId,
            contentVariables:
              Object.keys(templateVariables).length > 0
                ? templateVariables
                : null,
          }),
        });
        const data = await res.json();
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
    toast.success("Campaign Completed!");
  };

  // ─── Derived values ───────────────────────────────────────────────────────
  const done = progress.sent + progress.failed;
  const pct =
    progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
  const extracted = numbersText.match(/\d{10,15}/g) || [];
  const recipientCount = [...new Set(extracted)].length;
  const canSend = !isSending && recipientCount > 0 && !!templateId;

  // ─── 🚨 Access Control Logic ──────────────────────────────────────────────
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
      <div className="flex h-[100dvh] bg-slate-50 overflow-hidden relative font-sans">
        <Sidebar
          role={userRole}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />
        <div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center">
          <ShieldAlert size={80} className="text-rose-400 mb-6" />
          <h2 className="text-3xl font-extrabold text-slate-800">
            Access Denied
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-2 max-w-md">
            You do not have permission to access the Bulk Messages module.
            Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // ─── Normal Render ────────────────────────────────────────────────────────
  return (
    <div className="flex h-[100dvh] bg-slate-50 overflow-hidden font-sans">
      <div className="flex-shrink-0 z-40">
        <Sidebar
          role={userRole}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
        <div className="p-6 md:p-10 max-w-6xl mx-auto w-full space-y-8">
          {/* Header Section */}
          <div className="flex flex-col gap-2 border-b border-slate-200 pb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full w-max text-xs font-bold uppercase tracking-wider">
              <Send size={12} />
              Twilio Campaign
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              Bulk Template Messenger
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Send templated WhatsApp messages safely at 50 numbers per batch.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* LEFT COLUMN - RECIPIENTS (7 columns wide) */}
            <div className="lg:col-span-7 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-600">
                  <Hash size={16} className="text-[#00a884]" />
                  Recipients
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  Detected
                  <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                    {recipientCount}
                  </span>
                  unique numbers
                </div>
              </div>
              <div className="p-6">
                <textarea
                  className="w-full h-[400px] p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/30 text-sm font-mono text-slate-700 leading-relaxed resize-none custom-scrollbar transition-all"
                  value={numbersText}
                  onChange={(e) => setNumbersText(e.target.value)}
                  placeholder={
                    "Paste numbers here...\n9876543210, 9988776655\n9123456789, 9000112233"
                  }
                />

                <div className="flex items-center justify-between mt-3">
                  <span className="text-[11px] font-mono text-slate-500">
                    Separated by comma, space, or newline
                  </span>
                  {numbersText && (
                    <button
                      onClick={() => setNumbersText("")}
                      className="text-xs font-mono text-slate-500 hover:text-red-500 transition-colors bg-transparent border-none cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN - CONFIG & ACTIONS (5 columns wide) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Template Selector Card */}
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-600 bg-slate-50/50">
                  <Layers size={16} className="text-[#00a884]" />
                  Message Template
                </div>

                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    {/* Selected chip / placeholder */}
                    <div
                      className={`flex-1 min-w-0 flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                        templateId
                          ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100/80 hover:border-emerald-300"
                          : "bg-slate-50 border-dashed border-slate-300 hover:bg-slate-100 hover:border-slate-400"
                      }`}
                      onClick={() => setPanelOpen(true)}
                      title={
                        templateId ? "Change template" : "Open template library"
                      }
                    >
                      {templateId ? (
                        <>
                          <div className="w-8 h-8 rounded-lg flex-shrink-0 bg-emerald-100 border border-emerald-200 flex items-center justify-center">
                            <Layers size={14} className="text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-emerald-800 truncate">
                              {selectedName}
                            </div>
                            <div className="text-[10px] font-mono text-emerald-600/70 mt-0.5">
                              Template selected
                            </div>
                          </div>
                          <button
                            className="p-1 text-emerald-500 hover:text-red-500 transition-colors flex-shrink-0 bg-transparent border-none cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTemplateSelect(null, null);
                            }}
                            title="Clear selection"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 text-sm font-semibold text-slate-500 px-2">
                            No template selected
                          </div>
                          <ChevronRight size={16} className="text-slate-400" />
                        </>
                      )}
                    </div>

                    {/* Open library button */}
                    <button
                      className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold transition-colors hover:bg-slate-100 flex-shrink-0"
                      onClick={() => setPanelOpen(true)}
                    >
                      <Layers size={14} />
                      Library
                    </button>
                  </div>

                  {/* --- Variable Input Area --- */}
                  {requiredVariablesCount > 0 && (
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Type size={14} className="text-blue-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
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
                              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                          </div>
                        ))}
                        <p className="text-[10px] text-slate-500 leading-tight">
                          Note: These variables will be identical for every
                          recipient in this bulk broadcast.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm">
                  <span className="text-2xl font-bold text-slate-800 leading-none mb-1">
                    {recipientCount}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Total
                  </span>
                </div>
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm">
                  <span className="text-2xl font-bold text-emerald-600 leading-none mb-1">
                    {progress.sent}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70">
                    Sent
                  </span>
                </div>
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col items-center justify-center shadow-sm">
                  <span className="text-2xl font-bold text-red-500 leading-none mb-1">
                    {progress.failed}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600/70">
                    Failed
                  </span>
                </div>
              </div>

              {/* Progress Card */}
              {(isSending || progress.total > 0) && (
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      {isSending && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      )}
                      {isSending ? "Broadcasting..." : "Campaign Complete"}
                    </span>
                    <span className="text-sm font-bold text-[#00a884] font-mono">
                      {pct}%
                    </span>
                  </div>

                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${!isSending && pct === 100 ? "bg-[#059669]" : "bg-gradient-to-r from-emerald-400 to-[#00a884]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5 text-emerald-600">
                        <CheckCircle2 size={14} /> {progress.sent} Delivered
                      </span>
                      <span className="flex items-center gap-1.5 text-red-500">
                        <AlertCircle size={14} /> {progress.failed} Failed
                      </span>
                    </div>
                    <span className="font-mono text-slate-400">
                      {done} / {progress.total}
                    </span>
                  </div>
                </div>
              )}

              <hr className="border-slate-200 my-1" />

              {/* Action Button */}
              <button
                onClick={handleBulkSend}
                disabled={!canSend}
                className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md mt-auto
                                    ${
                                      !canSend
                                        ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                        : "bg-[#00a884] text-white hover:bg-emerald-600 hover:shadow-lg active:scale-[0.98]"
                                    }`}
              >
                {isSending ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Batch{" "}
                    {Math.min(
                      Math.ceil((done + 1) / 50),
                      Math.ceil(progress.total / 50),
                    )}{" "}
                    of {Math.ceil(progress.total / 50)}...
                  </>
                ) : (
                  <>
                    <Send size={18} /> Launch Campaign
                  </>
                )}
              </button>

              <p className="text-center text-[11px] font-semibold text-slate-400 tracking-wide uppercase">
                Processed in Batches of 50 · Twilio Content API
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Template Manager Drawer ── */}
      <TemplateManagerPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        selectedId={templateId}
        onSelect={(sid, name) => {
          handleTemplateSelect(sid, name);
          if (sid) setPanelOpen(false);
        }}
      />
    </div>
  );
}
