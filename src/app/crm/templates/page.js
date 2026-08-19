"use client";

import React, { useState, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import { useCRMTemplates, useCreateCRMTemplate, useUpdateCRMTemplate, useDeleteCRMTemplate } from "@/features/templates/hooks/useCRMTemplates";
import { AVAILABLE_VARIABLE_LIST } from "@/shared/utils/templateVariables";
import { resolveTemplate } from "@/shared/utils/templateResolver";
import { toast } from "react-toastify";
import Link from "next/link";
import {
  FileText, Plus, Search, Edit3, Trash2, CheckCircle2, XCircle,
  Copy, Layers, ArrowRight, Eye, Sparkles, Variable,
  HelpCircle, RefreshCw, X, ShieldAlert, Bold, Italic, Strikethrough, Code2
} from "lucide-react";

export default function CRMTemplatesPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all");

  // Editor Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    body: "",
    category: "General",
    isActive: true,
  });

  const textareaRef = useRef(null);

  const { data: templates = [], isLoading, refetch } = useCRMTemplates();
  const createMutation = useCreateCRMTemplate();
  const updateMutation = useUpdateCRMTemplate();
  const deleteMutation = useDeleteCRMTemplate();

  const isAuthorized = session?.user?.role === "superAdmin" || session?.user?.department === "admin";

  const categories = useMemo(() => {
    const list = new Set(["All", "General", "Sales", "Support", "Follow-up"]);
    templates.forEach((t) => {
      if (t.category) list.add(t.category);
    });
    return Array.from(list);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchSearch =
        !search.trim() ||
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.body?.toLowerCase().includes(search.toLowerCase()) ||
        t.category?.toLowerCase().includes(search.toLowerCase());

      const matchCategory = selectedCategory === "All" || t.category === selectedCategory;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && t.isActive) ||
        (statusFilter === "inactive" && !t.isActive);

      return matchSearch && matchCategory && matchStatus;
    });
  }, [templates, search, selectedCategory, statusFilter]);

  // Live preview rendering for the active form
  const livePreview = useMemo(() => {
    return resolveTemplate({
      template: formData.body || "",
      useSampleData: true,
    });
  }, [formData.body]);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      body: "",
      category: "General",
      isActive: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (tpl) => {
    setEditingTemplate(tpl);
    setFormData({
      name: tpl.name || "",
      body: tpl.body || "",
      category: tpl.category || "General",
      isActive: tpl.isActive ?? true,
    });
    setIsModalOpen(true);
  };

  const handleInsertVariable = (varKey) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const placeholder = `{{${varKey}}}`;
    const newBody = formData.body.substring(0, start) + placeholder + formData.body.substring(end);

    setFormData((prev) => ({ ...prev, body: newBody }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 50);
  };

  const handleFormatText = (wrapper) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = formData.body.substring(start, end);

    let wrappedText = "";
    if (wrapper === "code") {
      wrappedText = `\`\`\`${selectedText || "monospace"}\`\`\``;
    } else {
      wrappedText = `${wrapper}${selectedText || "text"}${wrapper}`;
    }

    const newBody = formData.body.substring(0, start) + wrappedText + formData.body.substring(end);
    setFormData((prev) => ({ ...prev, body: newBody }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + wrapper.length, start + wrappedText.length - wrapper.length);
    }, 50);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      return toast.error("Template name is required");
    }
    if (!formData.body.trim()) {
      return toast.error("Template message body is required");
    }

    try {
      if (editingTemplate) {
        await updateMutation.mutateAsync({
          id: editingTemplate._id,
          payload: formData,
        });
        toast.success("CRM Template updated successfully!");
      } else {
        await createMutation.mutateAsync(formData);
        toast.success("CRM Template created successfully!");
      }
      setIsModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Failed to save template");
    }
  };

  const handleToggleStatus = async (tpl) => {
    try {
      await updateMutation.mutateAsync({
        id: tpl._id,
        payload: { isActive: !tpl.isActive },
      });
      toast.success(`Template ${!tpl.isActive ? "activated" : "deactivated"}`);
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async (tpl) => {
    if (!confirm(`Are you sure you want to delete template "${tpl.name}"?`)) return;

    try {
      await deleteMutation.mutateAsync(tpl._id);
      toast.success("Template deleted successfully");
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Failed to delete template");
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto custom-scrollbar select-none">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-emerald-50 text-[#00a884] border border-emerald-200 rounded-2xl flex items-center justify-center shadow-sm">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">CRM Templates</h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Internal message templates with dynamic customer variable resolution
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/crm/admin/template-manager"
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <Layers size={14} className="text-slate-500" />
              WhatsApp Templates
            </Link>

            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-[#00a884] hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Plus size={16} />
              Create CRM Template
            </button>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="max-w-7xl w-full mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Status Controls */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#00a884] focus:ring-2 focus:ring-emerald-500/10 transition-all text-slate-700"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none focus:border-[#00a884]"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Template Grid */}
      <div className="max-w-7xl w-full mx-auto px-6 pb-12 flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 h-56 animate-pulse" />
            ))}
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white border border-slate-200 border-dashed rounded-3xl p-12 text-center flex flex-col items-center justify-center">
            <div className="w-14 h-14 bg-emerald-50 text-[#00a884] rounded-2xl flex items-center justify-center mb-3">
              <FileText size={26} />
            </div>
            <h3 className="text-base font-bold text-slate-800">No CRM Templates Found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm">
              {search || selectedCategory !== "All" || statusFilter !== "all"
                ? "No templates match your search filters. Try adjusting your search query."
                : "Create your first internal CRM message template with dynamic variables and rich WhatsApp formatting."}
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-[#00a884] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-emerald-600 transition"
            >
              Create CRM Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredTemplates.map((tpl) => {
              const preview = resolveTemplate({ template: tpl, useSampleData: true });
              const varCount = tpl.variables?.length || 0;

              return (
                <div
                  key={tpl._id}
                  className={`bg-white border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md ${
                    tpl.isActive ? "border-slate-200 hover:border-emerald-300" : "border-slate-200 opacity-75 bg-slate-50/60"
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900 truncate">{tpl.name}</h3>
                          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            v{tpl.version || 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                            {tpl.category || "General"}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Variable size={10} /> {varCount} {varCount === 1 ? "Var" : "Vars"}
                          </span>
                        </div>
                      </div>

                      {/* Active Status Badge */}
                      <button
                        onClick={() => handleToggleStatus(tpl)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border transition-colors shrink-0 ${
                          tpl.isActive
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200"
                        }`}
                        title="Click to toggle active status"
                      >
                        {tpl.isActive ? "Active" : "Inactive"}
                      </button>
                    </div>

                    {/* Preview Box */}
                    <div className="mt-3 bg-[#EFEAE2] rounded-xl p-3 relative overflow-hidden border border-slate-100 min-h-[110px] flex flex-col justify-center">
                      <div className="bg-white rounded-lg rounded-tl-none p-2.5 shadow-sm text-[12px] text-slate-800 leading-relaxed max-w-[95%] whitespace-pre-wrap">
                        {preview.resolvedText}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[11px] text-slate-400 font-medium">
                      Updated {new Date(tpl.updatedAt || tpl.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditModal(tpl)}
                        className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit Template"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(tpl)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#00a884] flex items-center justify-center">
                  <FileText size={18} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    {editingTemplate ? `Edit CRM Template (v${editingTemplate.version || 1})` : "Create CRM Template"}
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Supports native WhatsApp markdown and dynamic variable placeholders
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-xl transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body: Two Columns (Editor & Preview) */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 custom-scrollbar">
              {/* Left Column: Form Fields */}
              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Template Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Welcome Customer, Appointment Reminder"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#00a884] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 text-slate-800"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Category</label>
                    <input
                      type="text"
                      placeholder="Sales, Support, Follow-up"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#00a884] focus:bg-white text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1.5">Status</label>
                    <select
                      value={formData.isActive ? "active" : "inactive"}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.value === "active" })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-[#00a884] text-slate-800"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Message Body with WhatsApp Formatting Toolbar */}
                <div className="flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Message Body <span className="text-rose-500">*</span>
                    </label>

                    {/* WhatsApp Syntax Formatting Toolbar */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleFormatText("*")}
                        className="p-1 hover:bg-white rounded text-slate-700 transition"
                        title="Bold (*text*)"
                      >
                        <Bold size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormatText("_")}
                        className="p-1 hover:bg-white rounded text-slate-700 transition"
                        title="Italic (_text_)"
                      >
                        <Italic size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormatText("~")}
                        className="p-1 hover:bg-white rounded text-slate-700 transition"
                        title="Strikethrough (~text~)"
                      >
                        <Strikethrough size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFormatText("code")}
                        className="p-1 hover:bg-white rounded text-slate-700 transition"
                        title="Monospace (```text```)"
                      >
                        <Code2 size={13} />
                      </button>
                    </div>
                  </div>

                  <textarea
                    ref={textareaRef}
                    required
                    rows={7}
                    placeholder="Hi *{{name}}* 👋&#10;&#10;Welcome to Almaa Herbal Nature. Our {{branchName}} team will reach out to you shortly."
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-[#00a884] focus:bg-white focus:ring-2 focus:ring-emerald-500/10 text-slate-800 resize-none font-sans leading-relaxed"
                  />
                </div>

                {/* Variable Chips */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Variable size={12} className="text-emerald-600" />
                      Insert Variables (Click to Add)
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {AVAILABLE_VARIABLE_LIST.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => handleInsertVariable(v.key)}
                        className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 rounded-lg text-xs font-semibold transition-all shadow-2xs flex items-center gap-1"
                      >
                        <span>{`{{${v.key}}}`}</span>
                        <span className="text-[10px] text-slate-400">({v.label})</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Realtime WhatsApp Bubble Preview */}
              <div className="flex flex-col">
                <div className="text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Eye size={14} className="text-emerald-600" /> Live WhatsApp Preview
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Rendered with sample data</span>
                </div>

                <div className="bg-[#EFEAE2] border border-slate-200 rounded-2xl p-5 flex-1 flex flex-col justify-start relative overflow-hidden shadow-inner">
                  {/* WhatsApp chat background styling */}
                  <div
                    className="absolute inset-0 opacity-10 pointer-events-none"
                    style={{
                      backgroundImage: "radial-gradient(#000 1px, transparent 1px)",
                      backgroundSize: "20px 20px",
                    }}
                  />

                  {/* WhatsApp Message Bubble */}
                  <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-md max-w-full relative z-10 text-[13px] text-slate-800 leading-relaxed border border-slate-100">
                    <div className="whitespace-pre-wrap word-break">
                      {livePreview.resolvedText || <span className="italic text-slate-400">Preview will appear here as you type...</span>}
                    </div>

                    <div className="text-[9px] text-slate-400 text-right mt-1.5 font-medium">
                      12:30 PM ✓✓
                    </div>
                  </div>

                  {/* Variables Detected Summary */}
                  {Object.keys(livePreview.resolvedVariables).length > 0 && (
                    <div className="mt-4 bg-white/90 backdrop-blur rounded-xl p-3 border border-slate-200/80 z-10">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1.5">
                        Variables Detected ({Object.keys(livePreview.resolvedVariables).length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(livePreview.resolvedVariables).map(([k, v]) => (
                          <div key={k} className="text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono">
                            <span className="font-bold text-emerald-700">{`{{${k}}}`}</span> → "{v}"
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-5 py-2 bg-[#00a884] hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl transition shadow-sm"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingTemplate ? "Update Template" : "Save Template"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
