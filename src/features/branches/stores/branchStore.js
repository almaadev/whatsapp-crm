import { create } from "zustand";

export const useBranchStore = create((set, get) => ({
  branches: [],
  selectedBranch: null,
  searchText: "",
  selectedStatus: "", // "", "active", "inactive"
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  },
  loading: false,

  setBranches: (branches) => set({ branches }),
  setSelectedBranch: (selectedBranch) => set({ selectedBranch }),
  setSearchText: (searchText) => set({ searchText }),
  setSelectedStatus: (selectedStatus) => set({ selectedStatus }),
  setPagination: (pagination) => set({ pagination: { ...get().pagination, ...pagination } }),
  setLoading: (loading) => set({ loading }),

  // Reset filters
  resetFilters: () => set({ searchText: "", selectedStatus: "" }),

  // Synced CRUD mutations
  addBranchStore: (branch) => set((state) => ({ branches: [branch, ...state.branches] })),
  updateBranchStore: (id, updatedBranch) => set((state) => ({
    branches: state.branches.map((b) => (b.id === id || b._id === id ? updatedBranch : b)),
    selectedBranch: state.selectedBranch && (state.selectedBranch.id === id || state.selectedBranch._id === id) ? updatedBranch : state.selectedBranch
  })),
  removeBranchStore: (id) => set((state) => ({
    branches: state.branches.filter((b) => b.id !== id && b._id !== id),
    selectedBranch: state.selectedBranch && (state.selectedBranch.id === id || state.selectedBranch._id === id) ? null : state.selectedBranch
  }))
}));
