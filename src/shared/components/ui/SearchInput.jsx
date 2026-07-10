"use client";

import { Search } from "lucide-react";

export default function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  inputClassName = "",
  ...props
}) {
  return (
    <div
      className={`flex items-center bg-slate-50 rounded-xl px-3 py-2 border border-slate-200 focus-within:border-[var(--brand-primary)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]/20 transition-all ${className}`}
    >
      <Search size={16} className="text-slate-400 shrink-0" />
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`bg-transparent border-none outline-none text-sm font-medium ml-2 w-full text-slate-700 placeholder:text-slate-400 ${inputClassName}`}
        {...props}
      />
    </div>
  );
}
