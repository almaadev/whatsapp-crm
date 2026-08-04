"use client";
import { useState, useEffect, useMemo, Fragment } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePathStore } from "@/features/chat/stores/pathStore";
import { leadRepository } from "@/shared/api/repositories/leadRepository";
import { useAuth } from "@/shared/hooks/useAuth";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import DashboardPage from "@/shared/components/layout/DashboardPage";
import LoadingScreen from "@/shared/components/ui/LoadingScreen";
import SearchInput from "@/shared/components/ui/SearchInput";
import Pagination from "@/shared/components/ui/Pagination";
import Button from "@/shared/components/ui/Button";
import EmptyState from "@/shared/components/ui/EmptyState";
import { branchService } from "@/features/branches/services/branchService";
import { userRepository } from "@/shared/api/repositories/userRepository";
import { resolveCustomerDisplayName } from "@/shared/utils/customerResolver";
import { connectSocket } from "@/features/chat/services/socketService";
import {
  Save,
  User,
  Phone,
  MapPin,
  Tag,
  FileText,
  AlertCircle,
  Loader2,
  X,
  Plus,
  RefreshCcw,
  Flag,
  ChevronDown,
  ChevronUp,
  History,
  UserCircle,
  Clock,
  TrendingUp,
  CornerDownRight,
  Copy,
  Check,
  MoreVertical,
  Paperclip,
  Calendar,
  Building,
  Activity,
  Layers,
  FileSpreadsheet,
  Settings,
  ChevronRight
} from "lucide-react";
import { toast } from "react-toastify";

