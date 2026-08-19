"use client";

import React, { useState, useRef, useEffect, useMemo, memo } from "react";
import { useTemplateStore } from "@/features/templates/stores/templateStore";
import { useCRMTemplates } from "@/features/templates/hooks/useCRMTemplates";
import { resolveTemplate } from "@/shared/utils/templateResolver";
import { useDebounce } from "@/shared/hooks/useDebounce";
import {
  Search, X, Loader2, Layers, FileText, CheckCircle2,
  Clock, AlertCircle, Variable, Send, ExternalLink, Sparkles
} from "lucide-react";

export const ChatTemplatePanel = memo(function ChatTemplatePanel({
  activeChat,
  customerContext,
  onSelectWhatsApp,
  onSelectCRM,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState("crm"); // Default to CRM or WhatsApp
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const searchInputRef = useRef(null);
  const panelRef = useRef(null);

  // 1. Data Sources
  const { templates: waTemplates = [], loading: waLoading, fetchTemplates: fetchWATemplates } = useTemplateStore();
  const { data: crmTemplates = [], isLoading: crmLoading } = useCRMTemplates({ status: "active" });

  useEffect(() => {
    fetchWATemplates();
    setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [fetchWATemplates]);

  // 2. Escape Key and Click-Outside Listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // 3. Filtered Lists
  const filteredCRMTemplates = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return crmTemplates.filter((t) => t.isActive);
    return crmTemplates.filter(
      (t) =>
        t.isActive &&
        (t.name?.toLowerCase().includes(q) ||
          t.body?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q))
    );
  }, [crmTemplates, debouncedSearch]);

  const filteredWATemplates = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim();
    if (!q) return waTemplates;
    return waTemplates.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.body?.toLowerCase().includes(q) ||
        t.whatsapp?.category?.toLowerCase().includes(q) ||
        t.sid?.toLowerCase().includes(q)
    );
  }, [waTemplates, debouncedSearch]);

  // Helper context for resolving variables dynamically in the chat
  const resolutionContext = useMemo(() => {
    return {
      customer: customerContext?.customer || activeChat || {},
      lead: customerContext?.lead || {},
      branch: customerContext?.branch || {},
      customerAddress: customerContext?.customerAddress || {},
    };
  }, [customerContext, activeChat]);

  return (
    <div
      ref={panelRef}
      className="absolute bottom-[75px] left-4 w-[calc(100vw-2rem)] sm:w-[420px] max-w-[440px] max-h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-50 animate-in zoom-in-95 fade-in duration-200 select-none origin-bottom-left"
      style={{ boxShadow: "0 20px 40px -15px rgba(0,0,0,0.18), 0 0 1px 1px rgba(0,0,0,0.06)" }}
    >
      {/* Header */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-[#00a884] flex items-center justify-center font-bold">
              <Sparkles size={15} />
            </div>
            <span className="font-bold text-sm text-slate-800 tracking-tight">Select Template</span>
          </div>

          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200/70 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Two-Tab Navigation */}
        <div className="grid grid-cols-2 p-0.5 bg-slate-200/60 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("crm")}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "crm"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText size={13} className={activeTab === "crm" ? "text-[#00a884]" : "text-slate-400"} />
            CRM Templates
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-full font-mono">
              {crmTemplates.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("whatsapp")}
            className={`py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "whatsapp"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers size={13} className={activeTab === "whatsapp" ? "text-emerald-600" : "text-slate-400"} />
            WhatsApp
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.2 rounded-full font-mono">
              {waTemplates.length}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={activeTab === "crm" ? "Search CRM templates by name, content..." : "Search WhatsApp approved templates..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200/80 rounded-xl text-xs outline-none focus:border-[#00a884] focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400 text-slate-700"
          />
        </div>
      </div>

      {/* Tab Content List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 max-h-72 custom-scrollbar bg-slate-50/30">
        {/* TAB 1: CRM TEMPLATES */}
        {activeTab === "crm" && (
          <>
            {crmLoading ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin text-[#00a884]" />
                <span className="text-xs text-slate-400 font-medium">Loading CRM templates...</span>
              </div>
            ) : filteredCRMTemplates.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center">
                <FileText size={24} className="text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No CRM templates found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {search ? `No templates match "${search}"` : "No active CRM templates created yet."}
                </p>
              </div>
            ) : (
              filteredCRMTemplates.map((tpl) => {
                const preview = resolveTemplate({
                  template: tpl,
                  ...resolutionContext,
                });
                const varCount = tpl.variables?.length || 0;

                return (
                  <button
                    key={tpl._id}
                    type="button"
                    onClick={() => {
                      onSelectCRM(tpl, preview.resolvedText);
                      onClose();
                    }}
                    className="w-full text-left p-3 bg-white hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition-all shadow-2xs group flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-xs text-slate-800 group-hover:text-emerald-800 truncate">
                          {tpl.name}
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {tpl.category || "General"}
                        </span>
                      </div>

                      {varCount > 0 && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                          <Variable size={10} /> {varCount} {varCount === 1 ? "var" : "vars"}
                        </span>
                      )}
                    </div>

                    {/* Resolved Preview snippet */}
                    <div className="text-[11px] text-slate-600 leading-relaxed font-sans line-clamp-2 bg-slate-50/70 p-2 rounded-lg border border-slate-100 group-hover:bg-white transition-colors">
                      {preview.resolvedText}
                    </div>
                  </button>
                );
              })
            )}
          </>
        )}

        {/* TAB 2: WHATSAPP APPROVED TEMPLATES */}
        {activeTab === "whatsapp" && (
          <>
            {waLoading ? (
              <div className="p-8 flex flex-col items-center justify-center gap-2">
                <Loader2 size={20} className="animate-spin text-emerald-600" />
                <span className="text-xs text-slate-400 font-medium">Fetching Twilio templates...</span>
              </div>
            ) : filteredWATemplates.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center">
                <Layers size={24} className="text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No WhatsApp templates found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {search ? `No templates match "${search}"` : "No Twilio templates available."}
                </p>
              </div>
            ) : (
              filteredWATemplates.map((tpl) => {
                const status = (tpl.whatsapp?.status || "approved").toLowerCase();
                const isApproved = status === "approved" || status === "received" || status === "pending";

                return (
                  <button
                    key={tpl._id || tpl.sid}
                    type="button"
                    onClick={() => {
                      onSelectWhatsApp(tpl);
                      onClose();
                    }}
                    className="w-full text-left p-3 bg-white hover:bg-emerald-50/60 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition-all shadow-2xs group flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-800 group-hover:text-emerald-800 truncate flex-1">
                        {tpl.name}
                      </span>

                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                          status === "approved"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 leading-relaxed font-sans line-clamp-2 bg-slate-50/70 p-2 rounded-lg border border-slate-100 group-hover:bg-white transition-colors">
                      {tpl.body}
                    </div>
                  </button>
                );
              })
            )}
          </>
        )}
      </div>
    </div>
  );
});

export default ChatTemplatePanel;
