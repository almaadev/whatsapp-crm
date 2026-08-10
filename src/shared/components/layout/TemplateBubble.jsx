"use client";

import { useState, useRef, useEffect, memo, useMemo } from "react";
import { useTemplateStore } from "@/features/templates/stores/templateStore";
import { Search, X, Loader2, Layers } from "lucide-react";
import { useDebounce } from "@/shared/hooks/useDebounce";

export const TemplateBubble = memo(function TemplateBubble({
  onSelect,
  onClose,
  positionClasses = "absolute bottom-[70px] left-4", // Allow passing custom positioning
}) {
  const { templates, loading, fetchTemplates } = useTemplateStore();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const searchRef = useRef(null);

  useEffect(() => {
    fetchTemplates();
    // Auto-focus the search input when the bubble opens
    setTimeout(() => searchRef.current?.focus(), 50);
  }, [fetchTemplates]);

  const filtered = useMemo(
    () =>
      (templates || []).filter((t) =>
        t?.name?.toLowerCase().includes(debouncedSearch.toLowerCase())
      ),
    [templates, debouncedSearch]
  );

  return (
    <div
      className={`${positionClasses} w-72 sm:w-80 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200 z-50 origin-bottom-right`}
    >
      <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
        <Search size={14} className="text-slate-400" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Search templates (/)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-sm w-full text-slate-700 placeholder:text-slate-400"
        />
        <button
          onClick={onClose}
          className="p-1 hover:bg-slate-200 rounded-md text-slate-400 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {loading ? (
          <div className="p-6 flex justify-center">
            <Loader2 size={16} className="animate-spin text-[#00a884]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 font-medium">
            No templates match '{debouncedSearch}'
          </div>
        ) : (
          filtered.map((tpl) => (
            <button
              key={tpl._id || tpl.sid}
              onClick={() => {
                onSelect(tpl);
                onClose();
              }}
              className="w-full text-left p-3 rounded-xl hover:bg-emerald-50 hover:shadow-sm border border-transparent hover:border-emerald-100 transition-all group flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center shrink-0 transition-colors">
                <Layers
                  size={14}
                  className="text-slate-500 group-hover:text-emerald-600 transition-colors"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-700 group-hover:text-emerald-800 truncate transition-colors">
                  {tpl.name}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
});