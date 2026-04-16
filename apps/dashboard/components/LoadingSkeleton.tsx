export default function LoadingSkeleton({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-3 animate-pulse ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded-lg" style={{ opacity: 1 - i * 0.15 }} />
      ))}
    </div>
  );
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 animate-pulse ${className}`}>
      <div className="h-3 bg-slate-100 rounded w-24 mb-4" />
      <div className="h-7 bg-slate-100 rounded w-32 mb-2" />
      <div className="h-3 bg-slate-100 rounded w-20" />
    </div>
  );
}

export function ChartSkeleton({ height = 260, className = '' }: { height?: number; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white animate-pulse ${className}`}
      style={{ height }}
    >
      <div className="h-full flex items-end gap-1 p-4 pb-8">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-slate-100 rounded-t"
            style={{ height: `${20 + Math.sin(i) * 30 + 30}%` }}
          />
        ))}
      </div>
    </div>
  );
}
