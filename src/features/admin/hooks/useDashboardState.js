import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { useDebounce } from "@/shared/hooks/useDebounce";
import { reportRepository } from "@/shared/api/repositories/reportRepository";
import { userRepository } from "@/shared/api/repositories/userRepository";
import { branchService } from "@/features/branches/services/branchService";

export function useDashboardState(session, isAuthorized, isSuperAdminUser) {
  // Initialization & Loading State
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data State
  const [associates, setAssociates] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalLeads: 0,
    totalPending: 0,
    totalFollowUp: 0,
    totalAchieved: 0,
    totalTarget: 0,
  });

  // Filter State
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [branches, setBranches] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [filterView, setFilterView] = useState("all");
  const [sortConfig, setSortConfig] = useState({
    key: "achievedCount",
    direction: "desc",
  });

  useEffect(() => {
    async function loadBranches() {
      try {
        const res = await branchService.getBranches({ limit: 1000 });
        if (res.success) {
          setBranches(res.branches || []);
        }
      } catch (err) {
        console.error("Failed to load branches:", err);
      }
    }
    if (isAuthorized) {
      loadBranches();
    }
  }, [isAuthorized]);

  // Edit State
  const [editingId, setEditingId] = useState(null);
  const [tempTarget, setTempTarget] = useState(0);

  // 1. Initialize from LocalStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedView = localStorage.getItem("dashboard_filterView");
      const storedMonth = localStorage.getItem("dashboard_selectedMonth");
      const storedYear = localStorage.getItem("dashboard_selectedYear");

      if (storedView) setFilterView(storedView);
      if (storedMonth) setSelectedMonth(Number(storedMonth));
      if (storedYear) setSelectedYear(Number(storedYear));
      
      setIsInitialized(true);
    }
  }, []);

  // 2. Persist to LocalStorage
  useEffect(() => {
    if (isInitialized && typeof window !== "undefined") {
      localStorage.setItem("dashboard_filterView", filterView);
      localStorage.setItem("dashboard_selectedMonth", selectedMonth.toString());
      localStorage.setItem("dashboard_selectedYear", selectedYear.toString());
    }
  }, [filterView, selectedMonth, selectedYear, isInitialized]);

  // 3. Fetch Data
  const fetchData = useCallback(async () => {
    if (!isAuthorized || !isInitialized) return;
    
    setLoading(true);
    setAssociates([]); 
    
    try {
      let endpoint = "";

      // Role-Based Dynamic Routing
      if (isSuperAdminUser) {
        if (filterView === "sales") endpoint = "/api/admin/sales-admin-roster";
        else if (filterView === "doctor") endpoint = "/api/admin/doctor-admin-roster";
        else endpoint = "/api/admin/super-admin-roster";
      } else if (session?.user?.role === "sales" && session?.user?.department === "admin") {
        endpoint = "/api/admin/sales-admin-roster";
      } else if (session?.user?.role === "doctor" && session?.user?.department === "admin") {
        endpoint = "/api/admin/doctor-admin-roster";
      }

      if (!endpoint) {
        setLoading(false);
        return;
      }

      const { data } = await reportRepository.getAdminDashboard(endpoint, `month=${selectedMonth}&year=${selectedYear}&branchId=${selectedBranch}`);

      if (data.success) {
        setAssociates(data.roster || []);
        setAnalytics(data.analytics || {
          totalLeads: 0, totalPending: 0, totalFollowUp: 0, totalAchieved: 0, totalTarget: 0,
        });
      } else {
        console.error("API Error Response:", data.error);
        toast.error(data.error || "Failed to load dashboard metrics.");
      }
    } catch (err) {
      console.error("Dashboard Data Error:", err);
      toast.error("Failed to load dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, isInitialized, isSuperAdminUser, filterView, selectedMonth, selectedYear, selectedBranch, session]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 4. Derived State (Sorting & Filtering)
  const processedRoster = useMemo(() => {
    let result = [...associates];

    if (debouncedSearchQuery) {
      const lower = debouncedSearchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(lower) ||
          a.branch.toLowerCase().includes(lower),
      );
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key])
          return sortConfig.direction === "asc" ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key])
          return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [associates, debouncedSearchQuery, sortConfig]);

  // 5. Actions
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc"
    }));
  }, []);

  const saveEdit = async (id) => {
    const associate = associates.find((a) => a.id === id);
    if (!associate) return;

    setAssociates((prev) =>
      prev.map((a) => (a.id === id ? { ...a, target: Number(tempTarget) } : a)),
    );
    setEditingId(null);

    try {
      await userRepository.updateUserWithoutId({
        rowId: id,
        target: tempTarget,
        leads: associate.totalLeads,
        achieved: associate.achievedCount,
      });
      toast.success("Target updated successfully");
    } catch (error) {
      toast.error("Failed to update target");
    }
  };

  const startEdit = (associate) => {
    setEditingId(associate.id);
    setTempTarget(associate.target);
  };

  return {
    state: {
      isInitialized,
      loading,
      associates,
      analytics,
      selectedMonth,
      selectedYear,
      selectedBranch,
      branches,
      searchQuery,
      filterView,
      sortConfig,
      editingId,
      tempTarget
    },
    setters: {
      setSelectedMonth,
      setSelectedYear,
      setSelectedBranch,
      setSearchQuery,
      setFilterView,
      setTempTarget,
      setEditingId
    },
    derived: {
      processedRoster
    },
    actions: {
      handleSort,
      saveEdit,
      startEdit
    }
  };
}
