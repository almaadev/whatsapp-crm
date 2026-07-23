import React from "react";
import { AlertCircle } from "lucide-react";

/**
 * ChatStatusBanner component displayed when a conversation is closed.
 */
export default function ChatStatusBanner({ isClosed }) {
  if (!isClosed) return null;

  return (
    <div className="bg-amber-50/90 border border-amber-200/80 text-amber-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm animate-in fade-in duration-200 select-none">
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle size={15} className="text-amber-600 shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-1.5 truncate">
          <span className="font-bold">This conversation has been closed.</span>
          <span className="text-amber-700">Reopen the chat to continue messaging.</span>
        </div>
      </div>
    </div>
  );
}
