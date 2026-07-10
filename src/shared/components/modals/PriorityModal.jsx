"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Flag, AlertCircle, Clock, 
  Loader2, MessageSquareText, Activity 
} from "lucide-react";

const PRIORITY_OPTIONS = [
  {
    id: "High",
    title: "High Priority",
    desc: "Immediate action required",
    icon: AlertCircle,
    activeClasses: "border-rose-500 bg-rose-50/60 shadow-sm shadow-rose-100/50 ring-4 ring-rose-500/10",
    iconClasses: "text-rose-600 bg-rose-100",
    hoverClasses: "hover:border-rose-200 hover:bg-rose-50/30"
  },
  {
    id: "Medium",
    title: "Medium Priority",
    desc: "Needs attention soon",
    icon: Clock,
    activeClasses: "border-amber-500 bg-amber-50/60 shadow-sm shadow-amber-100/50 ring-4 ring-amber-500/10",
    iconClasses: "text-amber-600 bg-amber-100",
    hoverClasses: "hover:border-amber-200 hover:bg-amber-50/30"
  },
  {
    id: "Low",
    title: "Routine Priority",
    desc: "Standard follow-up",
    icon: Flag,
    activeClasses: "border-emerald-500 bg-emerald-50/60 shadow-sm shadow-emerald-100/50 ring-4 ring-emerald-500/10",
    iconClasses: "text-emerald-600 bg-emerald-100",
    hoverClasses: "hover:border-emerald-200 hover:bg-emerald-50/30"
  }
];

const PriorityModal = ({ note, setNote, onClose, onSubmit }) => {
  const [selectedPriority, setSelectedPriority] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!selectedPriority) return;
    setIsSubmitting(true);
    try {
      // Preserve the original onSubmit signature
      await onSubmit("Follow Up", selectedPriority);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Framer Motion Variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  const modalVariants = {
    hidden: { opacity: 0, y: 40, scale: 0.96 },
    visible: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { type: "spring", damping: 25, stiffness: 300 } 
    },
    exit: { opacity: 0, y: 20, scale: 0.96 }
  };

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6"
        initial="hidden"
        animate="visible"
        exit="hidden"
      >
        {/* Luxury Backdrop with radial gradient and blur */}
        <motion.div 
          variants={backdropVariants}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          style={{ background: 'radial-gradient(circle at center, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.7) 100%)' }}
        />

        <motion.div 
          variants={modalVariants}
          className="relative w-full max-w-xl bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200/60"
        >
          {/* Header Section */}
          <div className="px-6 sm:px-8 pt-8 pb-5 flex items-start justify-between bg-white/80 backdrop-blur-sm z-10">
            <div className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0 shadow-inner">
                <Activity size={24} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  Set Follow-Up Priority
                </h3>
                <p className="text-sm font-medium text-slate-500 mt-1">
                  Define urgency and capture context for the next step.
                </p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all active:scale-95"
            >
              <X size={20} />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="px-6 sm:px-8 pb-8 overflow-y-auto custom-scrollbar space-y-8 flex-1">
            
            {/* Smart Input Area */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2 pl-1">
                <MessageSquareText size={14} /> Context & Notes
              </label>
              <div className="relative group">
                <textarea 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  className="w-full p-4 pt-4 text-sm font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all resize-none shadow-inner placeholder:text-slate-400" 
                  placeholder="Add context for this follow-up..." 
                  rows={3} 
                />
                <div className="absolute bottom-3 right-4 text-[10px] font-bold text-slate-400">
                  {note.length} chars
                </div>
              </div>
            </div>

            {/* Priority Selection Cards */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 pl-1">
                Urgency Level
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PRIORITY_OPTIONS.map((option) => {
                  const isSelected = selectedPriority === option.id;
                  const Icon = option.icon;

                  return (
                    <motion.div
                      key={option.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedPriority(option.id)}
                      className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer overflow-hidden flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-3 text-left
                        ${isSelected ? option.activeClasses : `border-slate-100 bg-white ${option.hoverClasses}`}
                      `}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isSelected ? option.iconClasses : 'bg-slate-100 text-slate-500'}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                          {option.title}
                        </h4>
                        <p className={`text-xs mt-0.5 font-medium ${isSelected ? 'text-slate-600' : 'text-slate-400'}`}>
                          {option.desc}
                        </p>
                      </div>
                      
                      {/* Active State Indicator Dot */}
                      {isSelected && (
                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-current opacity-20 hidden sm:block" />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Bottom Action Bar */}
          <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row gap-3 sm:justify-end shrink-0 pb-safe">
            <button 
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-all disabled:opacity-50 order-2 sm:order-1"
            >
              Cancel
            </button>
            <button 
              onClick={handleConfirm}
              disabled={!selectedPriority || isSubmitting}
              className="px-8 py-3 text-sm font-bold text-white bg-indigo-600 rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none flex items-center justify-center gap-2 order-1 sm:order-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Confirming...
                </>
              ) : (
                "Confirm Follow-Up"
              )}
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PriorityModal;