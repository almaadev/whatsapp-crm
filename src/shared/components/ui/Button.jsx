"use client";

const variants = {
  primary:
    "bg-[var(--brand-primary)] hover:bg-emerald-600 text-white shadow-md shadow-emerald-200/50",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-sm",
  ghost: "text-slate-500 hover:bg-slate-100 border border-transparent hover:border-slate-200",
  danger: "bg-rose-500 hover:bg-rose-600 text-white shadow-sm",
  icon: "p-2 text-slate-500 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl",
};

const sizes = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  ...props
}) {
  return (
    <button
      disabled={disabled}
      className={`
        inline-flex items-center justify-center gap-2 rounded-xl font-bold
        transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:active:scale-100
        ${variants[variant] || variants.primary}
        ${variant !== "icon" ? sizes[size] || sizes.md : ""}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
