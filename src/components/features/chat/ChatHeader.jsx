import React, { useState, memo } from "react";
import { FileText, ToggleLeft, ToggleRight, ChevronLeft, Bell, Share2, Info, User, History, MapPin } from "lucide-react";
import { getStatusColor } from "@/utils/colorUtils";

const ChatHeader = memo(function ChatHeader({ activeChat, userName, isChatClosed, isToggling, onToggle, onStatusChange, onBack, onInfo, onReminder, onForward }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const displayName = activeChat.name || (activeChat.phone ? activeChat.phone.replace("whatsapp:", "") : "Unknown");
  const statusColor = getStatusColor(activeChat.status);

  return (
    <div className="bg-[#f0f2f5] border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-20">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-500 hover:bg-slate-200 rounded-full">
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-3 cursor-pointer" onClick={onInfo}>
          <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-bold shrink-0">{displayName.charAt(0).toUpperCase()}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-800 text-base truncate">{displayName}</h2>
              {activeChat?.city && (
                <div className="hidden lg:flex items-center gap-1 text-[11px] font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                  <MapPin size={12} /> {activeChat.city}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 truncate mb-0.5">{activeChat.phone?.replace("whatsapp:", "")}</p>

            <div className="flex items-center gap-2 text-[12px] font-medium tracking-tight">
              {activeChat.currentHandler && activeChat.currentHandler !== userName && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded border bg-slate-200/50 text-slate-600 border-slate-200"><User size={10} /> Prev: {activeChat.currentHandler}</span>
              )}
              {activeChat.lastClosedBy && (
                <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100"><History size={10} /> Closed By: {activeChat.lastClosedBy}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={onToggle} disabled={isToggling} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all shadow-sm ${isChatClosed ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"}`}>
          {isToggling ? (
            <span className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          ) : isChatClosed ? (
            <ToggleLeft size={16} />
          ) : (
            <ToggleRight size={16} />
          )}
          <span>{isChatClosed ? "Closed" : "Active"}</span>
        </button>

        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1.5 bg-blue-50 text-blue-800 hover:bg-blue-100 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors shadow-sm" title="Change Status">
            <FileText size={16} />
            <span className="hidden sm:inline">{activeChat.status || "New"}</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in zoom-in-95">
              {["Follow Up", "Closed", "Not Interested"].map((st) => (
                <button key={st} onClick={() => { onStatusChange(st); setMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700 font-medium">{st}</button>
              ))}
            </div>
          )}
        </div>
        <button onClick={onReminder} className="p-2 text-indigo-500 hover:bg-indigo-200 rounded-full transition-colors" disabled title="This feature is not available yet"><Bell size={20} /></button>
        <button onClick={onForward} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full" disabled title="This feature is not available yet"><Share2 size={20} /></button>
        <button onClick={onInfo} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full" title="Customer Info"><Info size={20} /></button>
      </div>
    </div>
  );
});

export default ChatHeader;