export default function LeadsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user, isLoading, isAdmin, hasModuleAccess } = useAuth();
  const role = user?.role || session?.user?.role;
  const { setPath } = usePathStore();
  const pathname = usePathname();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchingLeads, setFetchingLeads] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedPhone, setCopiedPhone] = useState(null);

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // --- Filter states ---
  const [filterLeadType, setFilterLeadType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssociate, setFilterAssociate] = useState("all");

  const [availableBranches, setAvailableBranches] = useState([]);
  const [allAssociatesList, setAllAssociatesList] = useState([]);

  // --- Sorting State ---
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // --- Expanded Row State (Only one expanded at a time) ---
  const [expandedLeadId, setExpandedLeadId] = useState(null);

  const [formData, setFormData] = useState({
    phone: "",
    name: "",
    city: "",
    address: "",
    source: "Manual Entry",
    enquiredFor: "",
    priority: "Medium",
    status: "New",
    remarks: "",
  });

  const [paginatedLeads, setPaginatedLeads] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const fetchRecentLeads = async (silent = false) => {
    if (!silent) setFetchingLeads(true);
    try {
      const query = new URLSearchParams({ page: currentPage, limit: pageSize });
      if (searchTerm) query.append("search", searchTerm);

      const { data } = await leadRepository.getLeads({ params: Object.fromEntries(query) });
      setPaginatedLeads(data.leads || []);
      setTotalPages(data.totalPages || 1);
      setTotalRecords(data.total || 0);
    } catch (err) {
      console.error("Error fetching leads:", err);
      if (!silent) toast.error("Failed to sync leads database.");
    } finally {
      if (!silent) setFetchingLeads(false);
    }
  };

  useEffect(() => {
    fetchRecentLeads();
  }, [currentPage, pageSize, searchTerm]);

  // Real-time socket updates for leads pipeline
  useEffect(() => {
    if (!hasModuleAccess("Leads")) return;
    const socket = connectSocket();

    const handleRealtimeLeadUpdate = () => {
      console.log("⚡ [LeadsPage] Real-time lead update received. Refreshing list silently...");
      fetchRecentLeads(true);
    };

    socket.on("lead_status_update", handleRealtimeLeadUpdate);
    socket.on("lead_status_changed", handleRealtimeLeadUpdate);
    socket.on("followup_added", handleRealtimeLeadUpdate);
    socket.on("customer_updated", handleRealtimeLeadUpdate);
    socket.on("customer_branch_updated", handleRealtimeLeadUpdate);
    socket.on("new_message", handleRealtimeLeadUpdate);

    return () => {
      socket.off("lead_status_update", handleRealtimeLeadUpdate);
      socket.off("lead_status_changed", handleRealtimeLeadUpdate);
      socket.off("followup_added", handleRealtimeLeadUpdate);
      socket.off("customer_updated", handleRealtimeLeadUpdate);
      socket.off("customer_branch_updated", handleRealtimeLeadUpdate);
      socket.off("new_message", handleRealtimeLeadUpdate);
    };
  }, [hasModuleAccess, currentPage, pageSize, searchTerm]);

  // Load configuration for branch and associate filter dropdowns
  useEffect(() => {
    async function loadConfig() {
      try {
        const branchRes = await branchService.getBranches({ limit: 1000 });
        if (branchRes && branchRes.success) {
          setAvailableBranches(branchRes.branches || []);
        }
        if (isAdmin) {
          const userRes = await userRepository.getUsers();
          if (userRes && userRes.data) {
            setAllAssociatesList(userRes.data || []);
          }
        }
      } catch (err) {
        console.error("Failed to load filter setup config:", err);
      }
    }
    if (hasModuleAccess("Leads")) {
      loadConfig();
    }
  }, [isLoading, isAdmin]);

  // Reset pagination when search query or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const handleCustomerRedirect = (phone) => {
    setPath(pathname);
    router.push(`/crm/leads/${phone.replace("whatsapp:", "")}`);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCopyPhone = (e, phone) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
    toast.success("Phone number copied!");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!formData.phone) {
      toast.error("Phone number is required");
      setLoading(false);
      return;
    }

    try {
      const { data } = await leadRepository.createLead({
        ...formData,
        overAllRemarks: formData.remarks,
        date: new Date().toISOString(),
      });

      toast.success("Lead created successfully!");
      fetchRecentLeads();
      setFormData({
        phone: "",
        name: "",
        city: "",
        source: "Manual Entry",
        enquiredFor: "",
        priority: "Medium",
        status: "New",
        remarks: "",
      });
      setShowCreateForm(false);
    } catch (error) {
      console.error("Error creating lead:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering of results loaded on current page
  const filteredLeads = useMemo(() => {
    return paginatedLeads.filter((lead) => {
      if (filterStatus !== "all" && (lead.status || "New") !== filterStatus) return false;
      if (filterLeadType !== "all" && (lead.leadType || "Direct Lead") !== filterLeadType) return false;
      if (filterAssociate !== "all" && lead.assignedTo !== filterAssociate) return false;
      return true;
    });
  }, [paginatedLeads, filterStatus, filterLeadType, filterAssociate]);

  // Client-side sorting
  const sortedLeads = useMemo(() => {
    const list = [...filteredLeads];
    list.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === "customerName") {
        valA = a.name || a.phone || "";
        valB = b.name || b.phone || "";
      } else if (sortBy === "closures") {
        valA = a.leads?.filter(l => l.status === "Closed").length || 0;
        valB = b.leads?.filter(l => l.status === "Closed").length || 0;
      } else if (sortBy === "followups") {
        valA = a.leads?.filter(l => l.status === "Follow Up").length || 0;
        valB = b.leads?.filter(l => l.status === "Follow Up").length || 0;
      } else if (sortBy === "lastActivity") {
        valA = a.lastActivityDate || a.updatedAt || a.createdAt || "";
        valB = b.lastActivityDate || b.updatedAt || b.createdAt || "";
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredLeads, sortBy, sortOrder]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const isAuthorized = hasModuleAccess("Leads");

  if (status === "loading" || isLoading) {
    return <LoadingScreen />;
  }

  if (!user && !session) return null;

  if (!isAuthorized) {
    return (
      <AccessDenied message="You do not have permission to access Customer Leads." />
    );
  }

  return (
    <DashboardPage
      title="Customer Leads"
      subtitle="Manage and track customer leads, their interactions, and sales progress."
      maxWidth="1800px"
    >
      {/* ENTERPRISE CRM TOOLBAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 mb-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-56"
          />

          <div className="h-6 w-px bg-slate-800 hidden md:block"></div>

          <select
            value={filterLeadType}
            onChange={(e) => setFilterLeadType(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884]"
          >
            <option value="all">All Lead Types</option>
            <option value="Direct Lead">Direct Lead</option>
            <option value="MD Camp">MD Camp</option>
            <option value="Product Lead">Product Lead</option>
            <option value="Therapy">Therapy</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884]"
          >
            <option value="all">All Statuses</option>
            <option value="New">New</option>
            <option value="Follow Up">Follow Up</option>
            <option value="Closed">Closed</option>
            <option value="Not Interested">Not Interested</option>
          </select>

          {isAdmin && (
            <select
              value={filterAssociate}
              onChange={(e) => setFilterAssociate(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884] max-w-[150px]"
            >
              <option value="all">All Associates</option>
              {allAssociatesList.map((assoc) => (
                <option key={assoc.id || assoc._id} value={assoc.name}>{assoc.name}</option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="icon"
            onClick={fetchRecentLeads}
            disabled={fetchingLeads}
            title="Refresh Pipeline"
            className="bg-slate-800 border-slate-750 hover:bg-slate-750 text-slate-350"
          >
            <RefreshCcw
              size={15}
              className={fetchingLeads ? "animate-spin" : ""}
            />
          </Button>
          <Button onClick={() => setShowCreateForm(true)} className="bg-[#00a884] hover:bg-[#008f70] text-white">
            <Plus size={16} /> <span className="hidden sm:inline">New Lead</span>
          </Button>
        </div>
      </div>

      {fetchingLeads && sortedLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 bg-white border border-slate-200 rounded-xl shadow-sm">
          <Loader2 size={32} className="animate-spin mb-3 text-[#00a884]" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            Syncing Leads Database...
          </span>
        </div>
      ) : sortedLeads.length === 0 ? (
        <EmptyState icon={History} title="No leads found in the pipeline." />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          
          {/* DESKTOP TABLE VIEW */}
          <div className="overflow-x-auto overflow-y-auto max-h-[680px] hidden md:block">
            <table className="w-full text-left border-collapse min-w-[1550px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-50 z-10 shadow-[inset_0_-1px_0_rgba(229,231,235,1)] select-none">
                  <th className="py-3 px-3.5 w-10"></th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("customerName")}>
                    Customer {sortBy === "customerName" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3">Phone</th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("city")}>
                    City {sortBy === "city" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("leadType")}>
                    Lead Type {sortBy === "leadType" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("status")}>
                    Current Status {sortBy === "status" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("assignedTo")}>
                    Assigned To {sortBy === "assignedTo" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3">Last Handler</th>
                  <th className="py-3 px-3 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("followups")}>
                    Follow Ups {sortBy === "followups" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3 text-center cursor-pointer hover:bg-slate-100" onClick={() => handleSort("closures")}>
                    Closures {sortBy === "closures" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("lastActivity")}>
                    Last Activity {sortBy === "lastActivity" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3 cursor-pointer hover:bg-slate-100" onClick={() => handleSort("createdAt")}>
                    Created {sortBy === "createdAt" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-4 text-center w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs font-semibold text-slate-700">
                {sortedLeads.map((lead) => {
                  const leadId = lead._id;
                  const isExpanded = expandedLeadId === leadId;
                  const displayName = resolveCustomerDisplayName(lead);
                  const cleanPhone = lead.phone?.replace("whatsapp:", "") || "";
                  const displayCity = lead.city || "-";
                  const leadType = lead.leadType || "Direct Lead";
                  const leadStatus = lead.status || "New";
                  const assignedTo = lead.assignedTo || "unassigned";
                  const lastHandler = lead.leads && lead.leads.length > 0 ? lead.leads[lead.leads.length - 1].associateName : (lead.assignedTo || "unassigned");
                  const followUpCount = lead.leads?.filter(l => l.status === "Follow Up").length || 0;
                  const closureCount = lead.leads?.filter(l => l.status === "Closed").length || 0;
                  const lastActivity = lead.lastActivityDate || lead.updatedAt || lead.createdAt;
                  const createdDate = lead.createdAt;

                  return (
                    <Fragment key={leadId}>
                      <tr className={`h-12 border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer ${isExpanded ? "bg-slate-50/30" : ""}`} onClick={() => setExpandedLeadId(isExpanded ? null : leadId)}>
                        <td className="py-3 px-3.5 text-center">
                          <span className={`inline-block text-slate-400 p-0.5 rounded transition-transform duration-200 ${isExpanded ? "rotate-90 text-[#00a884]" : ""}`}>
                            <ChevronRight size={13} />
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6.5 h-6.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px] border border-emerald-100 uppercase">
                              {displayName.charAt(0)}
                            </div>
                            <span>{displayName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-550 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1.5">
                            <span>{cleanPhone}</span>
                            <button
                              onClick={(e) => handleCopyPhone(e, cleanPhone)}
                              className="text-slate-400 hover:text-[#00a884] transition-colors p-0.5"
                              title="Copy Phone"
                            >
                              {copiedPhone === cleanPhone ? (
                                <Check size={11} className="text-[#00a884]" />
                              ) : (
                                <Copy size={11} />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">{displayCity}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 border border-slate-200 text-slate-600">
                            {leadType}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyles(leadStatus)}`}>
                            {leadStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-bold text-[#00a884] whitespace-nowrap">{assignedTo}</td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">{lastHandler}</td>
                        <td className="py-3 px-3 text-center font-bold whitespace-nowrap text-slate-650">{followUpCount}</td>
                        <td className="py-3 px-3 text-center font-bold whitespace-nowrap text-slate-650">{closureCount}</td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {lastActivity ? new Date(lastActivity).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {createdDate ? new Date(createdDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "-"}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex gap-1.5">
                            <button
                              onClick={() => handleCustomerRedirect(lead.phone)}
                              className="inline-flex items-center gap-0.5 bg-[#00a884] hover:bg-[#008f70] text-white font-bold py-0.5 px-2 rounded text-[10px] transition-colors shadow-sm cursor-pointer"
                            >
                              See More
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* DETAILED COLLAPSIBLE DRAWER */}
                      {isExpanded && (
                        <tr className="bg-slate-50/40">
                          <td colSpan="13" className="p-0">
                            <ExpandedDetailsArea lead={lead} handleCustomerRedirect={handleCustomerRedirect} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE RESPONSIVE CARDS VIEW */}
          <div className="grid grid-cols-1 gap-3.5 p-4 md:hidden">
            {sortedLeads.map((lead) => {
              const leadId = lead._id;
              const isExpanded = expandedLeadId === leadId;
              const displayName = resolveCustomerDisplayName(lead);
              const cleanPhone = lead.phone?.replace("whatsapp:", "") || "";
              const leadStatus = lead.status || "New";

              return (
                <div key={leadId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="p-4 flex items-center justify-between cursor-pointer" onClick={() => setExpandedLeadId(isExpanded ? null : leadId)}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-100 uppercase">
                        {displayName.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm leading-tight">{displayName}</h4>
                        <span className="font-mono text-slate-550 text-xs mt-0.5 block">{cleanPhone}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusBadgeStyles(leadStatus)}`}>
                        {leadStatus}
                      </span>
                      <span className={`text-slate-400 p-1 transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}>
                        <ChevronRight size={14} />
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50">
                      <ExpandedDetailsArea lead={lead} handleCustomerRedirect={handleCustomerRedirect} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Footer */}
          <div className="border-t border-slate-200">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={totalRecords}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </div>
      )}

      {showCreateForm && (
        <CreateLeadModal
          formData={formData}
          handleChange={handleChange}
          handleSubmit={handleSubmit}
          setShowCreateForm={setShowCreateForm}
          loading={loading}
        />
      )}
    </DashboardPage>
  );
}

// Sub-component for expanded detail drawer tabs
function ExpandedDetailsArea({ lead, handleCustomerRedirect }) {
  const [activeTab, setActiveTab] = useState("timeline");

  const timeline = useMemo(() => {
    return [...(lead.leads || [])].reverse();
  }, [lead.leads]);

  const historyProgression = useMemo(() => {
    // Construct progression chronologically
    return [...(lead.leads || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [lead.leads]);

  const remarks = useMemo(() => {
    return lead.leads?.filter(l => l.overAllRemarks || l.note) || [];
  }, [lead.leads]);

  const followUpCount = lead.leads?.filter(l => l.status === "Follow Up").length || 0;
  const closureCount = lead.leads?.filter(l => l.status === "Closed").length || 0;

  return (
    <div className="border-l-4 border-[#00a884] bg-white p-4 md:p-6 shadow-inner text-slate-800">
      
      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200 pb-2 mb-4 gap-2 overflow-x-auto select-none">
        {["timeline", "details", "remarks", "history", "attachments"].map((tab) => {
          const labels = {
            timeline: "Interaction Timeline",
            details: "Customer Details",
            remarks: "Remarks & Notes",
            history: "Handling History",
            attachments: "Attachments"
          };
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-1.5 px-3.5 text-xs font-bold rounded-lg cursor-pointer whitespace-nowrap transition-all uppercase tracking-wider ${
                isActive
                  ? "bg-[#00a884]/10 text-[#00a884] border border-[#00a884]/20"
                  : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {labels[tab]}
            </button>
          );
        })}
        
        <button
          onClick={() => handleCustomerRedirect(lead.phone)}
          className="ml-auto py-1 px-3 bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
        >
          See More Profile <Plus size={11} />
        </button>
      </div>

      {/* Tab content area */}
      <div className="mt-4">
        
        {/* TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No interaction timeline recorded for this lead.</p>
            ) : (
              timeline.map((item, idx) => (
                <div key={item._id || idx} className="flex gap-3 items-start bg-slate-50 border border-slate-200/80 rounded-xl p-3 shadow-sm hover:border-[#00a884]/20 transition-all">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-650 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-300 uppercase">
                    {(item.associateName || "S").charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-slate-800">{item.associateName || "System Admin"}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${getStatusBadgeStyles(item.status)}`}>
                          {item.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-450 font-semibold">
                        {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {item.enquiredFor && (
                      <p className="text-[11px] text-slate-500 font-bold mt-1">
                        Enquiry: <span className="text-slate-700">{item.enquiredFor}</span>
                      </p>
                    )}

                    {item.overAllRemarks && (
                      <div className="mt-2 text-xs text-slate-600 font-medium italic border-l-2 border-slate-300 pl-2 bg-white/40 py-1.5 pr-2 rounded-r">
                        "{item.overAllRemarks}"
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* CUSTOMER DETAILS TAB */}
        {activeTab === "details" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-2 select-text">
            {[
              { label: "Name", value: lead.name || "Unknown" },
              { label: "Phone", value: lead.phone?.replace("whatsapp:", "") || "-" },
              { label: "City", value: lead.city || "Unknown Location" },
              { label: "Address", value: lead.address || "-" },
              { label: "Lead Type", value: lead.leadType || "Direct Lead" },
              { label: "Enquired For", value: lead.enquiredFor || "-" },
              { label: "Current Status", value: lead.status || "New" },
              { label: "Assigned Associate", value: lead.assignedTo || "unassigned" },
              { label: "Total Follow Ups", value: followUpCount },
              { label: "Total Closures", value: closureCount },
              { label: "Created Date", value: lead.createdAt ? new Date(lead.createdAt).toLocaleString("en-IN") : "-" },
              { label: "Last Updated", value: lead.updatedAt ? new Date(lead.updatedAt).toLocaleString("en-IN") : "-" }
            ].map((field, idx) => (
              <div key={idx} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 shadow-sm">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">{field.label}</span>
                <span className="text-xs font-bold text-slate-800 break-words">{field.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* REMARKS TAB */}
        {activeTab === "remarks" && (
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            {remarks.length === 0 && !lead.remarks ? (
              <p className="text-xs text-slate-400 italic py-4">No remarks or progression notes logged for this customer.</p>
            ) : (
              <>
                {lead.remarks && (
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 shadow-sm">
                    <span className="text-[10px] font-extrabold text-[#00a884] uppercase tracking-wider block mb-1">Initial Lead Remarks</span>
                    <p className="text-xs text-slate-700 font-medium italic">"{lead.remarks}"</p>
                  </div>
                )}
                {remarks.map((item, idx) => (
                  <div key={idx} className="bg-slate-50 border border-slate-250 rounded-xl p-3.5 shadow-sm">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                        Handled by <span className="text-slate-800">{item.associateName}</span>
                      </span>
                      <span className="text-[10px] text-slate-450 font-bold">
                        {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium leading-relaxed italic">"{item.overAllRemarks || item.note}"</p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* HANDLING HISTORY TAB */}
        {activeTab === "history" && (
          <div className="p-4 flex flex-col items-start gap-4 max-h-[350px] overflow-y-auto custom-scrollbar select-none">
            {historyProgression.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4">No handling history available.</p>
            ) : (
              historyProgression.map((item, idx) => (
                <div key={item._id || idx} className="flex items-center gap-4 w-full">
                  <div className="flex flex-col items-center shrink-0 w-8">
                    <div className="w-8 h-8 rounded-full bg-[#00a884]/10 text-[#00a884] flex items-center justify-center font-bold text-[10px] border border-[#00a884]/20 uppercase">
                      {(item.associateName || "S").charAt(0)}
                    </div>
                    {idx < historyProgression.length - 1 && (
                      <div className="h-6 w-0.5 bg-slate-200 mt-2"></div>
                    )}
                  </div>
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-2.5 flex-1 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <h5 className="font-extrabold text-xs text-slate-800">{item.associateName || "System Admin"}</h5>
                      <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                        {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${getStatusBadgeStyles(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ATTACHMENTS (FUTURE READY) */}
        {activeTab === "attachments" && (
          <div className="border border-dashed border-slate-300 bg-slate-50/50 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <Paperclip className="text-slate-350 mb-2.5" size={28} />
            <h5 className="font-extrabold text-xs text-slate-800 uppercase tracking-widest">Leads Document Vault</h5>
            <p className="text-[10px] text-slate-450 mt-1 max-w-xs leading-normal">Drag and drop therapy prescription sheets, MD camp intake files, or Excel records here. Supporting PDF, JPG, PNG formats up to 10MB.</p>
            <div className="mt-4 flex gap-2">
              <button disabled className="px-3.5 py-1.5 bg-slate-200 text-slate-455 font-black text-[10px] rounded-lg uppercase tracking-wider cursor-not-allowed border border-slate-300">
                Choose File
              </button>
              <button disabled className="px-3.5 py-1.5 bg-slate-200 text-slate-455 font-black text-[10px] rounded-lg uppercase tracking-wider cursor-not-allowed border border-slate-300">
                Upload
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Styles mapping function for lead statuses
function getStatusBadgeStyles(status) {
  switch (status) {
    case "New":
      return "bg-blue-50 text-blue-700 border-blue-100";
    case "Follow Up":
      return "bg-orange-50 text-orange-700 border-orange-100";
    case "Closed":
      return "bg-emerald-50 text-emerald-700 border-emerald-100";
    case "Not Interested":
      return "bg-rose-50 text-rose-700 border-rose-100";
    case "Pending":
      return "bg-amber-50 text-amber-700 border-amber-100";
    case "Reopened":
      return "bg-purple-50 text-purple-700 border-purple-100";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

const DayNote = ({ day, text }) => (
  <div className="bg-white border border-slate-100 rounded-md p-2 shadow-sm">
    <div className="text-[10px] font-extrabold text-[#00a884] uppercase tracking-wider mb-1">
      Day {day} Progression
    </div>
    <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
      {text}
    </p>
  </div>
);

const CreateLeadModal = ({
  formData,
  handleChange,
  handleSubmit,
  setShowCreateForm,
  loading,
}) => (
  <>
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
      onClick={() => setShowCreateForm(false)}
    />
    <div className="fixed inset-y-0 right-0 w-full sm:w-[450px] bg-white z-50 shadow-2xl transform transition-transform duration-300 crm-slide-in-right flex flex-col border-l border-slate-200">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <h2 className="text-lg font-extrabold text-slate-800">
          Inject New Lead
        </h2>
        <button
          onClick={() => setShowCreateForm(false)}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 custom-scrollbar select-none">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Phone size={16} />
                </div>
                <input
                  type="tel"
                  name="phone"
                  placeholder="e.g. 919876543210"
                  value={formData.phone}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium transition-all shadow-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Name
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User size={16} />
                  </div>
                  <input
                    type="text"
                    name="name"
                    placeholder="Full Name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium transition-all shadow-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  City
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <MapPin size={16} />
                  </div>
                  <input
                    type="text"
                    name="city"
                    placeholder="Location"
                    value={formData.city}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Initial Status
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Flag size={16} />
                  </div>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium cursor-pointer appearance-none shadow-sm transition-all"
                  >
                    <option value="New">New</option>
                    <option value="Follow Up">Follow Up</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Priority
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <AlertCircle size={16} />
                  </div>
                  <select
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium cursor-pointer appearance-none shadow-sm transition-all"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Enquired for
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Tag size={16} />
                </div>
                <input
                  type="text"
                  name="enquiredFor"
                  placeholder="e.g., Joint Pain Therapy"
                  value={formData.enquiredFor}
                  onChange={handleChange}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium transition-all shadow-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                Initial Remarks
              </label>
              <div className="relative">
                <div className="absolute left-3 top-3 text-slate-400">
                  <FileText size={16} />
                </div>
                <textarea
                  name="remarks"
                  placeholder="Detailed notes..."
                  value={formData.remarks}
                  onChange={handleChange}
                  rows={3}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] outline-none text-sm font-medium resize-none transition-all shadow-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3 mt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="flex-1 py-3 text-sm rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-[#00a884] text-white text-sm rounded-xl font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-200/50 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Save size={18} /> Inject Lead
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  </>
);
