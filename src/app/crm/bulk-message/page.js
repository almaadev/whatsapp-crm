"use client";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import {
  Send,
  Hash,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Layers,
  ChevronRight,
  ChevronLeft,
  X,
  Type,
  Menu,
  History,
  Users,
  ChevronDown,
  RefreshCw,
  Trash2,
  Copy,
  Search,
  Check,
  Eye,
  Info,
  Clock,
  ArrowUpRight,
  Filter,
  Mail,
  Plus,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { useAuth } from "@/shared/hooks/useAuth";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import { bulkMessageRepository } from "@/shared/api/repositories/bulkMessageRepository";
import TemplateManagerPanel from "@/features/templates/components/TemplateManagerPanel";
import { useTemplateStore } from "@/features/templates/stores/templateStore";
import { useChatStore } from "@/features/chat/stores/chatStore";
import { connectSocket } from "@/features/chat/services/socketService";

export default function BulkTemplatePage() {
  const { setMobileOpen } = useCrmLayout();
  const { data: session, status } = useSession();
  const { user, isLoading, hasModuleAccess, isSuperAdmin } = useAuth();

  // Campaign Form State
  const [campaignName, setCampaignName] = useState("");
  const [numbersText, setNumbersText] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [templateVariables, setTemplateVariables] = useState({});
  const [requiredVariablesCount, setRequiredVariablesCount] = useState(0);
  const [sourceCampaignMeta, setSourceCampaignMeta] = useState(null);

  // Template & Store
  const { templates, fetchTemplates } = useTemplateStore();
  const availableNumbers = useChatStore((s) => s.availableNumbers);
  const selectedSender = useChatStore((s) => s.selectedSender);
  const setSelectedSender = useChatStore((s) => s.setSelectedSender);

  // Progress & Sending State
  const [isSending, setIsSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0, failed: 0 });
  const [panelOpen, setPanelOpen] = useState(false);

  // Campaign History State & Filters
  const [campaigns, setCampaigns] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [campaignsPerPage, setCampaignsPerPage] = useState(10);
  const [isDeleting, setIsDeleting] = useState(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set());
  const [historySearch, setHistorySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFilter, setDateFilter] = useState("ALL");
  const [senderFilter, setSenderFilter] = useState("ALL");
  const [templateFilter, setTemplateFilter] = useState("ALL");
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const formRef = useRef(null);

  const toggleExpandCampaign = (campaignId) => {
    setExpandedCampaigns((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  // Helper for dynamic numeric pagination range (e.g. ‹ 1 2 3 4 5 … 24 ›)
  const getPaginationRange = (currPage, totalPgs, maxVisible = 5) => {
    if (totalPgs <= 1) return [1];
    if (totalPgs <= maxVisible + 2) {
      return Array.from({ length: totalPgs }, (_, i) => i + 1);
    }

    const pages = [];
    const leftSide = Math.floor(maxVisible / 2);
    let start = Math.max(2, currPage - leftSide);
    let end = Math.min(totalPgs - 1, currPage + leftSide);

    if (currPage <= leftSide + 2) {
      start = 2;
      end = Math.min(totalPgs - 1, maxVisible);
    } else if (currPage >= totalPgs - (leftSide + 1)) {
      start = Math.max(2, totalPgs - maxVisible + 1);
      end = totalPgs - 1;
    }

    pages.push(1);
    if (start > 2) {
      pages.push("...");
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (end < totalPgs - 1) {
      pages.push("...");
    }
    pages.push(totalPgs);

    return pages;
  };

  // Filtered campaigns
  const filteredCampaigns = campaigns.filter((camp) => {
    // 1. Search
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      const matchName = camp.campaignName?.toLowerCase().includes(q);
      const matchTemplate = camp.templateId?.toLowerCase().includes(q);
      if (!matchName && !matchTemplate) return false;
    }

    // 2. Status
    if (statusFilter !== "ALL") {
      const s = (camp.status || "processing").toUpperCase();
      if (statusFilter === "COMPLETED" && !["COMPLETED", "SENT", "ACTIVE"].includes(s)) return false;
      if (statusFilter === "PROCESSING" && !["PROCESSING", "QUEUED", "SENDING"].includes(s)) return false;
      if (statusFilter === "FAILED" && s !== "FAILED") return false;
      if (statusFilter === "PARTIAL" && s !== "PARTIAL") return false;
    }

    // 3. Date
    if (dateFilter !== "ALL") {
      const campDate = new Date(camp.createdAt);
      const now = new Date();
      if (dateFilter === "TODAY") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (campDate < startOfToday) return false;
      } else if (dateFilter === "LAST_7_DAYS") {
        const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (campDate < d7) return false;
      } else if (dateFilter === "LAST_30_DAYS") {
        const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (campDate < d30) return false;
      } else if (dateFilter === "THIS_MONTH") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        if (campDate < startOfMonth) return false;
      }
    }

    // 4. Sender
    if (senderFilter !== "ALL") {
      if (camp.senderNumber !== senderFilter && `whatsapp:${camp.senderNumber}` !== senderFilter) {
        return false;
      }
    }

    // 5. Template
    if (templateFilter !== "ALL") {
      if (camp.templateId !== templateFilter) return false;
    }

    return true;
  });

  const totalCampaigns = filteredCampaigns.length;
  const totalPages = Math.ceil(totalCampaigns / campaignsPerPage) || 1;
  const startCampaignIdx = totalCampaigns > 0 ? (currentPage - 1) * campaignsPerPage + 1 : 0;
  const endCampaignIdx = Math.min(totalCampaigns, currentPage * campaignsPerPage);
  const currentCampaigns = filteredCampaigns.slice(
    (currentPage - 1) * campaignsPerPage,
    currentPage * campaignsPerPage
  );

  const handleCampaignsPerPageChange = (newLimit) => {
    setCampaignsPerPage(Number(newLimit));
    setCurrentPage(1);
  };

  let activeFilterCount = 0;
  if (statusFilter !== "ALL") activeFilterCount++;
  if (dateFilter !== "ALL") activeFilterCount++;
  if (senderFilter !== "ALL") activeFilterCount++;
  if (templateFilter !== "ALL") activeFilterCount++;
  if (historySearch.trim()) activeFilterCount++;

  const resetAllFilters = () => {
    setHistorySearch("");
    setStatusFilter("ALL");
    setDateFilter("ALL");
    setSenderFilter("ALL");
    setTemplateFilter("ALL");
    setCurrentPage(1);
  };

  const getDateFilterLabel = (val) => {
    switch (val) {
      case "TODAY":
        return "Today";
      case "LAST_7_DAYS":
        return "Last 7 Days";
      case "LAST_30_DAYS":
        return "Last 30 Days";
      case "THIS_MONTH":
        return "This Month";
      default:
        return val;
    }
  };

  const getSenderFilterLabel = (val) => {
    const found = availableNumbers.find(
      (n) => n.phoneNumber === val || `whatsapp:${n.phoneNumber}` === val
    );
    if (found) return found.friendlyName || found.phoneNumber;
    return val.replace("whatsapp:", "");
  };

  const getTemplateFilterLabel = (val) => {
    const found = templates.find((t) => t.twilioTemplateId === val || t._id === val || t.name === val);
    if (found) return found.name || val;
    return val;
  };

  // Recipient Drawer/Modal State
  const [activeRecipientCampaign, setActiveRecipientCampaign] = useState(null);
  const [recipientsList, setRecipientsList] = useState([]);
  const [recipientCounts, setRecipientCounts] = useState({});
  const [recipientFilter, setRecipientFilter] = useState("ALL");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientLimit, setRecipientLimit] = useState(20);
  const [recipientPagination, setRecipientPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [isFetchingRecipients, setIsFetchingRecipients] = useState(false);

  // Smart Recall Modal State
  const [recallModalCampaign, setRecallModalCampaign] = useState(null);
  const [recallData, setRecallData] = useState(null);
  const [isFetchingRecall, setIsFetchingRecall] = useState(false);

  // 1. Initial Load & Socket Listener
  useEffect(() => {
    fetchTemplates();
    fetchCampaigns();

    const socket = connectSocket();
    const handleBulkStatusUpdate = (data) => {
      if (data?.campaignId) {
        // Update in-memory campaigns list
        setCampaigns((prev) =>
          prev.map((c) => {
            if (c._id === data.campaignId) {
              return {
                ...c,
                status: data.status || c.status,
                successfulSends: data.successfulSends ?? c.successfulSends,
                failedSends: data.failedSends ?? c.failedSends,
                deliveredCount: data.deliveredCount ?? c.deliveredCount,
                readCount: data.readCount ?? c.readCount,
                undeliveredCount: data.undeliveredCount ?? c.undeliveredCount,
                skippedCount: data.skippedCount ?? c.skippedCount,
                totalRecipients: data.total ?? c.totalRecipients,
              };
            }
            return c;
          })
        );

        // Update active live progress bar
        setProgress((prev) => {
          if (prev.total > 0) {
            return {
              total: data.total || prev.total,
              sent: data.successfulSends ?? prev.sent,
              failed: data.failedSends ?? prev.failed,
            };
          }
          return prev;
        });

        // If recipient drawer is open for this campaign, refresh recipients
        if (activeRecipientCampaign && activeRecipientCampaign._id === data.campaignId) {
          fetchRecipients(data.campaignId, recipientPage, recipientFilter, recipientSearch, false);
        }
      }
    };

    socket.on("bulk_message_status", handleBulkStatusUpdate);
    return () => {
      socket.off("bulk_message_status", handleBulkStatusUpdate);
    };
  }, [fetchTemplates, activeRecipientCampaign, recipientPage, recipientFilter, recipientSearch]);

  const fetchCampaigns = async () => {
    try {
      const { data } = await bulkMessageRepository.getBulkMessages();
      if (data?.success) {
        setCampaigns(data.campaigns || []);
      }
    } catch (err) {
      console.error("Failed to fetch campaigns", err);
    }
  };

  // 2. Fetch Paginated Recipients for Active Campaign
  const fetchRecipients = useCallback(
    async (campaignId, page = 1, status = "ALL", search = "", limit = recipientLimit, showLoader = true) => {
      if (!campaignId) return;
      if (showLoader) setIsFetchingRecipients(true);
      try {
        const { data } = await bulkMessageRepository.getCampaignRecipients(campaignId, {
          page,
          limit,
          status,
          search,
        });

        if (data?.success) {
          setRecipientsList(data.recipients || []);
          setRecipientPagination(data.pagination || { page: 1, limit, total: 0, totalPages: 1 });
          setRecipientCounts(data.counts || {});
        }
      } catch (err) {
        console.error("Failed to fetch campaign recipients", err);
      } finally {
        if (showLoader) setIsFetchingRecipients(false);
      }
    },
    [recipientLimit]
  );

  const handleOpenRecipientsModal = (campaign) => {
    setActiveRecipientCampaign(campaign);
    setRecipientFilter("ALL");
    setRecipientSearch("");
    setRecipientPage(1);
    fetchRecipients(campaign._id, 1, "ALL", "", recipientLimit, true);
  };

  const handleFilterChange = (filter) => {
    setRecipientFilter(filter);
    setRecipientPage(1);
    if (activeRecipientCampaign) {
      fetchRecipients(activeRecipientCampaign._id, 1, filter, recipientSearch, recipientLimit, true);
    }
  };

  const handleSearchChange = (val) => {
    setRecipientSearch(val);
    setRecipientPage(1);
    if (activeRecipientCampaign) {
      fetchRecipients(activeRecipientCampaign._id, 1, recipientFilter, val, recipientLimit, true);
    }
  };

  const handleRecipientPageChange = (newPage) => {
    setRecipientPage(newPage);
    if (activeRecipientCampaign) {
      fetchRecipients(activeRecipientCampaign._id, newPage, recipientFilter, recipientSearch, recipientLimit, true);
    }
  };

  const handleRecipientLimitChange = (newLimit) => {
    const num = Number(newLimit);
    setRecipientLimit(num);
    setRecipientPage(1);
    if (activeRecipientCampaign) {
      fetchRecipients(activeRecipientCampaign._id, 1, recipientFilter, recipientSearch, num, true);
    }
  };

  const handleCopySingleNumber = async (phone) => {
    try {
      const cleaned = phone.replace("whatsapp:", "").replace("+91", "").trim();
      await navigator.clipboard.writeText(cleaned);
      toast.success(`Copied ${cleaned}`);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  // 3. Copy Phone Numbers Helper
  const handleCopyNumbers = async (type) => {
    if (!activeRecipientCampaign) return;
    try {
      const { data } = await bulkMessageRepository.getCampaignRecipients(activeRecipientCampaign._id, {
        limit: 10000,
        status: type === "SUCCESSFUL" ? "SUCCESSFUL" : type === "FAILED" ? "FAILED" : "ALL",
      });

      if (data?.success && data.recipients?.length > 0) {
        const numbers = [
          ...new Set(
            data.recipients.map((r) =>
              (r.normalizedPhone || r.phone).replace("whatsapp:", "").replace("+91", "").trim()
            )
          ),
        ];
        await navigator.clipboard.writeText(numbers.join("\n"));
        toast.success(`Copied ${numbers.length} ${type.toLowerCase()} numbers to clipboard!`);
      } else {
        toast.info(`No ${type.toLowerCase()} numbers found to copy.`);
      }
    } catch (err) {
      toast.error("Failed to copy numbers.");
    }
  };

  const handleCopyNumbersFromCampaign = async (campaignId, type) => {
    try {
      const { data } = await bulkMessageRepository.getCampaignRecipients(campaignId, {
        limit: 10000,
        status: type === "SUCCESSFUL" ? "SUCCESSFUL" : type === "FAILED" ? "FAILED" : "ALL",
      });

      if (data?.success && data.recipients?.length > 0) {
        const numbers = [
          ...new Set(
            data.recipients.map((r) =>
              (r.normalizedPhone || r.phone).replace("whatsapp:", "").replace("+91", "").trim()
            )
          ),
        ];
        await navigator.clipboard.writeText(numbers.join("\n"));
        toast.success(`Copied ${numbers.length} ${type.toLowerCase()} numbers!`);
      } else {
        toast.info(`No ${type.toLowerCase()} numbers found to copy.`);
      }
    } catch (err) {
      toast.error("Failed to copy numbers.");
    }
  };

  // 4. Smart Recall Flow
  const handleOpenRecallModal = async (campaign) => {
    setRecallModalCampaign(campaign);
    setIsFetchingRecall(true);
    try {
      const { data } = await bulkMessageRepository.getCampaignRecall(campaign._id);
      if (data?.success) {
        setRecallData(data);
      } else {
        toast.error("Failed to load recall recipient data.");
        setRecallModalCampaign(null);
      }
    } catch (err) {
      toast.error("Error loading recall statistics.");
      setRecallModalCampaign(null);
    } finally {
      setIsFetchingRecall(false);
    }
  };

  const handleConfirmRecall = () => {
    if (!recallData || !recallData.successfulNumbers?.length) {
      toast.warning("No successful numbers available to recall.");
      return;
    }

    setNumbersText(recallData.successfulNumbers.join(",\n"));
    setCampaignName(`${recallData.sourceCampaignName} — Recall`);
    if (recallData.templateId) {
      setTemplateId(recallData.templateId);
    }
    setSourceCampaignMeta({
      sourceCampaignId: recallData.sourceCampaignId,
      sourceCampaignName: recallData.sourceCampaignName,
      recallType: "SUCCESSFUL_ONLY",
    });

    setRecallModalCampaign(null);
    setRecallData(null);
    toast.success(`${recallData.successfulNumbers.length} successful recipients loaded into form!`);

    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 5. Template Selection Handler
  const handleTemplateSelect = (sid, name) => {
    setTemplateId(sid || "");
    setSelectedName(name || "");
    setTemplateVariables({});
    setRequiredVariablesCount(0);

    if (sid) {
      const selectedTemplate = templates.find((t) => t.sid === sid || t._id === sid);
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

  // 6. Bulk Send Execution
  const handleBulkSend = async () => {
    const extracted = numbersText.match(/\d{10,15}/g) || [];
    const uniqueNumbers = [...new Set(extracted)];

    if (!campaignName.trim()) return toast.error("Please enter a Campaign Name");
    if (!uniqueNumbers.length || !templateId)
      return toast.error("Please enter numbers and select a Template");

    if (requiredVariablesCount > 0) {
      for (let i = 1; i <= requiredVariablesCount; i++) {
        if (!templateVariables[i.toString()] || templateVariables[i.toString()].trim() === "") {
          return toast.error(`Please fill in Variable {{${i}}}`);
        }
      }
    }

    setIsSending(true);
    setProgress({ sent: 0, total: uniqueNumbers.length, failed: 0 });

    let totalSkipped = 0;
    let currentCampaignId = null;

    const batchSize = 100;
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
            Object.keys(templateVariables).length > 0 ? templateVariables : null,
          sourceCampaignId: sourceCampaignMeta?.sourceCampaignId || null,
          sourceCampaignName: sourceCampaignMeta?.sourceCampaignName || null,
          recallType: sourceCampaignMeta?.recallType || null,
        });

        if (data?.success && data.campaignId) {
          currentCampaignId = data.campaignId;
          if (data.skippedCount) totalSkipped += data.skippedCount;
        }

        const eligibleInBatch = data?.eligibleCount ?? batch.length;
        setProgress((prev) => ({
          ...prev,
          sent: prev.sent + eligibleInBatch,
          failed: prev.failed + 0,
        }));
      } catch (err) {
        setProgress((prev) => ({
          ...prev,
          failed: prev.failed + batch.length,
        }));
      }
    }

    setIsSending(false);
    fetchCampaigns();

    if (totalSkipped > 0) {
      toast.success(`Campaign Dispatched! (Skipped ${totalSkipped} opted-out contacts)`);
    } else {
      toast.success("Campaign queued for asynchronous broadcast!");
    }
  };

  // 7. Delete Campaign
  const handleDeleteCampaign = async (id, name) => {
    const confirmMsg = `Are you sure you want to permanently delete the history for "${name}"?\n\nNote: This removes the log and recipient records from the CRM dashboard.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeleting(id);
    try {
      const { data } = await bulkMessageRepository.deleteBulkMessage(id);
      if (data?.success) {
        toast.success("Campaign history deleted");
        setCampaigns((prev) => prev.filter((c) => c._id !== id));
        if (activeRecipientCampaign?._id === id) setActiveRecipientCampaign(null);
      } else {
        toast.error(data?.error || "Failed to delete campaign");
      }
    } catch (err) {
      toast.error("An error occurred while deleting.");
    } finally {
      setIsDeleting(null);
    }
  };

  // Calculations for UI
  const done = progress.sent + progress.failed;
  const pct = progress.total > 0 ? Math.round((done / progress.total) * 100) : 0;
  const extracted = numbersText.match(/\d{10,15}/g) || [];
  const recipientCount = [...new Set(extracted)].length;
  const canSend =
    !isSending && recipientCount > 0 && !!templateId && !!campaignName.trim() && availableNumbers.length > 0;

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm">
        <Loader2 className="animate-spin mr-2 text-[#00a884]" size={20} /> Loading Campaign Workspace...
      </div>
    );
  }

  if (user && !hasModuleAccess("Bulk Messages")) {
    return <AccessDenied moduleName="Bulk Messaging / Campaigns" />;
  }

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
        {/* Top Navbar */}
        <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-xs z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00a884] to-emerald-400 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
                <Send size={15} />
              </div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-800 tracking-tight">
                Bulk Campaign Manager
              </h1>
            </div>
          </div>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full border border-slate-200/60">
            Twilio WhatsApp Content API
          </span>
        </div>

        {/* Main Content Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6 custom-scrollbar">
          <div className="w-full max-w-[1680px] mx-auto flex flex-col md:flex-row items-start gap-6 lg:gap-7">
            {/* LEFT COLUMN: Launch New Campaign (42% Desktop, 45% Tablet, 100% Mobile) */}
            <div
              ref={formRef}
              className="w-full md:w-[45%] lg:w-[42%] md:shrink-0 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div>
                  <h2 className="text-base font-black text-slate-800 tracking-tight">
                    Launch New Campaign
                  </h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Broadcast template messages to verified WhatsApp numbers
                  </p>
                </div>
                {sourceCampaignMeta && (
                  <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-full flex items-center gap-1">
                    <RefreshCw size={10} /> Smart Recall
                  </span>
                )}
              </div>

              {/* Campaign Name Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Campaign Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Summer Festival VIP Offer 2026"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] text-slate-800 placeholder-slate-400 transition-all"
                />
              </div>

              {/* Template Picker Button */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                  Select WhatsApp Template <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPanelOpen(true)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 hover:bg-slate-100/80 transition-all text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Layers size={14} className="text-[#00a884] shrink-0" />
                    <span className="truncate">
                      {selectedName || (templateId ? `Template: ${templateId}` : "Choose a template from manager...")}
                    </span>
                  </div>
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                </button>
              </div>

              {/* Dynamic Content Variables */}
              {requiredVariablesCount > 0 && (
                <div className="bg-emerald-50/40 border border-emerald-100/80 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-800">
                    <Type size={13} /> Template Variables ({requiredVariablesCount})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Array.from({ length: requiredVariablesCount }, (_, i) => i + 1).map((num) => (
                      <div key={num} className="space-y-0.5">
                        <label className="text-[10px] font-bold text-emerald-700 uppercase">
                          Variable {`{{${num}}}`}
                        </label>
                        <input
                          type="text"
                          placeholder={`Value for {{${num}}}`}
                          value={templateVariables[num.toString()] || ""}
                          onChange={(e) => handleVariableChange(num, e.target.value)}
                          className="w-full text-xs font-medium px-2.5 py-1.5 bg-white border border-emerald-200/80 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00a884] text-slate-800 placeholder-slate-400"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sender Number Selector */}
              {availableNumbers.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Sender WhatsApp Number
                  </label>
                  <select
                    value={selectedSender || ""}
                    onChange={(e) => setSelectedSender(e.target.value)}
                    className="w-full text-xs font-semibold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] text-slate-800 cursor-pointer"
                  >
                    {availableNumbers.map((num, idx) => {
                      const phoneVal = typeof num === "object" ? (num.phoneNumber || "") : String(num);
                      const friendlyLabel = typeof num === "object"
                        ? (num.friendlyName ? `${num.friendlyName} (${num.phoneNumber})` : num.phoneNumber)
                        : String(num);
                      const keyVal = typeof num === "object" ? (num._id || num.phoneNumber || idx) : `${num}-${idx}`;
                      return (
                        <option key={keyVal} value={phoneVal}>
                          {friendlyLabel}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Phone Numbers Textarea */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                    Recipient Numbers <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] font-mono font-bold text-[#00a884] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                    {recipientCount} valid recipient{recipientCount === 1 ? "" : "s"}
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder="Paste numbers separated by commas, spaces, or new lines...&#10;e.g.&#10;9876543210&#10;+919876543211&#10;919876543212"
                  value={numbersText}
                  onChange={(e) => setNumbersText(e.target.value)}
                  className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] text-slate-800 placeholder-slate-400 custom-scrollbar resize-none"
                />
              </div>

              {/* Launch & Live Progress */}
              <div className="space-y-2.5 pt-1">
                {(isSending || progress.total > 0) && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        {isSending ? (
                          <Loader2 size={13} className="animate-spin text-[#00a884]" />
                        ) : (
                          <CheckCircle2 size={13} className="text-emerald-500" />
                        )}
                        {isSending ? "Broadcasting Queue Active..." : "Campaign Broadcast Finished"}
                      </span>
                      <span className="font-mono text-[#00a884]">{pct}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-[#00a884] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                      <span className="text-emerald-700">
                        {progress.sent} Sent / Queued
                      </span>
                      {progress.failed > 0 && (
                        <span className="text-rose-600">
                          {progress.failed} Failed
                        </span>
                      )}
                      <span>
                        {done} of {progress.total} Total
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={!canSend}
                  onClick={handleBulkSend}
                  className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
                    canSend
                      ? "bg-gradient-to-r from-[#00a884] to-emerald-600 text-white hover:opacity-95 active:scale-[0.99] shadow-emerald-500/20"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  }`}
                >
                  {isSending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Launching Campaign...
                    </>
                  ) : (
                    <>
                      <Send size={14} /> Launch WhatsApp Broadcast
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: Broadcast History (58% Desktop, 55% Tablet, 100% Mobile) */}
            <div className="w-full md:flex-1 min-w-0 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
              {/* Top Header */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Broadcast History
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchCampaigns}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Refresh History"
                  >
                    <RefreshCw size={14} />
                  </button>
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100/90 border border-slate-200/60 px-3 py-1 rounded-lg">
                    {filteredCampaigns.length} {filteredCampaigns.length === 1 ? "Campaign" : "Campaigns"}
                  </span>
                </div>
              </div>

              {/* Horizontal Filter Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
                  {/* Search Input */}
                  <div className="relative min-w-[140px] sm:w-44 lg:w-40 xl:w-48">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search campaigns..."
                      value={historySearch}
                      onChange={(e) => {
                        setHistorySearch(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full text-xs font-medium pl-7.5 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] text-slate-800 placeholder-slate-400 transition-colors"
                    />
                  </div>

                  {/* Status Dropdown */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl pl-2.5 pr-6 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                    >
                      <option value="ALL">Status</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="PROCESSING">Processing</option>
                      <option value="FAILED">Failed</option>
                      <option value="PARTIAL">Partial</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Date Dropdown */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={dateFilter}
                      onChange={(e) => {
                        setDateFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl pl-2.5 pr-6 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] appearance-none cursor-pointer hover:border-slate-300 transition-colors"
                    >
                      <option value="ALL">Date</option>
                      <option value="TODAY">Today</option>
                      <option value="LAST_7_DAYS">Last 7 Days</option>
                      <option value="LAST_30_DAYS">Last 30 Days</option>
                      <option value="THIS_MONTH">This Month</option>
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Sender Dropdown */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={senderFilter}
                      onChange={(e) => {
                        setSenderFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl pl-2.5 pr-6 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] appearance-none cursor-pointer hover:border-slate-300 transition-colors max-w-[130px] truncate"
                    >
                      <option value="ALL">Sender</option>
                      {availableNumbers.map((num, idx) => {
                        const phoneVal = typeof num === "object" ? (num.phoneNumber || "") : String(num);
                        const friendlyLabel = typeof num === "object"
                          ? (num.friendlyName ? `${num.friendlyName}` : num.phoneNumber)
                          : String(num);
                        const keyVal = typeof num === "object" ? (num._id || num.phoneNumber || idx) : `${num}-${idx}`;
                        return (
                          <option key={keyVal} value={phoneVal}>
                            {friendlyLabel}
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                  {/* Template Dropdown */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={templateFilter}
                      onChange={(e) => {
                        setTemplateFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl pl-2.5 pr-6 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] appearance-none cursor-pointer hover:border-slate-300 transition-colors max-w-[130px] truncate"
                    >
                      <option value="ALL">Template</option>
                      {templates.map((tpl) => (
                        <option key={tpl._id || tpl.twilioTemplateId} value={tpl.twilioTemplateId || tpl._id}>
                          {tpl.name || tpl.title || tpl.twilioTemplateId}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>

                </div>

                {/* Active Filter Count & Clear */}
                {activeFilterCount > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#00a884] bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a884]" /> {activeFilterCount} {activeFilterCount === 1 ? "Filter" : "Filters"}
                    </span>
                    <button
                      type="button"
                      onClick={resetAllFilters}
                      className="text-[11px] font-medium text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Active Filter Chips Bar */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {statusFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg">
                      {statusFilter === "COMPLETED" ? "Completed" : statusFilter === "PROCESSING" ? "Processing" : statusFilter === "FAILED" ? "Failed" : statusFilter}
                      <X size={11} className="cursor-pointer hover:text-rose-600 transition-colors" onClick={() => setStatusFilter("ALL")} />
                    </span>
                  )}
                  {dateFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg">
                      {getDateFilterLabel(dateFilter)}
                      <X size={11} className="cursor-pointer hover:text-rose-600 transition-colors" onClick={() => setDateFilter("ALL")} />
                    </span>
                  )}
                  {senderFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg">
                      {getSenderFilterLabel(senderFilter)}
                      <X size={11} className="cursor-pointer hover:text-rose-600 transition-colors" onClick={() => setSenderFilter("ALL")} />
                    </span>
                  )}
                  {templateFilter !== "ALL" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg">
                      {getTemplateFilterLabel(templateFilter)}
                      <X size={11} className="cursor-pointer hover:text-rose-600 transition-colors" onClick={() => setTemplateFilter("ALL")} />
                    </span>
                  )}
                  {historySearch.trim() && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200/80 rounded-lg">
                      &ldquo;{historySearch}&rdquo;
                      <X size={11} className="cursor-pointer hover:text-rose-600 transition-colors" onClick={() => setHistorySearch("")} />
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="text-xs font-bold text-[#00a884] hover:underline cursor-pointer ml-1"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Campaign List */}
              {filteredCampaigns.length === 0 ? (
                <div className="border border-slate-100 rounded-xl p-8 text-center space-y-1.5 bg-slate-50/50">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/60 flex items-center justify-center text-slate-400 mx-auto">
                    <Send size={15} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-700">
                    {campaigns.length === 0 ? "No campaigns yet" : "No matching campaigns found"}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {campaigns.length === 0
                      ? "Your sent campaigns will appear here."
                      : "Try adjusting your search terms or active filters."}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-100 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
                  {currentCampaigns.map((camp) => {
                    const total = camp.totalRecipients || camp.recipients?.length || 0;
                    const successful = camp.successfulSends || 0;
                    const delivered = camp.deliveredCount || 0;
                    const read = camp.readCount || 0;
                    const failed = camp.failedSends || 0;
                    const undelivered = camp.undeliveredCount || 0;
                    const skipped = camp.skippedCount || 0;
                    const completed = successful + failed + skipped;
                    const calcPct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
                    const isExpanded = expandedCampaigns.has(camp._id);

                    const statusStr = (camp.status || "processing").toUpperCase();
                    let badgeClass = "bg-amber-50 text-amber-800 border-amber-200/80";
                    if (statusStr === "COMPLETED" || statusStr === "SENT" || statusStr === "ACTIVE") {
                      badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200/80";
                    } else if (statusStr === "FAILED") {
                      badgeClass = "bg-rose-50 text-rose-800 border-rose-200/80";
                    } else if (statusStr === "PARTIAL") {
                      badgeClass = "bg-purple-50 text-purple-800 border-purple-200/80";
                    }

                    const dateObj = new Date(camp.createdAt);
                    const formattedDate = dateObj.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    });
                    const formattedTime = dateObj.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    });

                    return (
                      <div
                        key={camp._id}
                        className={`transition-all duration-200 ${
                          isExpanded ? "bg-slate-50/40" : "hover:bg-slate-50/70"
                        }`}
                      >
                        {/* Collapsed Row (Clickable) */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleExpandCampaign(camp._id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleExpandCampaign(camp._id);
                            }
                          }}
                          className="w-full flex items-center justify-between p-3.5 sm:px-4 sm:py-3.5 cursor-pointer select-none group min-h-[64px]"
                        >
                          {/* Left: Message Icon + Campaign Title + Status Pill */}
                          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 pr-3">
                            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-[#00a884] flex items-center justify-center shrink-0 border border-emerald-100/60">
                              <Mail size={15} />
                            </div>
                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                              <h3
                                className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-[#00a884] transition-colors truncate max-w-[160px] sm:max-w-[220px] xl:max-w-xs"
                                title={camp.campaignName}
                              >
                                {camp.campaignName}
                              </h3>
                              <span
                                className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${badgeClass}`}
                              >
                                {camp.status || "processing"}
                              </span>
                            </div>
                          </div>

                          {/* Right: Date & Time + Chevron */}
                          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                            <span className="text-[11px] sm:text-xs text-slate-500 font-medium whitespace-nowrap hidden sm:inline-block">
                              {formattedDate}, {formattedTime}
                            </span>
                            <div className="w-5 h-5 flex items-center justify-center text-slate-400 group-hover:text-slate-700 transition-colors">
                              <ChevronRight
                                size={15}
                                className={`transition-transform duration-200 ${
                                  isExpanded ? "rotate-90 text-[#00a884]" : ""
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Expanded Area: Complete Campaign Analytics, Recipient Management & Recall Actions */}
                        {isExpanded && (
                          <div className="px-3.5 pb-4 sm:px-5 sm:pb-5 pt-1.5 border-t border-slate-100 space-y-3.5 bg-white animate-in fade-in duration-200">
                            {/* Mobile date if hidden above */}
                            <div className="sm:hidden flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100">
                              <span className="font-bold">Sent On</span>
                              <span>{formattedDate}, {formattedTime}</span>
                            </div>

                            {camp.sourceCampaignName && (
                              <div className="flex items-center gap-2 bg-indigo-50/70 border border-indigo-100 text-indigo-800 text-xs px-3 py-1.5 rounded-xl font-medium">
                                <RefreshCw size={12} className="text-indigo-600 shrink-0" />
                                <span>Recalled from previous campaign: <strong>{camp.sourceCampaignName}</strong></span>
                              </div>
                            )}

                            {/* Analytics Statistics Panel (7 Metrics) */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-1.5 text-center">
                              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2">
                                <span className="text-[9px] font-bold uppercase text-slate-400 block tracking-wider">Recipients</span>
                                <span className="text-xs sm:text-sm font-black text-slate-800 font-mono">{total}</span>
                              </div>
                              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-2">
                                <span className="text-[9px] font-bold uppercase text-emerald-700 block tracking-wider">Sent</span>
                                <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono">{successful}</span>
                              </div>
                              <div className="bg-teal-50/50 border border-teal-100 rounded-xl p-2">
                                <span className="text-[9px] font-bold uppercase text-teal-700 block tracking-wider">Delivered</span>
                                <span className="text-xs sm:text-sm font-black text-teal-700 font-mono">{delivered}</span>
                              </div>
                              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-2">
                                <span className="text-[9px] font-bold uppercase text-blue-700 block tracking-wider">Read</span>
                                <span className="text-xs sm:text-sm font-black text-blue-700 font-mono">{read}</span>
                              </div>
                              <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-2">
                                <span className="text-[9px] font-bold uppercase text-rose-700 block tracking-wider">Failed</span>
                                <span className="text-xs sm:text-sm font-black text-rose-700 font-mono">{failed}</span>
                              </div>
                              <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-2">
                                <span className="text-[9px] font-bold uppercase text-amber-700 block tracking-wider">Undelivered</span>
                                <span className="text-xs sm:text-sm font-black text-amber-700 font-mono">{undelivered}</span>
                              </div>
                              <div className="bg-slate-100/60 border border-slate-200 rounded-xl p-2">
                                <span className="text-[9px] font-bold uppercase text-slate-500 block tracking-wider">Skipped</span>
                                <span className="text-xs sm:text-sm font-black text-slate-600 font-mono">{skipped}</span>
                              </div>
                            </div>

                            {/* Delivery Progress Bar */}
                            <div className="space-y-1 bg-slate-50/60 border border-slate-200/60 rounded-xl p-2.5">
                              <div className="flex justify-between items-center text-[11px] font-bold text-slate-600">
                                <span>Delivery Progress</span>
                                <span className="font-mono text-[#00a884]">{calcPct}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-emerald-500 to-[#00a884] transition-all duration-300"
                                  style={{ width: `${calcPct}%` }}
                                />
                              </div>
                            </div>

                            {/* Action Buttons & Copy Tools */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRecipientsModal(camp);
                                  }}
                                  className="py-1.5 px-3 rounded-xl bg-[#00a884] hover:bg-[#009374] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                                >
                                  <Eye size={12} /> View Recipients
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenRecallModal(camp);
                                  }}
                                  className="py-1.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                                  title="Recall only verified successful numbers"
                                >
                                  <RefreshCw size={11} /> Recall
                                </button>
                              </div>

                              <div className="flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyNumbersFromCampaign(camp._id, "SUCCESSFUL");
                                  }}
                                  className="py-1 px-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Copy size={10} /> Copy Successful
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyNumbersFromCampaign(camp._id, "FAILED");
                                  }}
                                  className="py-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Copy size={10} /> Copy Failed
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyNumbersFromCampaign(camp._id, "ALL");
                                  }}
                                  className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                                >
                                  <Copy size={10} /> Copy All
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteCampaign(camp._id, camp.campaignName);
                                    }}
                                    disabled={isDeleting === camp._id}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                    title="Delete Campaign Record"
                                  >
                                    {isDeleting === camp._id ? (
                                      <Loader2 size={12} className="animate-spin text-rose-500" />
                                    ) : (
                                      <Trash2 size={12} />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Broadcast History Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
                {/* Left: Summary & Rows Per Page */}
                <div className="flex items-center gap-3 text-slate-500 font-medium w-full sm:w-auto justify-between sm:justify-start">
                  <span>
                    Showing <strong className="text-slate-800 font-mono">{startCampaignIdx}–{endCampaignIdx}</strong> of{" "}
                    <strong className="text-slate-800 font-mono">{totalCampaigns}</strong> campaigns
                  </span>
                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                    <span className="text-[11px] text-slate-400">Rows:</span>
                    <select
                      value={campaignsPerPage}
                      onChange={(e) => handleCampaignsPerPageChange(e.target.value)}
                      className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#00a884] cursor-pointer"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                {/* Right: Dynamic Numeric Page Navigation */}
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Previous Page"
                    >
                      ‹
                    </button>

                    {getPaginationRange(currentPage, totalPages).map((p, i) =>
                      p === "..." ? (
                        <span key={`dots-${i}`} className="px-1.5 py-1 text-slate-400 font-mono">
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCurrentPage(p)}
                          className={`min-w-[28px] px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            currentPage === p
                              ? "bg-[#00a884] text-white shadow-xs"
                              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Next Page"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* VIEW RECIPIENTS MODAL */}
      {activeRecipientCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-800">
                    {activeRecipientCampaign.campaignName}
                  </h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {recipientPagination.total} recipient{recipientPagination.total === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-medium">
                  Live delivery lifecycle & external Twilio status logs
                </p>
              </div>
              <button
                onClick={() => setActiveRecipientCampaign(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Actions & Filters Bar */}
            <div className="p-4 border-b border-slate-100 bg-white space-y-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search phone or SID..."
                    value={recipientSearch}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] text-slate-800 placeholder-slate-400"
                  />
                </div>

                {/* Copy Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                  <button
                    type="button"
                    onClick={() => handleCopyNumbers("SUCCESSFUL")}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all shadow-xs cursor-pointer"
                  >
                    <Copy size={11} /> Copy Successful
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyNumbers("FAILED")}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all shadow-xs cursor-pointer"
                  >
                    <Copy size={11} /> Copy Failed
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyNumbers("ALL")}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-extrabold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-all shadow-xs cursor-pointer"
                  >
                    <Copy size={11} /> Copy All
                  </button>
                </div>
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar text-[11px] font-bold">
                {[
                  { id: "ALL", label: `All (${recipientCounts.all || 0})` },
                  { id: "SUCCESSFUL", label: `Successful (${recipientCounts.successful || 0})` },
                  { id: "SENT", label: `Sent (${recipientCounts.sent || 0})` },
                  { id: "DELIVERED", label: `Delivered (${recipientCounts.delivered || 0})` },
                  { id: "READ", label: `Read (${recipientCounts.read || 0})` },
                  { id: "FAILED", label: `Failed (${recipientCounts.failed || 0})` },
                  { id: "UNDELIVERED", label: `Undelivered (${recipientCounts.undelivered || 0})` },
                  { id: "SKIPPED", label: `Skipped (${recipientCounts.skipped || 0})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleFilterChange(tab.id)}
                    className={`px-3 py-1 rounded-xl transition-all whitespace-nowrap border cursor-pointer ${
                      recipientFilter === tab.id
                        ? "bg-[#00a884] text-white border-[#00a884] shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient List / Table */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {isFetchingRecipients ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-2">
                  <Loader2 size={24} className="animate-spin text-[#00a884]" />
                  <span className="text-xs font-bold">Fetching recipient records...</span>
                </div>
              ) : recipientsList.length === 0 ? (
                <div className="text-center py-16 text-slate-400 space-y-1">
                  <Info size={20} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">No recipients match the selected filter</p>
                  <p className="text-[11px]">Try switching filters or adjusting your search</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recipientsList.map((rec) => {
                    const statusVal = rec.status?.toUpperCase();
                    let badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
                    let icon = <Clock size={11} />;

                    if (statusVal === "DELIVERED") {
                      badgeClass = "bg-emerald-50 text-emerald-800 border-emerald-200";
                      icon = <CheckCircle2 size={11} />;
                    } else if (statusVal === "READ") {
                      badgeClass = "bg-blue-50 text-blue-800 border-blue-200";
                      icon = <CheckCircle2 size={11} />;
                    } else if (statusVal === "SENT") {
                      badgeClass = "bg-teal-50 text-teal-800 border-teal-200";
                      icon = <CheckCircle2 size={11} />;
                    } else if (statusVal === "FAILED" || statusVal === "UNDELIVERED") {
                      badgeClass = "bg-rose-50 text-rose-800 border-rose-200";
                      icon = <AlertCircle size={11} />;
                    } else if (statusVal === "SKIPPED") {
                      badgeClass = "bg-slate-100 text-slate-500 border-slate-200";
                      icon = <X size={11} />;
                    }

                    const displayNum = rec.normalizedPhone
                      ? rec.normalizedPhone.replace("whatsapp:", "")
                      : rec.phone;

                    return (
                      <div
                        key={rec._id}
                        className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all shadow-2xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-extrabold text-xs text-slate-800">
                              {displayNum}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${badgeClass}`}
                            >
                              {icon} {statusVal}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopySingleNumber(displayNum)}
                              className="p-1 rounded-md text-slate-400 hover:text-[#00a884] hover:bg-emerald-50 transition-colors cursor-pointer"
                              title="Copy Phone Number"
                            >
                              <Copy size={11} />
                            </button>
                          </div>

                          {rec.errorMessage && (
                            <p className="text-[11px] font-semibold text-rose-600">
                              {rec.errorCode ? `Error ${rec.errorCode}: ` : ""}
                              {rec.errorMessage}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                          {rec.twilioMessageSid && (
                            <span
                              className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200/60 truncate max-w-[140px]"
                              title={rec.twilioMessageSid}
                            >
                              {rec.twilioMessageSid}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            {new Date(rec.updatedAt || rec.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Pagination Footer */}
            {(() => {
              const recTotal = recipientPagination.total || 0;
              const recStart = recTotal > 0 ? (recipientPage - 1) * recipientLimit + 1 : 0;
              const recEnd = Math.min(recTotal, recipientPage * recipientLimit);
              const recTotalPages = recipientPagination.totalPages || 1;

              return (
                <div className="p-3.5 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  {/* Left: Summary & Rows per page */}
                  <div className="flex items-center gap-3 text-slate-500 font-medium w-full sm:w-auto justify-between sm:justify-start">
                    <span>
                      Showing <strong className="text-slate-800 font-mono">{recStart}–{recEnd}</strong> of{" "}
                      <strong className="text-slate-800 font-mono">{recTotal}</strong> recipients
                    </span>
                    <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
                      <span className="text-[11px] text-slate-400">Rows:</span>
                      <select
                        value={recipientLimit}
                        onChange={(e) => handleRecipientLimitChange(e.target.value)}
                        className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#00a884] cursor-pointer"
                      >
                        <option value={20}>20</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>
                    </div>
                  </div>

                  {/* Right: Dynamic Numeric Page Navigation */}
                  {recTotalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleRecipientPageChange(recipientPage - 1)}
                        disabled={recipientPage === 1}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Previous Page"
                      >
                        ‹
                      </button>

                      {getPaginationRange(recipientPage, recTotalPages).map((p, i) =>
                        p === "..." ? (
                          <span key={`rec-dots-${i}`} className="px-1.5 py-1 text-slate-400 font-mono">
                            …
                          </span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handleRecipientPageChange(p)}
                            className={`min-w-[28px] px-2 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              recipientPage === p
                                ? "bg-[#00a884] text-white shadow-xs"
                                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {p}
                          </button>
                        )
                      )}

                      <button
                        type="button"
                        onClick={() => handleRecipientPageChange(recipientPage + 1)}
                        disabled={recipientPage === recTotalPages}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Next Page"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* SMART RECALL CONFIRMATION MODAL */}
      {recallModalCampaign && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0">
                <RefreshCw size={18} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-800">Recall Successful Recipients</h3>
                <p className="text-xs text-slate-400 font-medium">Exclude failed & skipped contacts automatically</p>
              </div>
            </div>

            {isFetchingRecall ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Loader2 size={20} className="animate-spin text-indigo-600" />
                <span className="text-xs font-bold">Analyzing campaign statistics...</span>
              </div>
            ) : recallData ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-600 leading-relaxed">
                  You are preparing a smart recall for{" "}
                  <span className="font-black text-slate-800">&quot;{recallData.sourceCampaignName}&quot;</span>.
                </p>

                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 size={13} /> Successful (Sent / Delivered / Read)
                    </span>
                    <span className="font-mono text-emerald-700">{recallData.counts.successful}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-rose-600">
                      <AlertCircle size={13} /> Failed / Undelivered (Excluded)
                    </span>
                    <span className="font-mono text-rose-600">{recallData.counts.failed}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-slate-500">
                      <X size={13} /> Opted-out / Skipped (Excluded)
                    </span>
                    <span className="font-mono text-slate-500">{recallData.counts.skipped}</span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 bg-indigo-50/60 border border-indigo-100 rounded-xl p-3">
                  Only the <span className="font-bold text-indigo-700">{recallData.counts.successful} successful recipients</span> will be loaded into the launch workspace.
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRecallModalCampaign(null);
                  setRecallData(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isFetchingRecall || !recallData || recallData.counts.successful === 0}
                onClick={handleConfirmRecall}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider transition-all shadow-sm"
              >
                Recall {recallData?.counts.successful || 0} Recipients
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEMPLATE MANAGER SLIDEOVER */}
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
