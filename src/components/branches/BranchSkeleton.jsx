export default function BranchSkeleton() {
  return (
    <div className="w-full space-y-4">
      {/* Table Skeleton */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hidden md:block">
        <div className="h-12 bg-slate-50 border-b border-slate-100 flex items-center px-6">
          <div className="h-4 bg-slate-200 rounded w-1/5 animate-pulse" />
          <div className="h-4 bg-slate-200 rounded w-1/5 animate-pulse ml-6" />
          <div className="h-4 bg-slate-200 rounded w-1/5 animate-pulse ml-6" />
          <div className="h-4 bg-slate-200 rounded w-1/5 animate-pulse ml-6" />
          <div className="h-4 bg-slate-200 rounded w-12 animate-pulse ml-auto" />
        </div>
        <div className="divide-y divide-slate-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 flex items-center px-6 gap-6">
              <div className="h-4 bg-slate-100 rounded w-1/5 animate-pulse" />
              <div className="h-4 bg-slate-100 rounded w-1/5 animate-pulse" />
              <div className="h-4 bg-slate-100 rounded w-1/5 animate-pulse" />
              <div className="h-4 bg-slate-100 rounded w-1/5 animate-pulse" />
              <div className="h-8 bg-slate-100 rounded-lg w-8 animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile Card Skeleton */}
      <div className="grid grid-cols-1 gap-4 md:hidden">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3 shadow-sm">
            <div className="h-5 bg-slate-200 rounded w-2/3 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse" />
            <div className="h-4 bg-slate-100 rounded w-3/4 animate-pulse" />
            <div className="flex justify-between items-center pt-2">
              <div className="h-6 bg-slate-100 rounded-full w-20 animate-pulse" />
              <div className="h-8 bg-slate-100 rounded-lg w-8 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
