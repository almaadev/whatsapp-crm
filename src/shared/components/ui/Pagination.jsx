"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  currentPage,
  totalPages,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}) {
  const start = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalRecords);

  const pages = [];
  const maxVisiblePages = 5;
  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);
    if (currentPage <= 2) {
      endPage = 3;
    } else if (currentPage >= totalPages - 1) {
      startPage = totalPages - 2;
    }
    if (startPage > 2) pages.push("...");
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    if (endPage < totalPages - 1) pages.push("...");
    pages.push(totalPages);
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-between min-h-[56px] px-6 py-3.5 md:py-0 border-t border-slate-200 bg-slate-50 gap-4 text-[12px] font-medium text-slate-500 w-full select-none">
      {/* Left side: Range and page size */}
      <div className="flex flex-wrap items-center justify-between md:justify-start w-full md:w-auto gap-4">
        <span className="text-slate-550 whitespace-nowrap">
          Showing {start}–{end} of {totalRecords}
        </span>
        <div className="h-4 w-px bg-slate-250 hidden md:block"></div>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap">Rows per page:</span>
          <div className="relative">
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="bg-white border border-slate-200 rounded-md py-1 pl-2.5 pr-6 font-bold text-slate-700 outline-none cursor-pointer hover:border-slate-300 focus:border-[#00a884] transition-colors appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2364748B%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E')] bg-[length:8px_8px] bg-[position:right_8px_center] bg-no-repeat"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Center side: Page info */}
      <div className="hidden md:block text-slate-450 font-medium">
        Page {currentPage} of {totalPages || 1}
      </div>

      {/* Right side: Navigation buttons */}
      <div className="flex items-center justify-between md:justify-end w-full md:w-auto gap-4">
        {/* Mobile Page indicator */}
        <span className="block md:hidden text-slate-450 font-medium">
          Page {currentPage} of {totalPages || 1}
        </span>

        <div className="flex items-center gap-4">
          <button
            onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
            className="w-9 h-9 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-650 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="hidden sm:flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === "...") {
                return (
                  <span key={idx} className="w-9 h-9 flex items-center justify-center text-slate-400 font-bold">
                    ...
                  </span>
                );
              }
              const isActive = currentPage === p;
              return (
                <button
                  key={idx}
                  onClick={() => onPageChange(p)}
                  className={`w-9 h-9 flex items-center justify-center rounded-md text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#00a884] text-white border border-[#00a884]"
                      : "bg-transparent text-slate-650 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
            disabled={currentPage === totalPages || totalPages === 0}
            className="w-9 h-9 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-650 hover:bg-slate-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Next Page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
