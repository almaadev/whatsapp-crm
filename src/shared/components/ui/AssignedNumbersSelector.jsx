"use client";

import React, { useState, useMemo } from "react";
import { Search, Smartphone, Check, X, ShieldAlert } from "lucide-react";

export default function AssignedNumbersSelector({
  availableNumbers = [],
  selectedIds = [],
  onChange,
  label = "Assigned WhatsApp Numbers",
  subtitle = "Select WhatsApp Business numbers assigned to this user.",
  disabled = false,
  emptyMessage = "No sender numbers available for assignment.",
}) {
  const [search, setSearch] = useState("");

  const filteredNumbers = useMemo(() => {
    if (!search.trim()) return availableNumbers;
    const q = search.toLowerCase();
    return availableNumbers.filter(
      (n) =>
        n.friendlyName?.toLowerCase().includes(q) ||
        n.phoneNumber?.includes(q)
    );
  }, [availableNumbers, search]);

  const handleToggle = (id) => {
    if (disabled) return;
    const current = new Set(selectedIds.map(String));
    if (current.has(String(id))) {
      current.delete(String(id));
    } else {
      current.add(String(id));
    }
    onChange(Array.from(current));
  };

  const handleSelectAll = () => {
    if (disabled) return;
    if (selectedIds.length === availableNumbers.length) {
      onChange([]);
    } else {
      onChange(availableNumbers.map((n) => (n._id || n.id).toString()));
    }
  };

  return (
    <div className="bg-slate-50/70 rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/60 pb-3">
        <div>
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Smartphone size={16} className="text-emerald-600" />
            {label}
          </h4>
          {subtitle && (
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {availableNumbers.length > 0 && !disabled && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
          >
            {selectedIds.length === availableNumbers.length
              ? "Deselect All"
              : "Select All"}
          </button>
        )}
      </div>

      {/* Search Input */}
      {availableNumbers.length > 3 && (
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search sender name or phone number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all"
          />
        </div>
      )}

      {/* Number Cards Grid */}
      {availableNumbers.length === 0 ? (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3 text-amber-800 text-xs font-medium">
          <ShieldAlert size={18} className="shrink-0 text-amber-600" />
          <span>{emptyMessage}</span>
        </div>
      ) : filteredNumbers.length === 0 ? (
        <div className="p-4 text-center text-xs font-bold text-slate-400">
          No sender numbers match "{search}".
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto custom-scrollbar p-0.5">
          {filteredNumbers.map((num) => {
            const numId = (num._id || num.id).toString();
            const isSelected = selectedIds.some((id) => String(id) === numId);

            return (
              <div
                key={numId}
                onClick={() => handleToggle(numId)}
                className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between gap-3 ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/70 shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800 truncate">
                      {num.friendlyName || "Sender Number"}
                    </span>
                    {num.status === "active" ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    ) : (
                      <span className="inline-block w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-slate-500 font-mono mt-0.5 truncate">
                    {num.phoneNumber}
                  </div>
                </div>

                <div
                  className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                    isSelected
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "bg-white border-slate-300 text-transparent"
                  }`}
                >
                  <Check size={12} strokeWidth={3} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Summary Chips */}
      {selectedIds.length > 0 && (
        <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-1">
            Selected ({selectedIds.length}):
          </span>
          {availableNumbers
            .filter((n) => selectedIds.some((id) => String(id) === String(n._id || n.id)))
            .map((n) => (
              <span
                key={n._id || n.id}
                className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-emerald-200"
              >
                <span>{n.friendlyName}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggle(n._id || n.id);
                    }}
                    className="hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
