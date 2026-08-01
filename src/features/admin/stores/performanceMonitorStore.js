import { create } from "zustand";

export const usePerformanceMonitorStore = create((set, get) => ({
  filters: {
    dateRange: "thisMonth",
    startDate: "",
    endDate: "",
    branchId: "all",
    department: "all",
    role: "all",
    associateStatus: "all",
    leadType: "all",
    associateId: "all",
    leadStatus: "all"
  },
  analyticsData: null,
  isLoading: false,
  error: null,

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    }));
    // Auto fetch when filters change
    get().fetchAnalytics();
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: {
        ...state.filters,
        ...newFilters
      }
    }));
    get().fetchAnalytics();
  },

  fetchAnalytics: async () => {
    const { filters, isLoading } = get();
    if (isLoading) return; // Prevent duplicate concurrent API requests

    set({ isLoading: true, error: null });

    try {
      let query = `dateRange=${filters.dateRange}&department=${filters.department}&role=${filters.role}&associateStatus=${filters.associateStatus}&leadType=${filters.leadType}&associateId=${filters.associateId}&leadStatus=${filters.leadStatus}`;
      
      if (filters.branchId !== "all") {
        query += `&branchId=${filters.branchId}`;
      }
      if (filters.dateRange === "custom" && filters.startDate) {
        query += `&startDate=${filters.startDate}&endDate=${filters.endDate}`;
      }

      const res = await fetch(`/api/admin/performance-monitor?${query}`);
      const payload = await res.json();

      if (payload.success) {
        set({ analyticsData: payload, isLoading: false });
      } else {
        set({ error: payload.error || "Failed to load metrics", isLoading: false });
      }
    } catch (err) {
      console.error("Zustand Analytics Sync Error:", err);
      set({ error: "Network error fetching analytics", isLoading: false });
    }
  },

  refresh: () => {
    get().fetchAnalytics();
  }
}));
