"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import { twilioTemplateService } from "@/services/twilioTemplateService";
import {
  LayoutTemplate,
  ShieldAlert,
  Loader2,
  Menu,
  CheckCircle2,
  Clock,
  MessageSquare,
  AlertCircle,
  Save,
  Image as ImageIcon,
  Link as LinkIcon,
  Trash2,
  UploadCloud,
  Bold,
  Italic,
  Strikethrough,
  Variable,
  ExternalLink,
  PhoneCall,
  FastForward,
  Database,
  RefreshCw,
  Info,
  XCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Signal,
  Wifi,
  Battery,
  MoreVertical,
  PauseCircle,
} from "lucide-react";
import Sidebar from "@/components/layout/Sidebar";

// --- NORMALIZATION LOGIC ---
const normalizeStatus = (rawStatus) => {
  if (!rawStatus) return "draft";
  const s = rawStatus.toLowerCase();
  if (s.includes("approve")) return "approved";
  if (s.includes("reject") || s.includes("fail")) return "rejected";
  if (s.includes("pend") || s.includes("submit")) return "pending";
  if (s === "paused") return "paused";
  if (s === "disabled") return "disabled";
  if (s === "received") return "received";
  return "draft";
};

export default function TemplateManager() {
  const { data: session, status } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- UI & API STATE ---
  const [templates, setTemplates] = useState([]);
  const [apiState, setApiState] = useState({ loading: true, error: null });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // --- FILTER & PAGINATION STATE ---
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    category: "UTILITY",
    name: "",
    language: "en",
    templateType: "TEXT",
    headerType: "NONE",
    headerText: "",
    body: "",
    footerText: "",
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const fileInputRef = useRef(null);
  const [buttons, setButtons] = useState([]);

  const isAuthorized =
    session?.user?.role === "superAdmin" ||
    session?.user?.department === "admin";

  // --- CENTRALIZED FETCH LOGIC ---
  const loadTemplatesFromTwilio = useCallback(async (showLoadingUI = true) => {
    if (showLoadingUI) setApiState({ loading: true, error: null });
    try {
      const data = await twilioTemplateService.getTemplates();

      const normalized = data.map((t) => ({
        ...t,
        normalizedStatus: normalizeStatus(t.whatsapp?.status),
      }));
      setTemplates(normalized);
      setApiState({ loading: false, error: null });
    } catch (err) {
      setApiState({ loading: false, error: err.message });
      toast.error("Failed to load templates from Twilio.");
    }
  }, []);

  useEffect(() => {
    if (isAuthorized && status === "authenticated")
      loadTemplatesFromTwilio(true);
  }, [isAuthorized, status, loadTemplatesFromTwilio]);

  // --- REFRESH BUTTON ---
  const handleRefresh = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const loadingId = toast.loading("Syncing live data from Twilio...");
    try {
      await loadTemplatesFromTwilio(false);
      toast.update(loadingId, {
        render: `Templates synchronized!`,
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });
    } catch (err) {
      toast.update(loadingId, {
        render: "Sync failed.",
        type: "error",
        isLoading: false,
        autoClose: 2000,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // --- CRUD LOGIC ---
  const handleDeleteTemplate = async (template) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to permanently delete "${template.name}"?`,
    );
    if (!isConfirmed) return;

    setIsDeleting(template.sid);
    const loadingId = toast.loading("Deleting template from Twilio...");

    try {
      await twilioTemplateService.deleteTemplate(template.sid);
      toast.update(loadingId, {
        render: "Template deleted successfully.",
        type: "success",
        isLoading: false,
        autoClose: 2000,
      });
      // Update UI optimistically, then fetch
      setTemplates((prev) => prev.filter((t) => t.sid !== template.sid));
      await loadTemplatesFromTwilio(false);
    } catch (err) {
      toast.update(loadingId, {
        render: err.message || "Failed to delete template.",
        type: "error",
        isLoading: false,
        autoClose: 3000,
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.body)
      return toast.warning("Name and Body are required.");
    if (formData.headerType === "MEDIA" && !imageFile)
      return toast.warning("Please upload a media image.");
    for (let b of buttons) {
      if (!b.title) return toast.warning("Please fill button titles.");
      if (b.type !== "QUICK_REPLY" && !b.value)
        return toast.warning("Please fill button URL/Phone values.");
    }

    setIsCreating(true);
    try {
      const allText = (formData.headerText || "") + " " + (formData.body || "");
      const variableMatches = allText.match(/\{\{(\d+)\}\}/g);
      const varMap = {};
      if (variableMatches) {
        [...new Set(variableMatches)].forEach((match) => {
          const num = match.replace(/[{}]/g, "");
          varMap[num] = `Variable_${num}`;
        });
      }

      const submitData = new FormData();
      submitData.append("friendly_name", formData.name);
      submitData.append("category", formData.category);
      submitData.append("language", formData.language);
      submitData.append("templateType", formData.templateType);
      submitData.append("headerType", formData.headerType);
      submitData.append("headerText", formData.headerText);
      submitData.append("body", formData.body);
      submitData.append("footerText", formData.footerText);
      submitData.append("variables", JSON.stringify(varMap));
      submitData.append("buttons", JSON.stringify(buttons));
      if (imageFile) submitData.append("image", imageFile);

      await twilioTemplateService.createTemplate(submitData);
      toast.success("Template created in Twilio successfully!");

      // Reset Form
      setFormData({
        category: "UTILITY",
        name: "",
        language: "en",
        templateType: "TEXT",
        headerType: "NONE",
        headerText: "",
        body: "",
        footerText: "",
      });
      setImageFile(null);
      setImagePreview("");
      setButtons([]);
      if (fileInputRef.current) fileInputRef.current.value = "";

      // Auto-refresh Twilio data
      await loadTemplatesFromTwilio(false);
    } catch (error) {
      toast.error(error.message || "Failed to create template.");
    } finally {
      setIsCreating(false);
    }
  };

  // --- FORM HELPERS ---
  const insertBodyVariable = () => {
    const currentBody = formData.body || "";
    const matches = currentBody.match(/\{\{(\d+)\}\}/g);
    let nextNum = 1;
    if (matches) {
      const nums = matches.map((m) => parseInt(m.replace(/[{}]/g, ""), 10));
      nextNum = Math.max(...nums) + 1;
    }
    setFormData((prev) => ({ ...prev, body: prev.body + `{{${nextNum}}}` }));
  };

  const insertHeaderVariable = () => {
    const currentHeader = formData.headerText || "";
    if (!currentHeader.includes("{{1}}"))
      setFormData((prev) => ({
        ...prev,
        headerText: prev.headerText + "{{1}}",
      }));
    else toast.warning("Headers can only contain one variable: {{1}}");
  };

  const handleAddButton = () => {
    if (buttons.length >= 3) return toast.warning("Maximum 3 buttons allowed.");
    setButtons([...buttons, { type: "QUICK_REPLY", title: "", value: "" }]);
  };

  const handleButtonChange = (index, field, val) => {
    const newButtons = [...buttons];
    newButtons[index][field] = val;
    setButtons(newButtons);
  };

  const handleRemoveButton = (index) =>
    setButtons(buttons.filter((_, i) => i !== index));

  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const insertFormatting = (syntax) =>
    setFormData((prev) => ({ ...prev, body: prev.body + syntax }));

  // --- UI RENDERING HELPERS ---
  const formatPreviewBody = (text) => {
    if (!text) return { __html: "Your message body will appear here..." };
    let formatted = text
      .replace(/\*([^\*]+)\*/g, "<strong>$1</strong>")
      .replace(/_([^_]+)_/g, "<em>$1</em>")
      .replace(/~([^~]+)~/g, "<del>$1</del>")
      .replace(
        /\{\{(\d+)\}\}/g,
        `<span class="bg-blue-100 text-blue-800 px-1 rounded mx-0.5">{{$1}}</span>`,
      );
    return { __html: formatted.replace(/\n/g, "<br/>") };
  };

  const renderChannelEligibility = (tpl) => {
    const normalizedStatus = tpl.normalizedStatus;
    const rejectionReason = tpl.whatsapp?.rejection_reason;

    if (normalizedStatus === "approved") {
      return (
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <div className="flex items-start gap-2">
            <CheckCircle2
              size={15}
              className="text-emerald-500 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-700 leading-tight">
              WhatsApp business initiated
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2
              size={15}
              className="text-emerald-500 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-700 leading-tight">
              WhatsApp user initiated
            </span>
          </div>
          <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-sm">
            Approved
          </span>
        </div>
      );
    }
    if (normalizedStatus === "rejected") {
      return (
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <div className="flex items-start gap-2 opacity-60">
            <Info
              size={15}
              className="text-rose-500 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-500 line-through leading-tight">
              WhatsApp business initiated
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2
              size={15}
              className="text-emerald-500 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-700 leading-tight">
              WhatsApp user initiated
            </span>
          </div>
          <div className="flex flex-col gap-1 mt-1 bg-rose-50 p-2 rounded-lg border border-rose-100 max-w-[300px]">
            <span className="inline-flex items-center w-max text-[10px] font-bold uppercase tracking-widest text-rose-700">
              Rejected
            </span>
            {rejectionReason && (
              <p className="text-[11px] text-rose-600 font-medium leading-snug break-words whitespace-pre-wrap">
                {rejectionReason}
              </p>
            )}
          </div>
        </div>
      );
    }
    if (normalizedStatus === "pending") {
      return (
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <div className="flex items-start gap-2">
            <Clock
              size={15}
              className={`text-amber-500 shrink-0 mt-0.5 ${isSyncing ? "animate-spin" : ""}`}
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-700 leading-tight">
              WhatsApp business initiated
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2
              size={15}
              className="text-slate-300 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-700 leading-tight">
              WhatsApp user initiated
            </span>
          </div>
          <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 shadow-sm">
            Pending Approval
          </span>
        </div>
      );
    }
    if (normalizedStatus === "paused") {
      return (
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <div className="flex items-start gap-2 opacity-60">
            <PauseCircle
              size={15}
              className="text-orange-500 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-500 line-through leading-tight">
              WhatsApp business initiated
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2
              size={15}
              className="text-emerald-500 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-700 leading-tight">
              WhatsApp user initiated
            </span>
          </div>
          <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-orange-700 bg-orange-50 px-2 py-0.5 rounded border border-orange-200 shadow-sm">
            Paused (Quality)
          </span>
        </div>
      );
    }

    if (normalizedStatus === "received") {
      return (
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <div className="flex items-start gap-2">
            <Signal
              size={15}
              className={`text-green-500 shrink-0 mt-0.5`}
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-700 leading-tight">
              Received from WhatsApp
            </span>
          </div>
          <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-200 shadow-sm">
            Received
          </span>
        </div>
      );
    }
    if (normalizedStatus === "disabled") {
      return (
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <div className="flex items-start gap-2 opacity-60">
            <XCircle
              size={15}
              className="text-rose-500 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-500 line-through leading-tight">
              WhatsApp business initiated
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2
              size={15}
              className="text-emerald-500 shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[12.5px] text-slate-700 leading-tight">
              WhatsApp user initiated
            </span>
          </div>
          <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 shadow-sm">
            Disabled by Meta
          </span>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1.5 min-w-[200px] opacity-70">
        <div className="flex items-start gap-2">
          <AlertCircle
            size={15}
            className="text-slate-400 shrink-0 mt-0.5"
            strokeWidth={2.5}
          />
          <span className="text-[12.5px] text-slate-500 italic leading-tight">
            Not Submitted
          </span>
        </div>
        <span className="inline-flex items-center w-max mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          Draft
        </span>
      </div>
    );
  };

  // --- FILTER & PAGINATION CALCULATIONS ---
  const filterCounts = useMemo(() => {
    const counts = {
      ALL: templates.length,
      APPROVED: 0,
      RECEIVED: 0,
      PENDING: 0,
      REJECTED: 0,
      DRAFT: 0,
      PAUSED: 0,
      DISABLED: 0,
    };
    templates.forEach((t) => {
      const s = t.normalizedStatus.toUpperCase();
      if (counts[s] !== undefined) counts[s]++;
    });
    return counts;
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    if (activeFilter !== "ALL") {
      filtered = filtered.filter(
        (t) => t.normalizedStatus.toUpperCase() === activeFilter,
      );
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (t) =>
          (t.name && t.name.toLowerCase().includes(q)) ||
          (t.sid && t.sid.toLowerCase().includes(q)) ||
          (t.whatsapp?.category &&
            t.whatsapp.category.toLowerCase().includes(q)) ||
          (t.language && t.language.toLowerCase().includes(q)),
      );
    }
    return filtered;
  }, [templates, activeFilter, searchQuery]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTemplates.length / itemsPerPage),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const currentTemplates = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return filteredTemplates.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTemplates, safeCurrentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) setCurrentPage(safeCurrentPage);
  }, [safeCurrentPage, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery]);

  // ================= MAIN RENDER =================
  if (status === "loading")
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm">
        <Loader2 className="animate-spin mr-2" size={20} /> Verifying Access...
      </div>
    );
  if (!isAuthorized)
    return (
      <div className="flex h-[100dvh] bg-slate-50 overflow-hidden relative">
        <Sidebar
          role={session?.user?.role}
          mobileOpen={mobileMenuOpen}
          setMobileOpen={setMobileMenuOpen}
        />
        <div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center">
          <ShieldAlert size={80} className="text-rose-400 mb-6" />
          <h2 className="text-3xl font-extrabold text-slate-800">
            Clearance Required
          </h2>
        </div>
      </div>
    );

  return (
    <div className="flex h-[100dvh] bg-[#f8fafc] font-sans overflow-hidden">
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <Sidebar
        role={session?.user?.role}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-20 shadow-sm gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg"
            >
              <Menu size={24} />
            </button>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <LayoutTemplate className="text-[#00a884]" size={24} /> Template
                Builder
              </h1>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-0.5 ml-1">
                WhatsApp Campaign Manager
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
          {/* ================= BUILDER SECTION ================= */}
          <div className="max-w-[1400px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
            <div className="xl:col-span-7 space-y-6">
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-lg">
                    <MessageSquare size={20} className="text-[#00a884]" />{" "}
                    Template Details
                  </h3>
                </div>
                <form onSubmit={handleCreateTemplate} className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Template Type *
                      </label>
                      <select
                        value={formData.templateType}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData({
                            ...formData,
                            templateType: val,
                            headerType:
                              val === "WHATSAPP_CARD" ? "MEDIA" : "NONE",
                          });
                        }}
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 transition-shadow"
                      >
                        <option value="TEXT">Simple Text</option>
                        <option value="CALL_TO_ACTION">
                          Call To Action / Quick Reply
                        </option>
                        <option value="WHATSAPP_CARD">WhatsApp Card</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Language *
                      </label>
                      <select
                        value={formData.language}
                        onChange={(e) =>
                          setFormData({ ...formData, language: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 transition-shadow"
                      >
                        <option value="en">English (en)</option>
                        <option value="ta">Tamil (ta)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Category *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                        className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 transition-shadow"
                      >
                        <option value="MARKETING">Marketing</option>
                        <option value="UTILITY">Utility</option>
                        <option value="AUTHENTICATION">Authentication</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Template Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., promo_offer_01"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            name: e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]/g, ""),
                          })
                        }
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow"
                      />
                    </div>
                  </div>

                  <hr className="border-slate-100" />

                  <div className="space-y-3">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Header (Optional)
                    </label>
                    <select
                      value={formData.headerType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          headerType: e.target.value,
                          headerText: "",
                        })
                      }
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 transition-shadow"
                    >
                      <option value="NONE">None</option>
                      <option value="TEXT">Text</option>
                      <option value="MEDIA">
                        Media (Image/Video/Document)
                      </option>
                    </select>

                    {formData.headerType === "TEXT" && (
                      <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            Header Text
                          </label>
                          <button
                            type="button"
                            onClick={insertHeaderVariable}
                            className="px-2 py-1 bg-[#00a884]/10 text-[#00a884] rounded font-bold text-[10px] hover:bg-[#00a884]/20 flex items-center gap-1 transition-colors"
                          >
                            <Variable size={12} /> ADD VARIABLE
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Header text (max 60 chars)"
                          maxLength={60}
                          value={formData.headerText}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              headerText: e.target.value,
                            })
                          }
                          className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow"
                        />
                      </div>
                    )}

                    {formData.headerType === "MEDIA" && (
                      <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100 border-dashed flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                        <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 bg-white border border-slate-200 hover:border-emerald-400 hover:shadow-md text-slate-600 px-4 py-2.5 rounded-xl transition-all shadow-sm">
                          <UploadCloud size={18} className="text-emerald-500" />
                          <span className="text-sm font-bold truncate max-w-[200px]">
                            {imageFile ? imageFile.name : "Choose File"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageChange}
                            ref={fileInputRef}
                          />
                        </label>
                        {imageFile && (
                          <button
                            type="button"
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview("");
                              fileInputRef.current.value = "";
                            }}
                            className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition shadow-sm border border-rose-100"
                            title="Remove image"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Body *
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => insertFormatting("* *")}
                          className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 transition-colors"
                          title="Bold"
                        >
                          <Bold size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("_ _")}
                          className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 transition-colors"
                          title="Italic"
                        >
                          <Italic size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => insertFormatting("~ ~")}
                          className="p-1.5 bg-slate-100 rounded text-slate-600 hover:bg-slate-200 transition-colors"
                          title="Strikethrough"
                        >
                          <Strikethrough size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={insertBodyVariable}
                          className="px-2 py-1 ml-1 bg-[#00a884]/10 text-[#00a884] rounded font-bold text-[10px] hover:bg-[#00a884]/20 flex items-center gap-1 transition-colors"
                        >
                          <Variable size={12} /> ADD VARIABLE
                        </button>
                      </div>
                    </div>
                    <textarea
                      required
                      rows={5}
                      placeholder="Type your message here..."
                      value={formData.body}
                      onChange={(e) =>
                        setFormData({ ...formData, body: e.target.value })
                      }
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm resize-none leading-relaxed transition-shadow custom-scrollbar"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Footer (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Short footer text..."
                      maxLength={60}
                      value={formData.footerText}
                      onChange={(e) =>
                        setFormData({ ...formData, footerText: e.target.value })
                      }
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow"
                    />
                  </div>

                  <hr className="border-slate-100" />

                  {(formData.templateType === "CALL_TO_ACTION" ||
                    formData.templateType === "WHATSAPP_CARD") && (
                    <div className="space-y-3 animate-in fade-in">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <LinkIcon size={14} /> Actions
                        </label>
                        <button
                          type="button"
                          onClick={handleAddButton}
                          className="text-[11px] font-bold bg-[#00a884]/10 text-[#00a884] px-3 py-1.5 rounded-lg hover:bg-[#00a884]/20 transition-colors shadow-sm"
                        >
                          + Add Action
                        </button>
                      </div>

                      {buttons.length === 0 && (
                        <p className="text-xs text-slate-400 italic">
                          No buttons added.
                        </p>
                      )}

                      {buttons.map((btn, index) => (
                        <div
                          key={index}
                          className="flex flex-col gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200 relative group animate-in slide-in-from-top-2"
                        >
                          <button
                            type="button"
                            onClick={() => handleRemoveButton(index)}
                            className="absolute top-2 right-2 text-rose-500 hover:bg-rose-100 p-1.5 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            aria-label="Remove button"
                          >
                            <Trash2 size={14} />
                          </button>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-6">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Type of action
                              </label>
                              <select
                                value={btn.type}
                                onChange={(e) =>
                                  handleButtonChange(
                                    index,
                                    "type",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-white border border-slate-200 rounded-lg text-xs font-bold px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm text-slate-700 cursor-pointer transition-shadow"
                              >
                                <option value="QUICK_REPLY">Quick Reply</option>
                                <option value="URL">Visit Website</option>
                                <option value="PHONE_NUMBER">
                                  Call Phone Number
                                </option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Button Text
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Buy Now"
                                value={btn.title}
                                maxLength={25}
                                onChange={(e) =>
                                  handleButtonChange(
                                    index,
                                    "title",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-white border border-slate-200 rounded-lg text-xs font-medium px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow"
                              />
                            </div>
                          </div>

                          {btn.type !== "QUICK_REPLY" && (
                            <div className="space-y-1.5 mt-1 animate-in fade-in">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                {btn.type === "URL"
                                  ? "Website URL (https://...)"
                                  : "Phone Number (+91...)"}
                              </label>
                              <input
                                type={btn.type === "URL" ? "url" : "text"}
                                placeholder={
                                  btn.type === "URL"
                                    ? "https://example.com"
                                    : "+91 9876543210"
                                }
                                value={btn.value}
                                onChange={(e) =>
                                  handleButtonChange(
                                    index,
                                    "value",
                                    e.target.value,
                                  )
                                }
                                className="w-full bg-white border border-slate-200 rounded-lg text-xs font-medium px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] shadow-sm transition-shadow"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isCreating}
                    className="w-full flex items-center justify-center gap-2 bg-[#00a884] text-white px-4 py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-[#00a884]/30 hover:bg-[#008f6f] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
                  >
                    {isCreating ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}{" "}
                    Save Template
                  </button>
                </form>
              </div>
            </div>

            {/* COLUMN 2: RESPONSIVE LIVE PREVIEW DEVICE */}
            <div className="xl:col-span-5 relative">
              <div className="xl:sticky xl:top-6 flex flex-col items-center w-full">
                <h3 className="text-sm font-extrabold text-slate-800 mb-6 uppercase tracking-widest text-center flex items-center gap-2">
                  <LayoutTemplate size={16} /> Live Preview
                </h3>
                <div className="relative w-full max-w-[360px] aspect-[9/19] bg-slate-900 rounded-[3rem] p-[10px] shadow-2xl border-[1px] border-slate-700/50 before:absolute before:inset-0 before:rounded-[3rem] before:shadow-[inset_0_0_2px_rgba(255,255,255,0.2)] mx-auto">
                  <div className="absolute top-0 inset-x-0 h-7 flex justify-center z-30 pt-[12px]">
                    <div className="w-[120px] h-[30px] bg-black rounded-full flex items-center justify-between px-3">
                      <div className="w-3 h-3 rounded-full bg-slate-800/80 shadow-inner"></div>
                      <div className="w-2 h-2 rounded-full bg-blue-900/40"></div>
                    </div>
                  </div>
                  <div className="absolute -left-[3px] top-[100px] w-[3px] h-8 bg-slate-800 rounded-l-md"></div>
                  <div className="absolute -left-[3px] top-[140px] w-[3px] h-12 bg-slate-800 rounded-l-md"></div>
                  <div className="absolute -left-[3px] top-[200px] w-[3px] h-12 bg-slate-800 rounded-l-md"></div>
                  <div className="absolute -right-[3px] top-[140px] w-[3px] h-16 bg-slate-800 rounded-r-md"></div>

                  <div className="w-full h-full bg-[#EFEAE2] rounded-[2.2rem] overflow-hidden flex flex-col relative z-20">
                    <div
                      className="absolute inset-0 opacity-[0.035] pointer-events-none mix-blend-multiply"
                      style={{
                        backgroundImage:
                          "url('https://i.pinimg.com/originals/97/c0/07/97c00759d90d786d9b6096d274ad3e07.png')",
                        backgroundSize: "250px",
                      }}
                    ></div>
                    <div className="h-12 w-full bg-[#008069] flex items-end justify-between px-6 pb-2 text-white/90 z-20">
                      <span className="text-[12px] font-semibold pl-2">
                        9:41
                      </span>
                      <div className="flex items-center gap-1.5 pr-1">
                        <Signal size={12} />
                        <Wifi size={12} />
                        <Battery size={14} className="ml-0.5" />
                      </div>
                    </div>
                    <div className="bg-[#008069] text-white px-4 py-2.5 flex items-center gap-3 shadow-md z-20 shrink-0">
                      <button className="text-white/90">
                        <ChevronLeft size={20} />
                      </button>
                      <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center shrink-0 border border-white/20">
                        <img
                          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                          alt="Avatar"
                          className="w-full h-full rounded-full opacity-0"
                        />
                        <LayoutTemplate
                          size={18}
                          className="absolute text-white/90"
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-bold text-[15px] leading-tight truncate">
                          Almaa Herbal Nature
                        </span>
                        <span className="text-[11px] text-white/80 font-medium">
                          Business Account
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-white/90 ml-1">
                        <MoreVertical size={20} />
                      </div>
                    </div>

                    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col justify-end z-10 relative space-y-4">
                      <div className="flex justify-center mb-2">
                        <div className="bg-[#E1F3FB] text-slate-600 text-[11px] font-medium px-3 py-1 rounded-lg shadow-sm">
                          Today
                        </div>
                      </div>
                      <div className="flex justify-center mb-2">
                        <div className="bg-[#FFEECD] text-slate-600 text-[11.5px] font-medium px-4 py-2 rounded-xl shadow-sm text-center leading-relaxed max-w-[95%]">
                          <AlertCircle
                            size={14}
                            className="inline-block mr-1.5 text-amber-600 -mt-0.5"
                          />
                          Messages and calls are end-to-end encrypted. No one
                          outside of this chat, not even WhatsApp, can read or
                          listen to them. Tap to learn more.
                        </div>
                      </div>

                      {formData.templateType === "WHATSAPP_CARD" ? (
                        <div className="w-full self-start overflow-x-auto pb-2 snap-x snap-mandatory hide-scrollbar">
                          <div className="flex gap-2.5 w-max px-1">
                            <div className="bg-white rounded-xl shadow-sm overflow-hidden w-[260px] shrink-0 border border-slate-200 snap-center flex flex-col">
                              {formData.headerType === "MEDIA" && (
                                <div className="w-full h-36 bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100 relative group">
                                  {imagePreview ? (
                                    <img
                                      src={imagePreview}
                                      alt="Preview"
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                  ) : (
                                    <ImageIcon
                                      size={32}
                                      className="text-slate-300"
                                    />
                                  )}
                                </div>
                              )}
                              {formData.headerType === "TEXT" &&
                                formData.headerText && (
                                  <div className="p-3.5 pb-0 font-extrabold text-[15px] text-slate-800 leading-tight">
                                    {formData.headerText}
                                  </div>
                                )}
                              <div className="p-3.5 flex-1">
                                <div
                                  className="text-[13.5px] text-[#111b21] leading-relaxed word-break"
                                  dangerouslySetInnerHTML={formatPreviewBody(
                                    formData.body,
                                  )}
                                />
                                {formData.footerText && (
                                  <div className="text-[11.5px] text-[#667781] mt-2 font-medium">
                                    {formData.footerText}
                                  </div>
                                )}
                              </div>
                              {buttons.length > 0 && (
                                <div className="border-t border-slate-200/60 flex flex-col bg-white">
                                  {buttons.map((btn, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center justify-center gap-2 py-3 border-b last:border-b-0 border-slate-200/60 text-[#00a884] font-semibold text-[14px] hover:bg-slate-50 cursor-pointer transition-colors active:bg-slate-100"
                                    >
                                      {btn.type === "URL" ? (
                                        <ExternalLink size={16} />
                                      ) : btn.type === "PHONE_NUMBER" ? (
                                        <PhoneCall size={16} />
                                      ) : (
                                        <FastForward size={16} />
                                      )}
                                      {btn.title || "Button Text"}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-[1.1rem] rounded-tl-none shadow-sm overflow-hidden max-w-[280px] w-full self-start relative">
                          {formData.headerType === "MEDIA" && (
                            <div className="w-full h-40 bg-slate-100 flex items-center justify-center overflow-hidden relative group p-1">
                              {imagePreview ? (
                                <img
                                  src={imagePreview}
                                  alt="Preview"
                                  className="w-full h-full object-cover rounded-xl transition-transform duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full rounded-xl bg-slate-200/50 flex items-center justify-center border border-slate-200/50">
                                  <ImageIcon
                                    size={32}
                                    className="text-slate-400"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                          <div className="p-3 pb-2 pt-2.5">
                            {formData.headerType === "TEXT" &&
                              formData.headerText && (
                                <div className="font-extrabold text-[15px] text-slate-800 mb-1.5 leading-snug">
                                  {formData.headerText}
                                </div>
                              )}
                            <div
                              className="text-[14px] text-[#111b21] leading-relaxed whitespace-pre-wrap word-break"
                              dangerouslySetInnerHTML={formatPreviewBody(
                                formData.body,
                              )}
                            />
                            <div className="flex items-end justify-between mt-1.5 gap-2">
                              <div className="flex-1">
                                {formData.footerText && (
                                  <div className="text-[12px] text-[#667781] font-medium leading-tight">
                                    {formData.footerText}
                                  </div>
                                )}
                              </div>
                              <div className="text-right text-[10.5px] text-[#667781] font-medium shrink-0 pt-1">
                                12:00 PM
                              </div>
                            </div>
                          </div>
                          {buttons.length > 0 && (
                            <div className="border-t border-slate-200/60 flex flex-col bg-white">
                              {buttons.map((btn, i) => (
                                <div
                                  key={i}
                                  className="flex items-center justify-center gap-2 py-3 border-b last:border-b-0 border-slate-200/60 text-[#008069] font-semibold text-[14.5px] hover:bg-slate-50 cursor-pointer transition-colors active:bg-slate-100"
                                >
                                  {btn.type === "URL" ? (
                                    <ExternalLink size={16} />
                                  ) : btn.type === "PHONE_NUMBER" ? (
                                    <PhoneCall size={16} />
                                  ) : (
                                    <FastForward size={16} />
                                  )}
                                  {btn.title || "Button Text"}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= REFACTORED TEMPLATE LIBRARY (Bottom) ================= */}
          <div
            id="template-library-section"
            className="mt-16 max-w-[1400px] mx-auto bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-200/80 overflow-hidden flex flex-col"
          >
            {/* Header & Controls */}
            <div className="p-5 md:p-6 lg:px-8 border-b border-slate-100 bg-white flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div>
                <h3 className="font-extrabold text-slate-900 flex items-center gap-2.5 text-[22px] tracking-tight">
                  <Database size={24} className="text-[#00a884]" /> Template
                  Library
                </h3>
                <p className="text-sm text-slate-500 font-medium mt-1.5">
                  Manage, track, and sync your WhatsApp campaign assets.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="relative flex-1 md:w-64 min-w-[200px]">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none transition-all placeholder:text-slate-400 text-slate-700"
                  />
                </div>

                <button
                  onClick={handleRefresh}
                  disabled={apiState.loading || isSyncing}
                  className="py-2.5 px-4 bg-emerald-50 rounded-xl border border-emerald-200 shadow-sm hover:bg-emerald-100 transition active:scale-95 disabled:opacity-50 text-sm font-bold text-emerald-700 flex items-center gap-2 shrink-0"
                >
                  <RefreshCw
                    size={16}
                    className={`${apiState.loading || isSyncing ? "animate-spin" : ""}`}
                  />
                  <span className="hidden sm:inline">Refresh Twilio Data</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="px-5 md:px-6 lg:px-8 py-4 bg-slate-50/50 border-b border-slate-100 overflow-x-auto hide-scrollbar">
              <div className="flex items-center gap-2 w-max">
                {[
                  "ALL",
                  "APPROVED",
                  "PENDING",
                  "RECEIVED",
                  "REJECTED",
                  "PAUSED",
                  "DISABLED",
                  "DRAFT",
                ].map((filter) => {
                  const count =
                    filter === "ALL"
                      ? templates.length
                      : filterCounts[filter] || 0;
                  return (
                    <button
                      key={filter}
                      onClick={() => setActiveFilter(filter)}
                      className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                        activeFilter === filter
                          ? "bg-slate-800 text-white shadow-md shadow-slate-200"
                          : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {filter}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === filter ? "bg-slate-600 text-slate-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[400px] relative bg-white">
              {apiState.loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                  <Loader2
                    size={40}
                    className="animate-spin text-[#00a884] mb-4"
                  />
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
                    Loading Library from Twilio...
                  </p>
                </div>
              ) : apiState.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm z-10">
                  <ShieldAlert size={40} className="text-rose-500 mb-4" />
                  <p className="text-sm font-bold text-rose-600">
                    {apiState.error}
                  </p>
                </div>
              ) : templates.length === 0 ? (
                // --- EMPTY STATE 1: NO TEMPLATES IN TWILIO ---
                <div className="flex flex-col items-center justify-center p-16 md:p-24 text-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 border border-slate-100 shadow-sm">
                    <Database size={32} className="text-slate-300" />
                  </div>
                  <h4 className="text-xl font-bold text-slate-800 mb-2">
                    Your Template Library is Empty
                  </h4>
                  <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
                    Your Twilio Content Library is completely empty. Create a
                    template above to get started.
                  </p>
                </div>
              ) : currentTemplates.length === 0 ? (
                // --- EMPTY STATE 2: NO SEARCH/FILTER RESULTS ---
                <div className="flex flex-col items-center justify-center p-16 md:p-24 text-center">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                    <Search size={24} className="text-slate-400" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-1">
                    No matches found
                  </h4>
                  <p className="text-sm text-slate-500 max-w-sm">
                    We couldn't find any templates matching "{searchQuery}" or
                    your current filter criteria.
                  </p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setActiveFilter("ALL");
                    }}
                    className="mt-5 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                <>
                  {/* MOBILE VIEW (CARDS) */}
                  <div className="md:hidden flex flex-col divide-y divide-slate-100">
                    {currentTemplates.map((tpl) => (
                      <div
                        key={tpl._id || tpl.sid}
                        className="p-5 flex flex-col gap-4 hover:bg-slate-50/50 transition-colors"
                      >
                        <div className="flex justify-between items-start gap-3">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-slate-900 text-[15px] mb-1.5 break-words leading-snug">
                              {tpl.name}
                            </h4>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {tpl.sid}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                {tpl.language === "en"
                                  ? "EN"
                                  : tpl.language === "ta"
                                    ? "TA"
                                    : tpl.language}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteTemplate(tpl)}
                            disabled={
                              isDeleting === tpl.sid || isDeleting === tpl._id
                            }
                            className="p-2 -mr-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all shrink-0"
                          >
                            {isDeleting === tpl.sid ||
                            isDeleting === tpl._id ? (
                              <Loader2
                                size={16}
                                className="animate-spin text-rose-500"
                              />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-2 text-slate-600 w-max">
                          {tpl.templateType === "TEXT" && (
                            <LayoutTemplate
                              size={14}
                              className="text-slate-400 shrink-0"
                            />
                          )}
                          {tpl.templateType === "WHATSAPP_CARD" && (
                            <ImageIcon
                              size={14}
                              className="text-slate-400 shrink-0"
                            />
                          )}
                          {tpl.templateType === "CALL_TO_ACTION" && (
                            <ExternalLink
                              size={14}
                              className="text-slate-400 shrink-0"
                            />
                          )}
                          <span className="text-[12px] font-semibold">
                            {tpl.templateType === "TEXT"
                              ? "Text"
                              : tpl.templateType === "WHATSAPP_CARD"
                                ? "WhatsApp Card"
                                : "Action / Quick Reply"}
                          </span>
                        </div>

                        <div className="bg-slate-50/50 rounded-xl p-3.5 border border-slate-100">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                            WhatsApp Status
                          </p>
                          {renderChannelEligibility(tpl)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* DESKTOP VIEW (TABLE) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap">
                      <thead className="bg-white text-slate-500 text-[10px] uppercase font-bold tracking-widest border-b border-slate-200 sticky top-0 z-10">
                        <tr>
                          <th className="px-6 py-4 font-bold">
                            Template Details
                          </th>
                          <th className="px-6 py-4 font-bold">Format</th>
                          <th className="px-6 py-4 font-bold">
                            WhatsApp Status
                          </th>
                          <th className="px-6 py-4 w-12"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {currentTemplates.map((tpl) => (
                          <tr
                            key={tpl._id || tpl.sid}
                            className="hover:bg-slate-50/60 transition-colors group"
                          >
                            <td className="px-6 py-5 align-top">
                              <div className="font-extrabold text-slate-900 text-[14.5px] mb-1.5 whitespace-normal line-clamp-2 max-w-[280px] leading-snug">
                                {tpl.name}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {tpl.sid}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                                  {tpl.language === "en"
                                    ? "EN"
                                    : tpl.language === "ta"
                                      ? "TA"
                                      : tpl.language}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-5 align-top">
                              <div className="flex items-center gap-2 text-slate-600 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg w-max shadow-sm">
                                {tpl.templateType === "TEXT" && (
                                  <LayoutTemplate
                                    size={14}
                                    className="text-slate-400 shrink-0"
                                  />
                                )}
                                {tpl.templateType === "WHATSAPP_CARD" && (
                                  <ImageIcon
                                    size={14}
                                    className="text-slate-400 shrink-0"
                                  />
                                )}
                                {tpl.templateType === "CALL_TO_ACTION" && (
                                  <ExternalLink
                                    size={14}
                                    className="text-slate-400 shrink-0"
                                  />
                                )}
                                <span className="text-[12.5px] font-semibold">
                                  {tpl.templateType === "TEXT" &&
                                    "Text Message"}
                                  {tpl.templateType === "WHATSAPP_CARD" &&
                                    "WhatsApp Card"}
                                  {tpl.templateType === "CALL_TO_ACTION" &&
                                    "Action / Reply"}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-5 align-top whitespace-normal max-w-[300px]">
                              {renderChannelEligibility(tpl)}
                            </td>

                            <td className="px-6 py-5 align-top text-right">
                              <button
                                onClick={() => handleDeleteTemplate(tpl)}
                                disabled={
                                  isDeleting === tpl.sid ||
                                  isDeleting === tpl._id
                                }
                                className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100 border border-transparent hover:border-rose-100 shadow-sm"
                                title="Delete Template"
                              >
                                {isDeleting === tpl.sid ||
                                isDeleting === tpl._id ? (
                                  <Loader2
                                    size={18}
                                    className="animate-spin text-rose-500"
                                  />
                                ) : (
                                  <Trash2 size={18} />
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Pagination Footer */}
            {!apiState.loading && filteredTemplates.length > 0 && (
              <div className="p-4 md:p-6 border-t border-slate-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-500">
                  Showing{" "}
                  <span className="font-bold text-slate-700">
                    {(safeCurrentPage - 1) * itemsPerPage + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-bold text-slate-700">
                    {Math.min(
                      safeCurrentPage * itemsPerPage,
                      filteredTemplates.length,
                    )}
                  </span>{" "}
                  of{" "}
                  <span className="font-bold text-slate-700">
                    {filteredTemplates.length}
                  </span>{" "}
                  templates
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safeCurrentPage === 1}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - safeCurrentPage) <= 1,
                      )
                      .map((p, i, arr) => (
                        <React.Fragment key={p}>
                          {i > 0 && arr[i - 1] !== p - 1 && (
                            <span className="px-2 text-slate-400">...</span>
                          )}
                          <button
                            onClick={() => setCurrentPage(p)}
                            className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${safeCurrentPage === p ? "bg-slate-800 text-white shadow-md" : "text-slate-600 hover:bg-slate-100 border border-transparent hover:border-slate-200"}`}
                          >
                            {p}
                          </button>
                        </React.Fragment>
                      ))}
                  </div>

                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={safeCurrentPage === totalPages}
                    className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
