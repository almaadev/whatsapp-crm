import { useState } from "react";
import { Plus, Building2, Activity, ShieldAlert, RefreshCw, AlertCircle } from "lucide-react";
import { useBranches } from "@/hooks/branches/useBranches";
import { useCreateBranch } from "@/hooks/branches/useCreateBranch";
import { useUpdateBranch } from "@/hooks/branches/useUpdateBranch";
import { useDeleteBranch } from "@/hooks/branches/useDeleteBranch";
import { useBranchStore } from "@/store/branchStore";
import BranchTable from "./BranchTable";
import BranchCard from "./BranchCard";
import BranchFilters from "./BranchFilters";
import BranchSearch from "./BranchSearch";
import BranchPagination from "./BranchPagination";
import BranchSkeleton from "./BranchSkeleton";
import EmptyState from "./EmptyState";
import BranchFormModal from "./BranchFormModal";
import DeleteBranchDialog from "./DeleteBranchDialog";

export default function BranchTableWrapper() {
  const { data, isLoading, isError, refetch } = useBranches();

  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const deleteMutation = useDeleteBranch();

  const branches = useBranchStore((state) => state.branches);
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const setSelectedBranch = useBranchStore((state) => state.setSelectedBranch);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Extract stats from query data
  const stats = data?.stats || { total: 0, active: 0, inactive: 0 };

  const handleOpenCreate = () => {
    setSelectedBranch(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (branch) => {
    setSelectedBranch(branch);
    setIsFormOpen(true);
  };

  const handleOpenDelete = (branch) => {
    setSelectedBranch(branch);
    setIsDeleteOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (selectedBranch) {
        await updateMutation.mutateAsync({
          id: selectedBranch.id || selectedBranch._id,
          data: formData,
        });
      } else {
        await createMutation.mutateAsync(formData);
      }
      setIsFormOpen(false);
    } catch (e) {
      console.error("Failed to submit branch form:", e);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      if (selectedBranch) {
        await deleteMutation.mutateAsync(selectedBranch.id || selectedBranch._id);
      }
      setIsDeleteOpen(false);
    } catch (e) {
      console.error("Failed to delete branch:", e);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar bg-slate-50/50">
      <div className="max-w-8xl mx-auto space-y-6">
        
        {/* Header Title Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <Building2 className="text-[#00a884]" size={28} />
              Branches
            </h1>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Manage locations, details, and operations directories
            </p>
          </div>
          <button
            onClick={handleOpenCreate}
            className="flex items-center justify-center gap-2 bg-[#00a884] hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-emerald-100 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Plus size={18} />
            Add Branch
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Total */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Branches</p>
              <h3 className="text-2xl font-black text-slate-800 leading-tight">{stats.total}</h3>
            </div>
          </div>

          {/* Card 2: Active */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <Activity size={24} className="animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active Locations</p>
              <h3 className="text-2xl font-black text-slate-800 leading-tight text-emerald-600">{stats.active}</h3>
            </div>
          </div>

          {/* Card 3: Inactive */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Inactive Locations</p>
              <h3 className="text-2xl font-black text-slate-800 leading-tight text-slate-500">{stats.inactive}</h3>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-1.5 shrink-0">
          <BranchSearch />
          <BranchFilters />
        </div>

        {/* Main List Layouts */}
        {isLoading ? (
          <BranchSkeleton />
        ) : isError ? (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-8 flex flex-col items-center justify-center text-center max-w-md mx-auto my-12">
            <AlertCircle size={40} className="text-red-500 mb-4" />
            <h3 className="text-base font-extrabold text-red-800 mb-1">Failed to fetch branches</h3>
            <p className="text-red-600/80 text-xs font-semibold mb-5 leading-relaxed">
              We encountered an issue connecting to the database server. Please check your network and retry.
            </p>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-200 transition active:scale-95 cursor-pointer"
            >
              <RefreshCw size={14} />
              Retry Connection
            </button>
          </div>
        ) : branches.length === 0 ? (
          <EmptyState onCreateClick={handleOpenCreate} />
        ) : (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <BranchTable
              branches={branches}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />

            {/* Mobile Cards Grid View */}
            <div className="grid grid-cols-1 gap-4 md:hidden">
              {branches.map((b) => (
                <BranchCard
                  key={b.id || b._id}
                  branch={b}
                  onEdit={() => handleOpenEdit(b)}
                  onDelete={() => handleOpenDelete(b)}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            <BranchPagination />
          </div>
        )}

        {/* Form Creation/Edit Popup Modal */}
        <BranchFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          branch={selectedBranch}
          onSubmit={handleFormSubmit}
          loading={createMutation.isPending || updateMutation.isPending}
        />

        {/* Delete Confirmation Alert Dialog */}
        <DeleteBranchDialog
          isOpen={isDeleteOpen}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDeleteConfirm}
          branchName={selectedBranch?.name || ""}
          loading={deleteMutation.isPending}
        />
      </div>
    </main>
  );
}
