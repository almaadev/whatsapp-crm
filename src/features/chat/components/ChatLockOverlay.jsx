import React from "react";
import { Lock } from "lucide-react";

/**
 * ChatLockOverlay component displayed strictly inside the message area container when a conversation is locked by another user.
 * 
 * Features:
 * - Does NOT cover or block Customer List, Search, Sidebar, or Header.
 * - Does NOT use expensive full-page backdrop-blur filters.
 * - Displays a centered, high-contrast lock card with handler details.
 * - Keeps messages underneath visible while disabling actions in ChatInput.
 */
export default function ChatLockOverlay({ handler }) {
  if (!handler) return null;

  const lockName = handler.name || handler.userId || "Another user";

  return (
    <div className="absolute inset-0 z-30 bg-slate-900/10 flex items-center justify-center pointer-events-none select-none animate-in fade-in duration-150 p-4">
      <div className="bg-white/95 text-slate-800 px-6 py-4 rounded-2xl shadow-xl border border-red-100/90 flex items-center gap-3.5 max-w-sm pointer-events-auto animate-in zoom-in-95 duration-150">
        <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center shrink-0 border border-red-100">
          <Lock size={20} />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-sm text-slate-900 truncate">
            Locked by {lockName}
          </span>
          <span className="text-xs text-slate-500 font-medium mt-0.5 leading-snug">
            {lockName} is currently handling this conversation.
          </span>
        </div>
      </div>
    </div>
  );
}
