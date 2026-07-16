"use client";
import { useState, useEffect, useRef } from "react";
import { 
  X, Bell, Calendar, Clock, MessageSquare, 
  Loader2, Sparkles, Check, Trash2, AlertCircle, User 
} from "lucide-react";
import { toast } from "react-toastify";
import { reminderRepository } from "@/shared/api/repositories/reminderRepository";

export default function ReminderModal({ isOpen, onClose, onSet, initialPhone }) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [existingReminder, setExistingReminder] = useState(null);

  // Refs for custom input triggers
  const dateInputRef = useRef(null);
  const timeInputRef = useRef(null);

  // Check for existing reminder when modal opens
  useEffect(() => {
    if (isOpen && initialPhone) {
        checkActiveReminder();
    } else {
        resetForm();
    }
  }, [isOpen, initialPhone]);

  const checkActiveReminder = async () => {
      setFetching(true);
      try {
          const { data } = await reminderRepository.getReminder(initialPhone);
          if (data.success && data.reminder) {
              setExistingReminder(data.reminder);
          } else {
              setExistingReminder(null);
          }
      } catch (e) { console.error(e); }
      finally { setFetching(false); }
  };

  const resetForm = () => {
      setMessage("");
      setDate("");
      setTime("");
      setExistingReminder(null);
      setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !time || !message) return;

    setLoading(true);
    await onSet({ date, time, message });
    setLoading(false);
    onClose();
    resetForm();
  };

  const handleCancelReminder = async () => {
      setLoading(true);
      try {
          await reminderRepository.cancelReminder(initialPhone);
          toast.info("Reminder Cancelled");
          setExistingReminder(null); // Switch back to 'Set' mode
      } catch (e) {
          toast.error("Error canceling reminder");
      } finally {
          setLoading(false);
      }
  };

  // Helper Functions
  const getFormattedDate = (val) => {
    if (!val) return "Select Date";
    const d = new Date(val);
    return d.toLocaleDateString("en-US", { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getFormattedTime = (val) => {
    if (!val) return "Select Time";
    const [h, m] = val.split(":");
    const d = new Date();
    d.setHours(h);
    d.setMinutes(m);
    return d.toLocaleTimeString("en-US", { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatScheduledTime = (isoString) => {
      const d = new Date(isoString);
      return d.toLocaleString("en-US", { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute:'2-digit' });
  };

  if (!isOpen) return null;

  const isValid = date && time && message;

  return (
    <div className="fixed  top-0 right-0 z-[100]  p-4 sm:p-6  animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-300 border border-white/20">
        
        {/* Header */}
        <div className={`px-8 py-6 border-b flex items-center justify-between transition-colors ${existingReminder ? 'bg-amber-50 border-amber-100' : 'bg-gradient-to-br from-emerald-50 via-white to-white border-emerald-100/50'}`}>
          <div className="flex items-center gap-4">
            <div className="relative group">
                <div className={`absolute inset-0 rounded-xl blur opacity-20 transition-opacity ${existingReminder ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                <div className={`relative p-3 bg-white border rounded-xl shadow-sm ${existingReminder ? 'border-amber-200 text-amber-600' : 'border-emerald-100 text-emerald-600'}`}>
                    {existingReminder ? <AlertCircle size={22}/> : <Bell size={22} />}
                </div>
            </div>
            <div>
                <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                    {existingReminder ? "Pending Reminder" : "Set Reminder"}
                    {!existingReminder && <Sparkles size={14} className="text-amber-400"/>}
                </h3>
                <p className="text-xs font-medium text-slate-400 mt-0.5">
                    {existingReminder ? "Scheduled for this customer" : "Automate your follow-ups"}
                </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all active:scale-90"><X size={20} /></button>
        </div>

        {/* Content */}
        <div className="p-8">
            {fetching ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-2">
                    <Loader2 size={30} className="animate-spin text-emerald-500" />
                    <span className="text-xs font-medium">Checking schedule...</span>
                </div>
            ) : existingReminder ? (
                // --- EXISTING REMINDER VIEW ---
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-3 text-slate-700">
                            <Calendar size={18} className="text-slate-400"/>
                            <span className="font-bold text-sm">{formatScheduledTime(existingReminder.date)}</span>
                        </div>
                        <div className="flex gap-3">
                            <MessageSquare size={18} className="text-slate-400 mt-0.5 shrink-0"/>
                            <p className="text-sm text-slate-600 italic leading-relaxed">"{existingReminder.message}"</p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100">
                            <User size={12}/> Set by {existingReminder.associate}
                        </div>
                    </div>

                    <button 
                        onClick={handleCancelReminder}
                        disabled={loading}
                        className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 hover:border-red-200 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
                        <span>Stop Reminder</span>
                    </button>
                </div>
            ) : (
                // --- SET REMINDER FORM (Rich Inputs) ---
                <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-2 gap-5">
                        
                        {/* RICH DATE INPUT */}
                        <div 
                            className={`relative group w-full cursor-pointer p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between ${date ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-md'}`}
                            onClick={() => dateInputRef.current?.showPicker()}
                        >
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className={`p-2 rounded-lg transition-colors ${date ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                                    <Calendar size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date</span>
                                    <span className={`text-sm font-semibold truncate ${date ? 'text-slate-700' : 'text-slate-400'}`}>
                                        {getFormattedDate(date)}
                                    </span>
                                </div>
                            </div>
                            <input 
                                ref={dateInputRef}
                                type="date" 
                                required
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                min={new Date().toISOString().split("T")[0]}
                                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                            />
                        </div>

                        {/* RICH TIME INPUT */}
                        <div 
                            className={`relative group w-full cursor-pointer p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between ${time ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' : 'bg-slate-50 border-slate-200 hover:bg-white hover:shadow-md'}`}
                            onClick={() => timeInputRef.current?.showPicker()}
                        >
                            <div className="flex items-center gap-3 pointer-events-none">
                                <div className={`p-2 rounded-lg transition-colors ${time ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 shadow-sm'}`}>
                                    <Clock size={18} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time</span>
                                    <span className={`text-sm font-semibold truncate ${time ? 'text-slate-700' : 'text-slate-400'}`}>
                                        {getFormattedTime(time)}
                                    </span>
                                </div>
                            </div>
                            <input 
                                ref={timeInputRef}
                                type="time" 
                                required
                                value={time}
                                onChange={(e) => setTime(e.target.value)}
                                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2 group">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 ml-1 group-focus-within:text-emerald-600 transition-colors">
                            <MessageSquare size={14}/> Message
                        </label>
                        <div className={`relative rounded-2xl transition-all duration-300 ${message ? 'ring-2 ring-emerald-500/20' : ''}`}>
                            <textarea 
                                required
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Type the message to auto-send..."
                                rows={3}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm font-medium resize-none text-slate-700 placeholder:text-slate-400"
                            />
                            {message && (
                                <div className="absolute bottom-4 right-4 text-emerald-500 animate-in fade-in zoom-in">
                                    <Check size={16} />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={`transition-all duration-500 ease-in-out transform ${isValid ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-2 pointer-events-none'}`}>
                        <button 
                            type="submit" 
                            disabled={loading || !isValid}
                            className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:shadow-emerald-300 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Bell size={20} className="fill-emerald-500/20"/>}
                            <span>Schedule Reminder</span>
                        </button>
                    </div>
                </form>
            )}
        </div>
      </div>
    </div>
  );
}