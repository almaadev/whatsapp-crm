"use client";
import { LogOut, X, Check } from "lucide-react";

export default function SignOutModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-center md:justify-center items-center p-4 md:p-6 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm overflow-hidden scale-100 transition-all md:ml-20 md:mt-10  ">
        
        {/* Header */}
        <div className="bg-[#0b8343] p-4 flex items-center justify-between">
            <h3 className="text-white font-bold flex items-center gap-2">
                <LogOut size={18} className="text-red-400" />
                Confirm Sign Out
            </h3>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition">
                <X size={20} />
            </button>
        </div>

        {/* Body */}
        <div className="p-6">
            <p className="text-slate-600 text-sm font-medium mb-6">
                Are you sure you want to sign out of your account?
            </p>

            <div className="flex gap-3">
                <button 
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
                >
                    <X size={16} /> No, Stay
                </button>
                <button 
                    onClick={onConfirm}
                    className="flex-1 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-red-200 transition-all"
                >
                    <Check size={16} /> Yes, Sign Out
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}