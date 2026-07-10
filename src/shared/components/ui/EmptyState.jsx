"use client";

export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
      {Icon && <Icon size={48} className="mb-4 opacity-20" />}
      <p className="text-sm font-bold text-slate-600">{title}</p>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
