"use client";

export default function DashboardSection({ title, subtitle, children, className = "" }) {
  return (
    <section className={`space-y-4 ${className}`}>
      {(title || subtitle) && (
        <div className="space-y-1 select-none">
          {title && (
            <h2 className="text-[20px] font-extrabold text-slate-805 tracking-tight leading-tight">
              {title}
            </h2>
          )}
          {subtitle && (
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none mt-1">
              {subtitle}
            </p>
          )}
        </div>
      )}
      <div className="w-full">{children}</div>
    </section>
  );
}
