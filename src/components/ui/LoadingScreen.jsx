"use client";

import { Loader2 } from "lucide-react";

export default function LoadingScreen({ message = "Loading..." }) {
  return (
    <div className="flex flex-1 h-full items-center justify-center text-slate-500 font-bold tracking-widest uppercase text-sm">
      <Loader2 className="animate-spin mr-2" size={20} />
      {message}
    </div>
  );
}
