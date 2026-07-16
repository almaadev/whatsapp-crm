import { X, AlertTriangle, Loader2 } from "lucide-react";
import { useEffect } from "react";

export default function DeleteBranchDialog({ isOpen, onClose, onConfirm, branchName, loading = false }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden scale-100 transition-all flex flex-col select-none">
        {/* Header */}
        <div className="bg-rose-50 border-b border-rose-100 px-5 py-4 flex items-center justify-between">
          <h3 className="text-rose-700 font-extrabold text-sm flex items-center gap-2 tracking-tight uppercase">
            <AlertTriangle size={18} />
            Confirm Delete
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition cursor-pointer p-1 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-5">
          <div className="space-y-2">
            <p className="text-slate-700 text-sm font-semibold">
              Are you sure you want to delete the branch <span className="font-extrabold text-slate-800">"{branchName}"</span>?
            </p>
            <p className="text-slate-500 text-xs font-semibold leading-relaxed">
              This action cannot be undone and will remove the branch permanently.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-200 transition cursor-pointer disabled:opacity-75 active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 size={12} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
