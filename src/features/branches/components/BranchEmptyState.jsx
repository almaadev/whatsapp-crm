import { Plus, Building2 } from "lucide-react";

export default function EmptyState({ onCreateClick }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 md:p-16 bg-white border border-slate-200 rounded-3xl text-center shadow-sm w-full my-4">
      <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-[#00a884] mb-6 border border-emerald-100 shadow-inner">
        <Building2 size={32} />
      </div>
      <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">No branches found</h3>
      <p className="text-slate-500 text-sm max-w-sm font-medium mb-6 leading-relaxed">
        Create your first branch to get started managing locations, associates, and templates.
      </p>
      <button
        onClick={onCreateClick}
        className="flex items-center gap-2 bg-[#00a884] hover:bg-emerald-600 text-white px-5 py-3 rounded-xl text-sm font-bold shadow-md shadow-emerald-100 transition-all active:scale-95"
      >
        <Plus size={18} />
        Create Branch
      </button>
    </div>
  );
}
