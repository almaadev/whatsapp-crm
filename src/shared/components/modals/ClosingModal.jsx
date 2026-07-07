import React from "react";
import { X, Check } from "lucide-react";

const ClosingModal = ({ note, setNote, onClose, onSubmit }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm transition-opacity">
    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95">
      <div className="px-6 pt-6 pb-2 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-emerald-700">Lead Closed! 🎉</h3>
          <p className="text-sm text-slate-500 mt-1">Add a quick note.</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
      </div>
      <div className="p-6 space-y-4">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full p-4 text-sm bg-emerald-50 border border-emerald-100 rounded-2xl outline-none" rows={4} autoFocus />
        <button onClick={() => onSubmit("Closed")} disabled={!note.trim()} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"><Check size={18} /> Confirm</button>
      </div>
    </div>
  </div>
);

export default ClosingModal;
