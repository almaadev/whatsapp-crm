import { useState, useRef, useEffect } from "react";
import { MoreVertical, Edit2, Trash2 } from "lucide-react";

export default function ActionsMenu({ onEdit, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-700 transition cursor-pointer select-none"
        aria-label="Actions"
      >
        <MoreVertical size={16} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-32 bg-white border border-slate-200 rounded-xl shadow-xl z-30 py-1.5 animate-in fade-in slide-in-from-top-1 duration-150 select-none">
          <button
            onClick={() => {
              setIsOpen(false);
              onEdit();
            }}
            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5"
          >
            <Edit2 size={14} className="text-blue-500" />
            Edit
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              onDelete();
            }}
            className="w-full text-left px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer transition-all active:translate-x-0.5"
          >
            <Trash2 size={14} className="text-red-500" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
