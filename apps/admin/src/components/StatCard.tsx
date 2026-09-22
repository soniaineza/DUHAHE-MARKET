import type { ReactNode } from 'react';

export interface StatCellProps {
  label: string;
  value: string;
  hint?: ReactNode;
  delta?: number | null;
  icon?: ReactNode;
}

function Delta({ value }: { value: number | null }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${up ? 'text-status-delivered' : 'text-red-600'}`}>
      {up ? '↑' : '↓'}
      {Math.abs(value)}%
    </span>
  );
}

/**
 * One metric cell inside the divided KPI strip. Typography-first:
 * small label, large number, contextual line. No icon boxes.
 */
export default function StatCard({ label, value, hint, delta, icon }: StatCellProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-4">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-faint">
        {icon && <span className="text-faint">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <div className="metric-value tabular-nums">{value}</div>
      <div className="flex min-h-4 items-center gap-1.5 text-xs text-muted">
        <Delta value={delta ?? null} />
        {hint && <span className="truncate">{hint}</span>}
      </div>
    </div>
  );
}
