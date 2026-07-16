import { ChevronLeft, ChevronRight } from "lucide-react";
import { useBranchStore } from "@/store/branchStore";

export default function BranchPagination() {
  const pagination = useBranchStore((state) => state.pagination);
  const setPagination = useBranchStore((state) => state.setPagination);

  const { page, limit, total, pages } = pagination;

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pages) {
      setPagination({ page: newPage });
    }
  };

  const handleLimitChange = (e) => {
    setPagination({ limit: parseInt(e.target.value), page: 1 });
  };

  const pageNumbers = [];
  // Build standard slide window for pages if too large
  let startPage = Math.max(1, page - 2);
  let endPage = Math.min(pages, page + 2);
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  if (total === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 select-none">
      {/* Total Overview */}
      <span className="text-xs text-slate-500 font-semibold text-center sm:text-left">
        Showing <span className="font-bold text-slate-800">{Math.min((page - 1) * limit + 1, total)}</span> to{" "}
        <span className="font-bold text-slate-800">{Math.min(page * limit, total)}</span> of{" "}
        <span className="font-bold text-slate-800">{total}</span> branches
      </span>

      {/* Pagination Controls */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        {/* Rows per page */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold">Rows per page:</span>
          <select
            value={limit}
            onChange={handleLimitChange}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold py-1.5 px-3 rounded-lg outline-none cursor-pointer focus:ring-2 focus:ring-[#00a884]/20 focus:border-[#00a884]"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ChevronLeft size={16} />
          </button>

          {startPage > 1 && (
            <>
              <button
                onClick={() => handlePageChange(1)}
                className="w-9 h-9 rounded-lg text-xs font-bold border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                1
              </button>
              {startPage > 2 && <span className="text-slate-400 text-xs">...</span>}
            </>
          )}

          {pageNumbers.map((num) => {
            const isCurrent = num === page;
            return (
              <button
                key={num}
                onClick={() => handlePageChange(num)}
                className={`w-9 h-9 rounded-lg text-xs font-bold transition cursor-pointer ${
                  isCurrent
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {num}
              </button>
            );
          })}

          {endPage < pages && (
            <>
              {endPage < pages - 1 && <span className="text-slate-400 text-xs">...</span>}
              <button
                onClick={() => handlePageChange(pages)}
                className="w-9 h-9 rounded-lg text-xs font-bold border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                {pages}
              </button>
            </>
          )}

          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === pages}
            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent disabled:cursor-not-allowed transition cursor-pointer"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
