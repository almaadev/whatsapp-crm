import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { useBranchStore } from "@/features/branches/stores/branchStore";

export default function BranchSearch() {
  const setSearchText = useBranchStore((state) => state.setSearchText);
  const searchText = useBranchStore((state) => state.searchText);
  const [localSearch, setLocalSearch] = useState(searchText);

  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchText(localSearch);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [localSearch, setSearchText]);

  useEffect(() => {
    setLocalSearch(searchText);
  }, [searchText]);

  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
      <input
        type="text"
        placeholder="Search by name, email, phone..."
        value={localSearch}
        onChange={(e) => setLocalSearch(e.target.value)}
        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884] transition-all text-sm font-medium text-slate-800"
      />
      {localSearch && (
        <button
          onClick={() => setLocalSearch("")}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}
