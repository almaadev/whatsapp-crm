import { useBranchStore } from "@/features/branches/stores/branchStore";

export default function BranchFilters() {
  const selectedStatus = useBranchStore((state) => state.selectedStatus);
  const setSelectedStatus = useBranchStore((state) => state.setSelectedStatus);
  const setPagination = useBranchStore((state) => state.setPagination);

  const handleStatusChange = (status) => {
    setSelectedStatus(status);
    setPagination({ page: 1 });
  };

  const statuses = [
    { label: "All Statuses", value: "" },
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
  ];

  return (
    <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl shrink-0 select-none">
      {statuses.map((s) => {
        const isActive = selectedStatus === s.value;
        return (
          <button
            key={s.value}
            onClick={() => handleStatusChange(s.value)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isActive
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
