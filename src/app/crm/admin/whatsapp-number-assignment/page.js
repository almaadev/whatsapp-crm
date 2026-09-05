"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  Suspense,
} from "react";

import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { useCrmLayout } from "@/shared/components/layout/CrmShell";
import { useAuth } from "@/shared/hooks/useAuth";
import AccessDenied from "@/shared/components/ui/AccessDenied";
import {
  Smartphone,
  RefreshCw,
  Search,
  Building,
  Briefcase,
  X,
  Loader2,
  Menu,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  Trash2,
} from "lucide-react";

// ─── Modal Animations ────────────────────────────────────────────────────────
const modalOverlay = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const modalContent = {
  hidden: { opacity: 0, scale: 0.95, y: 15 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.16, 1, 0.3, 1] },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 15,
    transition: { duration: 0.2 },
  },
};

const ITEMS_PER_PAGE = 15;

function WhatsAppNumberAssignmentContent() {
  const { data: session, status } = useSession();
  const { user, isLoading, isAdmin } = useAuth();
  const { setMobileOpen } = useCrmLayout();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ─── Data State ────────────────────────────────────────────────────────────
  const [associates, setAssociates] = useState([]);
  const [numbers, setNumbers] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ─── Search, Filter & Pagination State ─────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // ─── Assign Numbers Modal State ────────────────────────────────────────────
  const [assignModal, setAssignModal] = useState({
    isOpen: false,
    associate: null,
    loadingNumbers: false,
    assignableNumbers: [],
    currentAssignedNumbers: [],
    selectedNumberIds: [],
    adminScope: null,
    submitting: false,
  });

  const [modalSearch, setModalSearch] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState("all"); // "all" | "active" | "inactive"
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const [modalPageSize, setModalPageSize] = useState(10);
  const [isAssignedExpanded, setIsAssignedExpanded] = useState(false);

  const isSuperAdmin = session?.user?.role === "superAdmin";
  const isAuthorized = isAdmin;
  const isFetchingRef = useRef(false);

  // ─── Fetch Data ────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (showRefreshing = false) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (showRefreshing) setRefreshing(true);
    try {
      const [twilioRes, usersRes] = await Promise.all([
        fetch("/api/admin/twilio?mode=senders_only"),
        fetch("/api/users"),
      ]);

      const twilioData = await twilioRes.json();
      const usersData = await usersRes.json();

      if (twilioData.success && Array.isArray(twilioData.numbers)) {
        setNumbers(twilioData.numbers);
      }
      if (twilioData.branches && Array.isArray(twilioData.branches)) {
        setBranches(twilioData.branches);
      }
      if (Array.isArray(usersData)) {
        setAssociates(usersData);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
      toast.error("Failed to load data from server");
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading" || isLoading) return;

    if (isAuthorized) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [isAuthorized, isLoading, status, fetchData]);

  // ─── Fast Lookups ──────────────────────────────────────────────────────────
  const numberMap = useMemo(() => {
    const map = new Map();
    numbers.forEach((n) => {
      map.set((n._id || n.id).toString(), n);
    });
    return map;
  }, [numbers]);

  const associateMap = useMemo(() => {
    const map = new Map();
    associates.forEach((a) => {
      map.set((a.id || a._id).toString(), a);
    });
    return map;
  }, [associates]);

  // Helper to find all associates sharing a number
  const getSharedAssociates = useCallback(
    (numberDoc) => {
      if (
        !numberDoc ||
        !numberDoc.assignedAssociates ||
        numberDoc.assignedAssociates.length === 0
      ) {
        return [];
      }
      return numberDoc.assignedAssociates.map((raw) => {
        if (typeof raw === "object" && raw !== null && raw.name) {
          return raw.name;
        }
        const assoc = associateMap.get(raw?.toString());
        return assoc ? assoc.name : "Associate";
      });
    },
    [associateMap],
  );

  // ─── Modal Actions ────────────────────────────────────────────────────────
  const handleOpenAssignModal = useCallback(async (assoc) => {
    const assocId = (assoc.id || assoc._id).toString();

    setAssignModal({
      isOpen: true,
      associate: assoc,
      loadingNumbers: true,
      assignableNumbers: [],
      currentAssignedNumbers: [],
      selectedNumberIds: (
        assoc.assignedSenderNumbers ||
        assoc.assignedTwilioNumbers ||
        []
      )
        .map((id) => (id?._id || id).toString())
        .filter(Boolean),
      adminScope: null,
      submitting: false,
    });
    setModalSearch("");
    setModalStatusFilter("all");
    setModalCurrentPage(1);
    setModalPageSize(10);
    setIsAssignedExpanded(false);

    try {
      const res = await fetch(
        `/api/admin/whatsapp-assignment?associateId=${encodeURIComponent(assocId)}`
      );
      const data = await res.json();
      if (data.success) {
        setAssignModal((prev) => ({
          ...prev,
          loadingNumbers: false,
          assignableNumbers: data.assignableNumbers || [],
          currentAssignedNumbers: data.currentAssignedNumbers || [],
          selectedNumberIds: data.currentAssignedNumberIds || [],
          adminScope: data.adminScope,
        }));
      } else {
        toast.error(data.error || "Failed to load assignable WhatsApp numbers");
        setAssignModal((prev) => ({ ...prev, loadingNumbers: false }));
      }
    } catch (err) {
      console.error("Failed to load assignable numbers for associate:", err);
      toast.error("Error loading WhatsApp number pool for this associate.");
      setAssignModal((prev) => ({ ...prev, loadingNumbers: false }));
    }
  }, []);

  // ─── Handle URL Query Param: ?associate=<id> ──────────────────────────────
  const associateQuery = searchParams.get("associate");
  useEffect(() => {
    if (associateQuery && associates.length > 0) {
      const target = associates.find(
        (a) => (a.id || a._id).toString() === associateQuery,
      );
      if (target) {
        handleOpenAssignModal(target);
      }
    }
  }, [associateQuery, associates, handleOpenAssignModal]);

  // Helper to look up assigned number details including stale flag
  const getAssignedNumberDetails = useCallback(
    (numId) => {
      // 1. Check in assignModal.currentAssignedNumbers
      const currentDoc = assignModal.currentAssignedNumbers.find(
        (n) => (n._id || n.id).toString() === numId
      );
      if (currentDoc) {
        const isAssignable = assignModal.assignableNumbers.some(
          (n) => (n._id || n.id).toString() === numId
        );
        return {
          ...currentDoc,
          isStale:
            currentDoc.isStale !== undefined
              ? currentDoc.isStale
              : !isAssignable,
        };
      }

      // 2. Check in assignModal.assignableNumbers
      const assignableDoc = assignModal.assignableNumbers.find(
        (n) => (n._id || n.id).toString() === numId
      );
      if (assignableDoc) {
        return {
          ...assignableDoc,
          isStale: false,
        };
      }

      // 3. Fallback to numberMap
      const mapDoc = numberMap.get(numId);
      if (mapDoc) {
        const isAssignable = assignModal.assignableNumbers.some(
          (n) => (n._id || n.id).toString() === numId
        );
        return {
          ...mapDoc,
          isStale: !isAssignable,
        };
      }

      return {
        _id: numId,
        id: numId,
        friendlyName: "WhatsApp Number",
        phoneNumber: "Unknown",
        isStale: true,
      };
    },
    [assignModal.currentAssignedNumbers, assignModal.assignableNumbers, numberMap]
  );

  // ─── Filter & Search Associates ───────────────────────────────────────────
  const filteredAssociates = useMemo(() => {
    return associates.filter((assoc) => {
      // 1. Super Admin Branch Filter
      if (isSuperAdmin && selectedBranch !== "all") {
        const branchStr =
          assoc.branch?.toString() || assoc.branchId?.toString() || "";
        if (branchStr !== selectedBranch && assoc.branch !== selectedBranch) {
          return false;
        }
      }

      // 2. Search Query (Name, Email, Phone, Number)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const name = (assoc.name || "").toLowerCase();
        const email = (assoc.email || "").toLowerCase();
        const phone = (assoc.number || "").toLowerCase();

        const assignedIds =
          assoc.assignedSenderNumbers || assoc.assignedTwilioNumbers || [];
        const matchesNumber = assignedIds.some((nId) => {
          const numDoc = numberMap.get(nId?.toString());
          return (
            (numDoc?.friendlyName || "").toLowerCase().includes(query) ||
            (numDoc?.phoneNumber || "").toLowerCase().includes(query)
          );
        });

        if (
          !name.includes(query) &&
          !email.includes(query) &&
          !phone.includes(query) &&
          !matchesNumber
        ) {
          return false;
        }
      }

      return true;
    });
  }, [associates, isSuperAdmin, selectedBranch, searchQuery, numberMap]);

  // ─── Pagination Calculations ──────────────────────────────────────────────
  const totalPages = Math.ceil(filteredAssociates.length / ITEMS_PER_PAGE) || 1;
  const paginatedAssociates = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAssociates.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredAssociates, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedBranch]);

  // Toggle selection of a WhatsApp number (Many-to-Many shared assignment)
  const handleToggleNumberSelection = (numberDoc) => {
    const numId = (numberDoc._id || numberDoc.id).toString();
    const isSelected = assignModal.selectedNumberIds.includes(numId);

    if (isSelected) {
      // Uncheck / Deselect from this associate
      setAssignModal((prev) => ({
        ...prev,
        selectedNumberIds: prev.selectedNumberIds.filter((id) => id !== numId),
      }));
    } else {
      // Check / Add to this associate
      setAssignModal((prev) => ({
        ...prev,
        selectedNumberIds: [...prev.selectedNumberIds, numId],
      }));
    }
  };

  const handleRemoveAssignedNumber = (numId) => {
    setAssignModal((prev) => ({
      ...prev,
      selectedNumberIds: prev.selectedNumberIds.filter((id) => id !== numId),
    }));
  };

  // Modal: Filtered WhatsApp Numbers strictly from Admin-authorized assignableNumbers
  const modalFilteredNumbers = useMemo(() => {
    const query = modalSearch.toLowerCase().trim();
    const list = assignModal.assignableNumbers || [];

    return list.filter((num) => {
      // 1. Status filter
      if (
        modalStatusFilter === "active" &&
        num.status === "inactive" &&
        num.isActive === false
      ) {
        return false;
      }
      if (
        modalStatusFilter === "inactive" &&
        (num.status === "active" || num.isActive === true)
      ) {
        return false;
      }

      // 2. Search filter (friendlyName, phoneNumber)
      if (query) {
        const name = (num.friendlyName || "").toLowerCase();
        const phone = (num.phoneNumber || "").toLowerCase();
        if (!name.includes(query) && !phone.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [assignModal.assignableNumbers, modalSearch, modalStatusFilter]);

  // Reset modal page to 1 when search or status filter changes
  useEffect(() => {
    setModalCurrentPage(1);
  }, [modalSearch, modalStatusFilter, modalPageSize]);

  // Modal: Pagination
  const modalTotalPages =
    Math.ceil(modalFilteredNumbers.length / modalPageSize) || 1;
  const modalPaginatedNumbers = useMemo(() => {
    const start = (modalCurrentPage - 1) * modalPageSize;
    return modalFilteredNumbers.slice(start, start + modalPageSize);
  }, [modalFilteredNumbers, modalCurrentPage, modalPageSize]);

  // Select all visible on current active page
  const visiblePageNumberIds = useMemo(() => {
    return modalPaginatedNumbers.map((n) => (n._id || n.id).toString());
  }, [modalPaginatedNumbers]);

  const allVisiblePageSelected = useMemo(() => {
    if (visiblePageNumberIds.length === 0) return false;
    return visiblePageNumberIds.every((id) =>
      assignModal.selectedNumberIds.includes(id),
    );
  }, [visiblePageNumberIds, assignModal.selectedNumberIds]);

  const selectedVisiblePageCount = useMemo(() => {
    return visiblePageNumberIds.filter((id) =>
      assignModal.selectedNumberIds.includes(id),
    ).length;
  }, [visiblePageNumberIds, assignModal.selectedNumberIds]);

  const handleToggleSelectAllVisible = () => {
    if (allVisiblePageSelected) {
      // Deselect all on current page
      setAssignModal((prev) => ({
        ...prev,
        selectedNumberIds: prev.selectedNumberIds.filter(
          (id) => !visiblePageNumberIds.includes(id),
        ),
      }));
    } else {
      // Select all on current page
      setAssignModal((prev) => ({
        ...prev,
        selectedNumberIds: Array.from(
          new Set([...prev.selectedNumberIds, ...visiblePageNumberIds]),
        ),
      }));
    }
  };

  // Save Many-to-Many Assignments to Backend
  const handleSaveAssignments = async () => {
    if (!assignModal.associate) return;
    const assocId = (
      assignModal.associate.id || assignModal.associate._id
    ).toString();

    setAssignModal((prev) => ({ ...prev, submitting: true }));

    try {
      const res = await fetch("/api/admin/whatsapp-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          associateId: assocId,
          numberIds: assignModal.selectedNumberIds,
        }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success(
          data.message ||
            `Successfully updated WhatsApp numbers for ${assignModal.associate.name}.`
        );

        const updatedSenderNumbers =
          data.assignedSenderNumbers || assignModal.selectedNumberIds || [];

        // Immediately synchronize associate in local state
        setAssociates((prev) =>
          prev.map((a) => {
            if ((a.id || a._id).toString() === assocId) {
              return {
                ...a,
                assignedSenderNumbers: updatedSenderNumbers,
                assignedTwilioNumbers: updatedSenderNumbers,
                assignedSenderNumber: updatedSenderNumbers[0] || null,
              };
            }
            return a;
          })
        );

        setAssignModal({
          isOpen: false,
          associate: null,
          loadingNumbers: false,
          assignableNumbers: [],
          currentAssignedNumbers: [],
          selectedNumberIds: [],
          adminScope: null,
          submitting: false,
        });

        if (associateQuery) {
          router.replace("/crm/admin/whatsapp-number-assignment");
        }

        // Controlled single refresh
        fetchData();

        // Dispatch sender update event for Topbar and other layout components
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("whatsapp_senders_updated", {
              detail: { associateId: assocId },
            })
          );
        }
      } else {
        toast.error(
          data.error || data.message || "Failed to update assignments"
        );
        setAssignModal((prev) => ({ ...prev, submitting: false }));
      }
    } catch (err) {
      console.error("Save assignments error:", err);
      toast.error("Error connecting to server. Please try again.");
      setAssignModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // ─── Guard Views ──────────────────────────────────────────────────────────
  if (status === "loading" || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm">
        <Loader2 className="animate-spin mr-2" size={20} /> Verifying
        Authorization...
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <AccessDenied message="This command center is restricted to administrative personnel." />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative bg-slate-50/50">
      {/* ─── PAGE HEADER ──────────────────────────────────────────────────── */}
      <header className="h-auto md:h-20 px-6 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between shrink-0 z-20 shadow-xs gap-4 select-none">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2.5">
              <span className="p-2 bg-emerald-50 text-[#00a884] rounded-xl">
                <Smartphone size={22} />
              </span>
              WhatsApp Number Assignment
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5 ml-0.5">
              Assign WhatsApp business numbers to associates.
            </p>
          </div>
        </div>

        {/* Top-Right Controls: Search + SuperAdmin Branch Filter + Refresh */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Search Associate Input */}
          <div className="relative w-full sm:w-64">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search associate..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-10 pr-8 text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none focus:bg-white focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/20 transition-all shadow-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Super Admin Branch Filter Dropdown (Optional for Super Admin Only) */}
          {isSuperAdmin && (
            <div className="relative min-w-[140px]">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/20 transition-all appearance-none cursor-pointer shadow-xs"
              >
                <option value="all">Branch: All</option>
                {branches.map((b) => (
                  <option key={b.id || b._id} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw
              size={14}
              className={
                refreshing ? "animate-spin text-[#00a884]" : "text-slate-500"
              }
            />
            <span className="hidden sm:inline">
              {refreshing ? "Refreshing..." : "Refresh"}
            </span>
          </button>
        </div>
      </header>

      {/* ─── MAIN CONTENT: ASSOCIATE-CENTRIC TABLE ───────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
        <div className="max-w-[1600px] mx-auto">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden flex flex-col">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-extrabold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Associate</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4">Branch</th>
                    <th className="px-6 py-4">Department</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">WhatsApp Numbers</th>
                    <th className="px-6 py-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest text-xs"
                      >
                        <Loader2
                          className="animate-spin mx-auto mb-2 text-[#00a884]"
                          size={24}
                        />
                        Loading Associates Roster...
                      </td>
                    </tr>
                  ) : filteredAssociates.length === 0 ? (
                    <tr>
                      <td
                        colSpan="7"
                        className="p-16 text-center text-slate-500 font-medium"
                      >
                        {searchQuery.trim() !== "" || selectedBranch !== "all"
                          ? "No associates match your search criteria."
                          : "No associates found in this branch."}
                      </td>
                    </tr>
                  ) : (
                    paginatedAssociates.map((assoc) => {
                      const assocIdStr = (assoc.id || assoc._id).toString();
                      const assignedNumberIds = (
                        assoc.assignedSenderNumbers ||
                        assoc.assignedTwilioNumbers ||
                        []
                      )
                        .map((id) => (id?._id || id).toString())
                        .filter(Boolean);
                      const assignedCount = assignedNumberIds.length;
                      const isActive = assoc.active !== false;

                      // Find full number documents if available in numberMap
                      const assignedDocs = assignedNumberIds
                        .map((id) => numberMap.get(id?.toString()))
                        .filter(Boolean);

                      return (
                        <tr
                          key={assocIdStr}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* 1. Associate Name & Email */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center text-emerald-800 font-extrabold text-xs shadow-2xs border border-emerald-200 shrink-0">
                                {assoc.name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-extrabold text-slate-800 text-sm">
                                  {assoc.name}
                                </div>
                                <div className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5">
                                  <span>{assoc.email}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Status Badge */}
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                                isActive
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-rose-50 text-rose-700 border-rose-200"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-emerald-500" : "bg-rose-500"}`}
                              />
                              {isActive ? "Active" : "Inactive"}
                            </span>
                          </td>

                          {/* 3. Branch */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                              <Building
                                size={13}
                                className="text-slate-400 shrink-0"
                              />
                              <span>{assoc.branch || "No Branch"}</span>
                            </div>
                          </td>

                          {/* 4. Department */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-extrabold uppercase tracking-wider">
                              <Briefcase size={11} />
                              <span>{assoc.department || "Telecalling"}</span>
                            </span>
                          </td>

                          {/* 5. Role */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-slate-600 capitalize">
                              {assoc.role
                                ? assoc.role.replace("_", " ")
                                : "Sales"}
                            </span>
                          </td>

                          {/* 6. WhatsApp Numbers (Compact Summary Display) */}
                          <td className="px-6 py-4 ">
                            {assignedCount === 0 ? (
                              <span className="text-xs text-slate-400 font-medium italic">
                                No numbers assigned
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                  {assignedCount}
                                </span>
                              </div>
                            )}
                          </td>

                          {/* 7. Action Button */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            {assignedCount > 0 ? (
                              <button
                                onClick={() => handleOpenAssignModal(assoc)}
                                className="inline-flex items-center justify-center w-30 gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00a884] hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs active:scale-95 shrink-0"
                              >
                                <span>Manage</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenAssignModal(assoc)}
                                className="inline-flex items-center  w-30 gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00a884] hover:bg-emerald-600 text-white text-xs font-bold transition-all shadow-xs active:scale-95 shrink-0"
                              >
                                <span>Assign Number</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden flex flex-col divide-y divide-slate-100">
              {loading ? (
                <div className="p-8 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
                  <Loader2
                    className="animate-spin mx-auto mb-2 text-[#00a884]"
                    size={20}
                  />
                  Loading...
                </div>
              ) : filteredAssociates.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-medium text-xs">
                  No associates found.
                </div>
              ) : (
                paginatedAssociates.map((assoc) => {
                  const assocIdStr = (assoc.id || assoc._id).toString();
                  const assignedNumberIds = (
                    assoc.assignedSenderNumbers ||
                    assoc.assignedTwilioNumbers ||
                    []
                  )
                    .map((id) => (id?._id || id).toString())
                    .filter(Boolean);
                  const assignedCount = assignedNumberIds.length;
                  const assignedDocs = assignedNumberIds
                    .map((id) => numberMap.get(id?.toString()))
                    .filter(Boolean);
                  const isActive = assoc.active !== false;

                  return (
                    <div key={assocIdStr} className="p-4 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-800 font-extrabold flex items-center justify-center text-sm border border-emerald-100 shrink-0">
                            {assoc.name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-800 text-sm">
                              {assoc.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              {assoc.email}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          }`}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <Building size={12} className="text-slate-400" />
                          {assoc.branch || "No Branch"}
                        </span>
                        <span>•</span>
                        <span className="capitalize">
                          {assoc.department || "Telecalling"}
                        </span>
                      </div>

                      <div>
                        <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                          WhatsApp Numbers:
                        </p>
                        {assignedCount === 0 ? (
                          <span className="text-xs text-slate-400 italic">
                            No numbers assigned
                          </span>
                        ) : assignedDocs.length > 0 && assignedDocs.length <= 2 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {assignedDocs.map((num) => (
                              <span
                                key={num._id || num.id}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-mono font-bold"
                              >
                                {num.phoneNumber}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                            {assignedCount} {assignedCount === 1 ? "number assigned" : "numbers assigned"}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleOpenAssignModal(assoc)}
                        className="w-full py-2.5 bg-[#00a884] hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
                      >
                        <Smartphone size={14} />
                        <span>{assignedCount > 0 ? "Manage" : "Assign Numbers"}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {!loading && filteredAssociates.length > 0 && (
              <div className="px-6 py-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 select-none">
                <p className="text-xs text-slate-500 font-medium">
                  Showing{" "}
                  <strong className="text-slate-700 font-extrabold">
                    {Math.min(
                      (currentPage - 1) * ITEMS_PER_PAGE + 1,
                      filteredAssociates.length,
                    )}
                  </strong>
                  –
                  <strong className="text-slate-700 font-extrabold">
                    {Math.min(
                      currentPage * ITEMS_PER_PAGE,
                      filteredAssociates.length,
                    )}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-slate-700 font-extrabold">
                    {filteredAssociates.length}
                  </strong>{" "}
                  associates
                </p>

                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Previous page"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - currentPage) <= 1,
                      )
                      .map((pageNum, idx, arr) => {
                        const showEllipsis =
                          idx > 0 && pageNum - arr[idx - 1] > 1;
                        return (
                          <React.Fragment key={pageNum}>
                            {showEllipsis && (
                              <span className="px-2 text-xs text-slate-400">
                                ...
                              </span>
                            )}
                            <button
                              onClick={() => setCurrentPage(pageNum)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                                currentPage === pageNum
                                  ? "bg-[#00a884] text-white shadow-xs"
                                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {pageNum}
                            </button>
                          </React.Fragment>
                        );
                      })}

                    <button
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Next page"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ─── ASSIGN NUMBERS MODAL ────────────────────────────────────────────── */}
      <AnimatePresence>
        {assignModal.isOpen && assignModal.associate && (
          <motion.div
            variants={modalOverlay}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs"
            onClick={(e) => {
              if (e.target === e.currentTarget && !assignModal.submitting) {
                setAssignModal((prev) => ({ ...prev, isOpen: false }));
              }
            }}
          >
            <motion.div
              variants={modalContent}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="bg-white rounded-3xl shadow-2xl w-full max-w-[1100px] h-[85vh] max-h-[780px] overflow-hidden border border-slate-200 flex flex-col"
            >
              {/* ─── 1. FIXED MODAL HEADER ─── */}
              <div className="px-6 py-4.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#00a884] flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 tracking-tight">
                      Assign WhatsApp Numbers
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Assign or remove WhatsApp numbers for the selected
                      associate.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() =>
                    setAssignModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  disabled={assignModal.submitting}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {/* ─── 2. TWO-COLUMN SCROLLABLE BODY ─── */}
              <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                {/* ─── LEFT PANEL: ASSOCIATE INFO & CURRENTLY ASSIGNED (~32%) ─── */}
                <div className="w-full lg:w-[32%] xl:w-[30%] bg-slate-50/60 border-b lg:border-b-0 lg:border-r border-slate-200 p-5 flex flex-col overflow-y-auto custom-scrollbar shrink-0 gap-4">
                  {/* Associate Identity Card */}
                  <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center font-extrabold text-emerald-800 text-sm border border-emerald-200 shadow-2xs shrink-0">
                          {assignModal.associate.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-extrabold text-slate-800 truncate">
                            {assignModal.associate.name}
                          </h4>
                          <p className="text-xs font-semibold text-slate-400 truncate">
                            {assignModal.associate.email}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shrink-0 ${
                          assignModal.associate.active !== false
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${assignModal.associate.active !== false ? "bg-emerald-500" : "bg-rose-500"}`}
                        />
                        {assignModal.associate.active !== false
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Role & Dept
                        </span>
                        <span className="font-bold text-slate-700 capitalize">
                          {assignModal.associate.role || "Sales"} •{" "}
                          {assignModal.associate.department || "Telecalling"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Branch
                        </span>
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <Building
                            size={12}
                            className="text-slate-400 shrink-0"
                          />
                          <span className="truncate">
                            {assignModal.associate.branch || "No branch"}
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Currently Assigned Numbers List */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <span>Currently Assigned</span>
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-md font-extrabold text-[10px]">
                          {assignModal.selectedNumberIds.length}
                        </span>
                      </span>
                    </div>

                    {assignModal.selectedNumberIds.length === 0 ? (
                      <div className="p-4 rounded-xl bg-white border border-dashed border-slate-200 text-center text-xs text-slate-400 font-medium">
                        No WhatsApp numbers assigned
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {/* Scrollable list when expanded */}
                        <div
                          className={`space-y-1.5 ${isAssignedExpanded ? "max-h-60 overflow-y-auto custom-scrollbar pr-1" : ""}`}
                        >
                          {(isAssignedExpanded
                            ? assignModal.selectedNumberIds
                            : assignModal.selectedNumberIds.slice(0, 5)
                          ).map((id) => {
                            const num = getAssignedNumberDetails(id);
                            if (!num) return null;

                            return (
                              <div
                                key={id}
                                className={`p-2.5 rounded-xl border shadow-2xs flex items-center justify-between gap-2 ${
                                  num.isStale
                                    ? "bg-amber-50/70 border-amber-200 text-amber-950"
                                    : "bg-white border-slate-200/90"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-800 truncate">
                                    {num.friendlyName || "WhatsApp Sender"}
                                  </div>
                                  <div className="font-mono text-[11px] font-semibold text-slate-500">
                                    {num.phoneNumber}
                                  </div>
     
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveAssignedNumber(id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                                  title="Remove number"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            );
                          })}
                        </div>

                        {/* More than 5 numbers expand/collapse button */}
                        {assignModal.selectedNumberIds.length > 5 && (
                          <button
                            type="button"
                            onClick={() =>
                              setIsAssignedExpanded((prev) => !prev)
                            }
                            className="text-xs font-bold text-[#00a884] hover:text-emerald-700 py-1 px-2 rounded-lg hover:bg-emerald-50/50 flex items-center justify-center gap-1 transition-colors self-start"
                          >
                            {isAssignedExpanded ? (
                              <span>Show less ▲</span>
                            ) : (
                              <span>
                                +{assignModal.selectedNumberIds.length - 5} more
                                numbers ▼
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ─── RIGHT PANEL: WHATSAPP NUMBER SELECTOR (~68%) ─── */}
                <div className="w-full lg:w-[68%] xl:w-[70%] flex flex-col min-h-0 bg-white">
                  {/* Top Controls: Search + Status Filter */}
                  <div className="p-4 border-b border-slate-200 bg-slate-50/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    {/* Search */}
                    <div className="relative w-full sm:flex-1">
                      <Search
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                      <input
                        type="text"
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        placeholder="Search by number or name..."
                        disabled={assignModal.assignableNumbers.length === 0}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-10 pr-8 text-xs font-semibold text-slate-700 placeholder:text-slate-400 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/20 transition-all shadow-2xs disabled:bg-slate-100 disabled:cursor-not-allowed"
                      />
                      {modalSearch && (
                        <button
                          onClick={() => setModalSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>

                    {/* Status Dropdown */}
                    <div className="relative w-full sm:w-36 shrink-0">
                      <select
                        value={modalStatusFilter}
                        onChange={(e) => setModalStatusFilter(e.target.value)}
                        disabled={assignModal.assignableNumbers.length === 0}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-3 pr-8 text-xs font-bold text-slate-700 outline-none focus:border-[#00a884] focus:ring-2 focus:ring-[#00a884]/20 transition-all appearance-none cursor-pointer shadow-2xs disabled:bg-slate-100 disabled:cursor-not-allowed"
                      >
                        <option value="all">All Status</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                      />
                    </div>
                  </div>

                  {/* Select All Visible Bar */}
                  <div className="px-5 py-2.5 border-b border-slate-100 bg-white flex items-center justify-between shrink-0 select-none text-xs">
                    <button
                      type="button"
                      onClick={handleToggleSelectAllVisible}
                      disabled={
                        visiblePageNumberIds.length === 0 ||
                        assignModal.assignableNumbers.length === 0
                      }
                      className="flex items-center gap-2 font-bold text-slate-700 hover:text-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                          allVisiblePageSelected
                            ? "bg-[#00a884] border-[#00a884] text-white"
                            : selectedVisiblePageCount > 0
                              ? "bg-emerald-100 border-[#00a884] text-[#00a884]"
                              : "bg-white border-slate-300 text-transparent"
                        }`}
                      >
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span>Select all visible</span>
                    </button>

                    <span className="text-[11px] font-bold text-slate-500">
                      <strong className="text-slate-800">
                        {selectedVisiblePageCount}
                      </strong>{" "}
                      of {visiblePageNumberIds.length} selected
                    </span>
                  </div>

                  {/* Number List (Scrollable Flat List) */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1.5">
                    {assignModal.loadingNumbers ? (
                      <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                        <Loader2
                          size={24}
                          className="animate-spin text-[#00a884]"
                        />
                        <p className="text-xs font-bold text-slate-600">
                          Loading assignable WhatsApp numbers...
                        </p>
                      </div>
                    ) : assignModal.assignableNumbers.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                        <Smartphone size={28} className="text-slate-300 mb-1" />
                        <p className="text-sm font-bold text-slate-700">
                          {isSuperAdmin
                            ? "No WhatsApp numbers are available."
                            : "No WhatsApp numbers are assigned to this Admin."}
                        </p>
                        <p className="text-xs text-slate-400 max-w-sm">
                          {isSuperAdmin
                            ? "Please add WhatsApp numbers before assigning them to associates."
                            : "Please assign WhatsApp numbers to the Admin first before delegating to associates."}
                        </p>
                      </div>
                    ) : modalPaginatedNumbers.length === 0 ? (
                      <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                        <Search size={24} className="text-slate-300" />
                        <p className="text-sm font-bold text-slate-600">
                          No WhatsApp numbers found
                        </p>
                        <p className="text-xs text-slate-400">
                          Try adjusting your search query or status filter.
                        </p>
                      </div>
                    ) : (
                      modalPaginatedNumbers.map((numDoc) => {
                        const numId = (numDoc._id || numDoc.id).toString();
                        const isChecked =
                          assignModal.selectedNumberIds.includes(numId);
                        const isActive =
                          numDoc.status === "active" ||
                          numDoc.isActive !== false;
                        const sharedAssocs = getSharedAssociates(numDoc);
                        const otherSharedAssocs = sharedAssocs.filter(
                          (name) => name !== assignModal.associate?.name,
                        );

                        return (
                          <div
                            key={numId}
                            onClick={() => handleToggleNumberSelection(numDoc)}
                            className={`p-3 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 border ${
                              isChecked
                                ? "bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400/30 text-emerald-950 shadow-2xs"
                                : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/70 text-slate-700"
                            }`}
                          >
                            {/* Left: Checkbox + Number details */}
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                                  isChecked
                                    ? "bg-[#00a884] border-[#00a884] text-white"
                                    : "bg-white border-slate-300 text-transparent"
                                }`}
                              >
                                <Check size={12} strokeWidth={3} />
                              </div>

                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-800 truncate">
                                  {numDoc.friendlyName || "WhatsApp Sender"}
                                </div>
                                <div className="font-mono text-xs font-bold text-slate-600">
                                  {numDoc.phoneNumber}
                                </div>
                              </div>
                            </div>

                            {/* Right: Status badge & Shared indicator */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                                  isActive
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-rose-50 text-rose-700 border-rose-200"
                                }`}
                              >
                                {isActive ? "Active" : "Inactive"}
                              </span>

                              {otherSharedAssocs.length > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[10px] font-bold flex items-center gap-1"
                                  title={`Shared with: ${otherSharedAssocs.join(", ")}`}
                                >
                                  <Users size={11} />
                                  <span>
                                    {otherSharedAssocs.length}{" "}
                                    {otherSharedAssocs.length === 1
                                      ? "associate"
                                      : "associates"}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Pagination Footer in Right Panel */}
                  <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 text-xs">
                    {/* Showing count */}
                    <div className="text-slate-500 font-medium">
                      {modalFilteredNumbers.length === 0 ? (
                        <span>Showing 0 numbers</span>
                      ) : (
                        <span>
                          Showing{" "}
                          <strong className="text-slate-700 font-extrabold">
                            {(modalCurrentPage - 1) * modalPageSize + 1}
                          </strong>
                          –
                          <strong className="text-slate-700 font-extrabold">
                            {Math.min(
                              modalCurrentPage * modalPageSize,
                              modalFilteredNumbers.length,
                            )}
                          </strong>{" "}
                          of{" "}
                          <strong className="text-slate-700 font-extrabold">
                            {modalFilteredNumbers.length}
                          </strong>{" "}
                          numbers
                        </span>
                      )}
                    </div>

                    {/* Page Buttons */}
                    {modalTotalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setModalCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={modalCurrentPage === 1}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Previous page"
                        >
                          <ChevronLeft size={14} />
                        </button>

                        {Array.from(
                          { length: modalTotalPages },
                          (_, i) => i + 1,
                        )
                          .filter(
                            (p) =>
                              p === 1 ||
                              p === modalTotalPages ||
                              Math.abs(p - modalCurrentPage) <= 1,
                          )
                          .map((pageNum, idx, arr) => {
                            const showEllipsis =
                              idx > 0 && pageNum - arr[idx - 1] > 1;
                            return (
                              <React.Fragment key={pageNum}>
                                {showEllipsis && (
                                  <span className="px-1.5 text-xs text-slate-400">
                                    ...
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setModalCurrentPage(pageNum)}
                                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                                    modalCurrentPage === pageNum
                                      ? "bg-[#00a884] text-white shadow-2xs"
                                      : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                                  }`}
                                >
                                  {pageNum}
                                </button>
                              </React.Fragment>
                            );
                          })}

                        <button
                          type="button"
                          onClick={() =>
                            setModalCurrentPage((p) =>
                              Math.min(modalTotalPages, p + 1),
                            )
                          }
                          disabled={modalCurrentPage === modalTotalPages}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Next page"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    )}

                    {/* Page size selector */}
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <span className="text-[11px] font-semibold">
                        Per page:
                      </span>
                      <select
                        value={modalPageSize}
                        onChange={(e) =>
                          setModalPageSize(Number(e.target.value))
                        }
                        className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-[#00a884] cursor-pointer"
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ─── 3. FIXED MODAL FOOTER ─── */}
              <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/90 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setAssignModal((prev) => ({ ...prev, isOpen: false }))
                  }
                  disabled={assignModal.submitting}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignments}
                  disabled={
                    assignModal.submitting ||
                    assignModal.loadingNumbers
                  }
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#00a884] hover:bg-emerald-600 text-white text-xs font-extrabold shadow-md shadow-emerald-200/50 transition-all active:scale-95 disabled:opacity-50"
                >
                  {assignModal.submitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Saving Assignments...</span>
                    </>
                  ) : (
                    <span>Save Assignments</span>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WhatsAppNumberAssignmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm">
          <Loader2 className="animate-spin mr-2" size={20} /> Loading WhatsApp
          Assignment Roster...
        </div>
      }
    >
      <WhatsAppNumberAssignmentContent />
    </Suspense>
  );
}
