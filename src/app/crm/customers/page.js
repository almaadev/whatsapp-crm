"use client";

import { useState, useEffect, useMemo, Fragment } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePathStore } from "@/features/chat/stores/pathStore";
import { customerRepository } from "@/shared/api/repositories/customerRepository";
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
import { normalizePhone } from "@/shared/utils/phoneUtils";
import { connectSocket } from "@/features/chat/services/socketService";
import {
  User,
  Phone,
  MapPin,
  Building2,
  Tag,
  FileText,
  AlertCircle,
  Loader2,
  X,
  Plus,
  RefreshCcw,
  History,
  Copy,
  Check,
  Paperclip,
  ChevronRight,
  ArrowRight,
  Globe,
  Users,
  Filter,
} from "lucide-react";
import { toast } from "react-toastify";

export default function CustomersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { user, isLoading, isAdmin, hasModuleAccess } = useAuth();
  const { setPath } = usePathStore();
  const pathname = usePathname();

  const [rawCustomers, setRawCustomers] = useState([]);
  const [fetchingCustomers, setFetchingCustomers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedPhone, setCopiedPhone] = useState(null);

  // --- Pagination State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // --- Filter states ---
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterCreatedBy, setFilterCreatedBy] = useState("all");
  const [filterSource, setFilterSource] = useState("all");

  const [availableBranches, setAvailableBranches] = useState([]);
  const [allUsersList, setAllUsersList] = useState([]);

  // --- Sorting State ---
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // --- Expanded Row State (Only one expanded at a time) ---
  const [expandedCustomerId, setExpandedCustomerId] = useState(null);

  // --- Add Customer Modal State ---
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchCustomers = async (silent = false) => {
    if (!silent) setFetchingCustomers(true);
    try {
      const { data } = await customerRepository.getCustomers();
      if (Array.isArray(data)) {
        setRawCustomers(data);
      }
    } catch (err) {
      console.error("Error fetching customers:", err);
      if (!silent) toast.error("Failed to sync customer directory.");
    } finally {
      if (!silent) setFetchingCustomers(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && hasModuleAccess("Customers")) {
      fetchCustomers();
    }
  }, [status, hasModuleAccess]);

  // Real-time socket updates for customer directory
  useEffect(() => {
    if (!hasModuleAccess("Customers")) return;
    const socket = connectSocket();

    const handleRealtimeUpdate = () => {
      console.log("⚡ [CustomersPage] Real-time customer update received. Refreshing list silently...");
      fetchCustomers(true);
    };

    socket.on("customer_updated", handleRealtimeUpdate);
    socket.on("customer_branch_updated", handleRealtimeUpdate);
    socket.on("lead_status_update", handleRealtimeUpdate);
    socket.on("lead_status_changed", handleRealtimeUpdate);
    socket.on("followup_added", handleRealtimeUpdate);
    socket.on("new_message", handleRealtimeUpdate);

    return () => {
      socket.off("customer_updated", handleRealtimeUpdate);
      socket.off("customer_branch_updated", handleRealtimeUpdate);
      socket.off("lead_status_update", handleRealtimeUpdate);
      socket.off("lead_status_changed", handleRealtimeUpdate);
      socket.off("followup_added", handleRealtimeUpdate);
      socket.off("new_message", handleRealtimeUpdate);
    };
  }, [hasModuleAccess]);

  // Load configuration for branch and user filter dropdowns
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
            setAllUsersList(userRes.data || []);
          }
        }
      } catch (err) {
        console.error("Failed to load filter setup config:", err);
      }
    }
    if (hasModuleAccess("Customers")) {
      loadConfig();
    }
  }, [isLoading, isAdmin, hasModuleAccess]);

  // Reset pagination when search query or page size changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterBranch, filterCreatedBy, filterSource, pageSize]);

  const handleCustomerRedirect = (phone) => {
    if (!phone) return;
    setPath(pathname);
    router.push(`/crm/customers/${encodeURIComponent(normalizePhone(phone))}`);
  };

  const handleCopyPhone = (e, phone) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    setCopiedPhone(phone);
    setTimeout(() => setCopiedPhone(null), 2000);
    toast.success("Phone number copied!");
  };

  const handleAddCustomerOptimistic = (newCustomer) => {
    setRawCustomers((prev) => [newCustomer, ...prev]);
    setShowAddModal(false);
  };

  // Client-side deduplication & filtering of customer dataset
  const filteredCustomers = useMemo(() => {
    const uniqueMap = {};
    rawCustomers.forEach((c) => {
      const cleanPhone = normalizePhone(c.phone || "") || "unknown";
      if (!uniqueMap[cleanPhone]) {
        uniqueMap[cleanPhone] = c;
      }
    });

    let list = Object.values(uniqueMap);

    // Search term filtering
    if (searchTerm && searchTerm.trim() !== "") {
      const lower = searchTerm.toLowerCase().trim();
      list = list.filter((c) => {
        const name = (c.name || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const city = (c.city || "").toLowerCase();
        const branch = (c.branchName || "").toLowerCase();
        const enquired = (c.enquiredFor || "").toLowerCase();
        const creator = (c.creatorInfo?.name || "").toLowerCase();
        return (
          name.includes(lower) ||
          phone.includes(lower) ||
          city.includes(lower) ||
          branch.includes(lower) ||
          enquired.includes(lower) ||
          creator.includes(lower)
        );
      });
    }

    // Status filter
    if (filterStatus !== "all") {
      list = list.filter((c) => (c.status || "New").toLowerCase() === filterStatus.toLowerCase());
    }

    // Branch filter
    if (filterBranch !== "all") {
      list = list.filter((c) => {
        const bId = c.branchId ? c.branchId.toString() : "";
        const bName = c.branchName || "";
        return bId === filterBranch || bName === filterBranch;
      });
    }

    // Created By filter
    if (filterCreatedBy !== "all") {
      if (filterCreatedBy === "system") {
        list = list.filter((c) => !c.creatorInfo);
      } else {
        list = list.filter((c) => c.creatorInfo?.name === filterCreatedBy);
      }
    }

    // Source filter
    if (filterSource !== "all") {
      list = list.filter((c) => (c.source || "Manual Entry").toLowerCase() === filterSource.toLowerCase());
    }

    return list;
  }, [rawCustomers, searchTerm, filterStatus, filterBranch, filterCreatedBy, filterSource]);

  // Client-side sorting
  const sortedCustomers = useMemo(() => {
    const list = [...filteredCustomers];
    list.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      if (sortBy === "customerName") {
        valA = a.name || a.phone || "";
        valB = b.name || b.phone || "";
      } else if (sortBy === "city") {
        valA = a.city || "";
        valB = b.city || "";
      } else if (sortBy === "status") {
        valA = a.status || "New";
        valB = b.status || "New";
      } else if (sortBy === "lastActivity") {
        valA = a.lastActivityDate || a.updatedAt || a.createdAt || "";
        valB = b.lastActivityDate || b.updatedAt || b.createdAt || "";
      } else if (sortBy === "createdAt") {
        valA = a.createdAt || a.date || "";
        valB = b.createdAt || b.date || "";
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredCustomers, sortBy, sortOrder]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // Pagination calculation
  const totalRecords = sortedCustomers.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedCustomers.slice(start, start + pageSize);
  }, [sortedCustomers, currentPage, pageSize]);

  // Count active filters for chip display
  const activeFilters = useMemo(() => {
    const filters = [];
    if (searchTerm) {
      filters.push({
        id: "search",
        label: `Search: "${searchTerm}"`,
        clear: () => setSearchTerm(""),
      });
    }
    if (filterStatus !== "all") {
      filters.push({
        id: "status",
        label: `Status: ${filterStatus}`,
        clear: () => setFilterStatus("all"),
      });
    }
    if (filterBranch !== "all") {
      const bObj = availableBranches.find((b) => (b._id || b.id) === filterBranch || b.name === filterBranch);
      filters.push({
        id: "branch",
        label: `Branch: ${bObj ? bObj.name : filterBranch}`,
        clear: () => setFilterBranch("all"),
      });
    }
    if (filterCreatedBy !== "all") {
      filters.push({
        id: "createdBy",
        label: `Created By: ${filterCreatedBy === "system" ? "System / Webhook" : filterCreatedBy}`,
        clear: () => setFilterCreatedBy("all"),
      });
    }
    if (filterSource !== "all") {
      filters.push({
        id: "source",
        label: `Source: ${filterSource}`,
        clear: () => setFilterSource("all"),
      });
    }
    return filters;
  }, [searchTerm, filterStatus, filterBranch, filterCreatedBy, filterSource, availableBranches]);

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterStatus("all");
    setFilterBranch("all");
    setFilterCreatedBy("all");
    setFilterSource("all");
  };

  const isAuthorized = hasModuleAccess("Customers");

  if (status === "loading" || isLoading) {
    return <LoadingScreen />;
  }

  if (!user && !session) return null;

  if (!isAuthorized) {
    return (
      <AccessDenied message="You do not have permission to access the Customer Directory." />
    );
  }

  return (
    <DashboardPage
      title="Customer Directory"
      subtitle="Manage and track customer records, interaction history, and profile details."
      maxWidth="1800px"
    >
      {/* ENTERPRISE CRM TOOLBAR (MATCHING LEADS TOOLBAR) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 mb-3 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 select-none">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-56"
          />

          <div className="h-6 w-px bg-slate-800 hidden md:block"></div>

          {/* Status Filter */}
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

          {/* Branch Filter */}
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884] max-w-[150px]"
          >
            <option value="all">All Branches</option>
            {availableBranches.map((branch) => (
              <option key={branch._id || branch.id} value={branch.name}>
                {branch.name}
              </option>
            ))}
          </select>

          {/* Created By Filter */}
          {isAdmin && (
            <select
              value={filterCreatedBy}
              onChange={(e) => setFilterCreatedBy(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884] max-w-[160px]"
            >
              <option value="all">All Creators</option>
              <option value="system">System / Webhook</option>
              {allUsersList.map((u) => (
                <option key={u.id || u._id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          )}

          {/* Source Filter */}
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2.5 text-xs font-semibold text-slate-200 outline-none cursor-pointer focus:border-[#00a884]"
          >
            <option value="all">All Sources</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Manual Entry">Manual Entry</option>
            <option value="Direct Call">Direct Call</option>
            <option value="Reference">Reference</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="icon"
            onClick={() => fetchCustomers(false)}
            disabled={fetchingCustomers}
            title="Refresh Directory"
            className="border-slate-750 hover:bg-slate-800 text-slate-350"
          >
            <RefreshCcw
              size={15}
              className={fetchingCustomers ? "animate-spin" : ""}
            />
          </Button>
          <Button onClick={() => setShowAddModal(true)} className="bg-[#00a884] hover:bg-[#008f70] text-white">
            <Plus size={16} /> <span className="hidden sm:inline">Add Customer</span>
          </Button>
        </div>
      </div>

      {/* REMOVABLE FILTER CHIPS */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4 px-1">
          <span className="text-[11px] font-extrabold text-slate-450 uppercase tracking-wider flex items-center gap-1">
            <Filter size={12} /> Active Filters:
          </span>
          {activeFilters.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 border border-slate-250 text-slate-700 shadow-2xs"
            >
              <span>{chip.label}</span>
              <button
                onClick={chip.clear}
                className="p-0.5 text-slate-400 hover:text-rose-500 rounded-full transition-colors cursor-pointer"
                title="Remove filter"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <button
            onClick={clearAllFilters}
            className="text-xs font-extrabold text-[#00a884] hover:text-[#008f70] underline cursor-pointer ml-1 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {fetchingCustomers && sortedCustomers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-28 bg-white border border-slate-200 rounded-xl shadow-sm">
          <Loader2 size={32} className="animate-spin mb-3 text-[#00a884]" />
          <span className="text-xs font-black uppercase tracking-widest text-slate-400">
            Syncing Customer Directory...
          </span>
        </div>
      ) : sortedCustomers.length === 0 ? (
        <EmptyState
          icon={User}
          title="No customers found in directory."
          description="Try adjusting your search criteria or add a new customer."
        />
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          {/* DESKTOP TABLE VIEW (MATCHING LEADS TABLE LAYOUT & STYLING) */}
          <div className="overflow-x-auto overflow-y-auto max-h-[680px] hidden md:block">
            <table className="w-full text-left border-collapse min-w-[1550px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest sticky top-0 bg-slate-50 z-10 shadow-[inset_0_-1px_0_rgba(229,231,235,1)] select-none">
                  
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("customerName")}
                  >
                    Customer {sortBy === "customerName" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3">Phone</th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("city")}
                  >
                    City {sortBy === "city" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3">Branch</th>
                  <th className="py-3 px-3">Enquired For</th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("status")}
                  >
                    Current Status {sortBy === "status" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="py-3 px-3">Created By</th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("lastActivity")}
                  >
                    Last Activity {sortBy === "lastActivity" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th
                    className="py-3 px-3 cursor-pointer hover:bg-slate-100"
                    onClick={() => handleSort("createdAt")}
                  >
                    Created {sortBy === "createdAt" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 text-xs font-semibold text-slate-700">
                {paginatedCustomers.map((customer, idx) => {
                  const customerKey = customer._id || customer.phone || idx;
                  const displayName = resolveCustomerDisplayName(customer);
                  const cleanPhone = (customer.phone || "").replace("whatsapp:", "");
                  const displayCity = customer.city || "-";
                  const currentStatus = customer.status || "New";
                  const branchName = customer.branchName || "Unassigned Branch";
                  const enquiredFor = customer.enquiredFor || "-";
                  const lastActivity = customer.lastActivityDate || customer.updatedAt || customer.createdAt;
                  const createdDate = customer.createdAt || customer.date;

                  return (
                    <Fragment key={customerKey}>
                      <tr
                        className={`h-12 border-b border-slate-100 hover:bg-slate-50/50 transition-colors cursor-pointer `}
                        onClick={() => handleCustomerRedirect(customer.phone)}
                        title={`View ${displayName.startsWith("+91") ? "Customer" : displayName}'s profile`}
                      >

                        <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-6.5 h-6.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-[10px] border border-emerald-100 uppercase">
                              {displayName.charAt(0)}
                            </div>
                            <span>{displayName}</span>
                          </div>
                        </td>
                        <td
                          className="py-3 px-3 font-mono text-slate-550 whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{cleanPhone}</span>
                            <button
                              onClick={(e) => handleCopyPhone(e, cleanPhone)}
                              className="text-slate-400 hover:text-[#00a884] transition-colors p-0.5 cursor-pointer"
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
                        <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                          {displayCity}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-semibold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 whitespace-nowrap">
                            <Building2 size={11} />
                            {branchName}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 max-w-[200px] truncate whitespace-nowrap font-medium">
                          {enquiredFor}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusBadgeStyles(
                              currentStatus
                            )}`}
                          >
                            {currentStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {customer.creatorInfo ? (
                            <div>
                              <div className="font-bold text-slate-800 truncate max-w-[150px]">
                                {customer.creatorInfo.name}
                              </div>
                              <div className="text-[10px] text-slate-500 font-medium truncate max-w-[150px] capitalize">
                                {customer.creatorInfo.role} ({customer.creatorInfo.branchName || "No Branch"})
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">System / Webhook</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {lastActivity
                            ? new Date(lastActivity).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </td>
                        <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                          {createdDate
                            ? new Date(createdDate).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })
                            : "-"}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleCustomerRedirect(customer.phone)}
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-white hover:bg-[#00a884] transition-all shadow-xs cursor-pointer"
                            title="View Customer Profile"
                          >
                            <ArrowRight size={13} />
                          </button>
                        </td>
                      </tr>


                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE RESPONSIVE CARDS VIEW (MATCHING LEADS MOBILE DESIGN) */}
          <div className="grid grid-cols-1 gap-3.5 p-4 md:hidden">
            {paginatedCustomers.map((customer, idx) => {
              const customerKey = customer._id || customer.phone || idx;
              const displayName = resolveCustomerDisplayName(customer);
              const cleanPhone = (customer.phone || "").replace("whatsapp:", "");
              const currentStatus = customer.status || "New";

              return (
                <div
                  key={customerKey}
                  className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
                >
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer"
                    
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-sm border border-emerald-100 uppercase shrink-0">
                        {displayName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-extrabold text-slate-800 text-sm leading-tight truncate">
                          {displayName}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-slate-550 text-xs block">{cleanPhone}</span>
                          {customer.city && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-0.5 truncate">
                              <MapPin size={10} /> {customer.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${getStatusBadgeStyles(
                          currentStatus
                        )}`}
                      >
                        {currentStatus}
                      </span>

                    </div>
                  </div>


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

      {/* Add Customer Modal */}
      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddCustomerOptimistic}
        />
      )}
    </DashboardPage>
  );
}



// Status styles mapping function (identical to Leads page)
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

// --- Add Customer Modal Component ---
const AddCustomerModal = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    city: "",
    address: "",
    source: "Manual Entry",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.phone.trim()) return toast.error("Phone number is required");

    setSaving(true);
    try {
      const { data: result } = await customerRepository.createCustomer(formData);
      toast.success("Customer added successfully!");
      onSuccess(result.data);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in">
      <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4">
        <div className="px-8 pt-8 pb-4 flex items-center justify-between border-b border-slate-100">
          <div>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              New Customer
            </h3>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Add a record to the directory manually.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Phone Number <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="tel"
                required
                placeholder="e.g. 919876543210"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Full Name
              </label>
              <div className="relative">
                <User
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="John Doe"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                City
              </label>
              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Location"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
                  value={formData.city}
                  onChange={(e) =>
                    setFormData({ ...formData, city: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Full Address
              </label>
              <input
                type="text"
                placeholder="Street, Landmark..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Source / Origin
            </label>
            <div className="relative">
              <Globe
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <select
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-11 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs appearance-none cursor-pointer"
                value={formData.source}
                onChange={(e) =>
                  setFormData({ ...formData, source: e.target.value })
                }
              >
                <option value="Manual Entry">Manual Entry</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Direct Call">Direct Call</option>
                <option value="Reference">Reference</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 text-sm rounded-xl text-slate-500 font-bold hover:bg-slate-100 transition-all border border-transparent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3.5 bg-[#00a884] text-white text-sm rounded-xl font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-200 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 cursor-pointer"
            >
              {saving ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}{" "}
              Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
