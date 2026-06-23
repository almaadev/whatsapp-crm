"use client";

import { ShieldAlert } from "lucide-react";

export default function AccessDenied({
  title = "Access Denied",
  message = "You do not have permission to view this page.",
}) {
  return (
    <div className="flex flex-1 w-full h-full flex-col items-center justify-center p-6 text-center">
      <ShieldAlert size={72} className="text-rose-400 mb-6" />
      <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">{title}</h2>
      <p className="text-slate-500 mt-2 font-medium max-w-md">{message}</p>
    </div>
  );
}
