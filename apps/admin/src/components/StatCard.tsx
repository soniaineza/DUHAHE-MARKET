import type { ReactNode } from 'react';
import { TrendUpIcon, TrendDownIcon } from './Icons';

export interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  iconBg?: string;
  spark?: number[];
  delta?: number | null;
  accent?: boolean;
}

export default function StatCard({ label, value, hint, icon, iconBg = 'bg-leaf-50 text-leaf-600', spark, delta, accent }: StatCardProps) {
  const deltaUp = (delta ?? 0) >= 0;
  return (
    <div className={`card p-5 ${accent ? 'bg-gradient-to-br from-leaf-600 to-leaf-700 border-leaf-500 text-white' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${accent ? 'bg-white/15 text-white' : iconBg}`}>
          {icon}
        </div>
        {delta != null && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            accent
              ? deltaUp ? 'bg-white/20 text-white' : 'bg-white/20 text-white'
              : deltaUp ? 'bg-leaf-50 text-leaf-700' : 'bg-red-50 text-red-600'
          }`}>
            {deltaUp ? <TrendUpIcon size={12} /> : <TrendDownIcon size={12} />}
            {deltaUp ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <div className={`mt-4 text-[11px] font-bold uppercase tracking-wide ${accent ? 'text-leaf-100' : 'text-muted'}`}>{label}</div>
      <div className={`mt-1 text-2xl font-black tracking-tight ${accent ? 'text-white' : 'text-ink'}`}>{value}</div>
      {spark && spark.length > 1 && (
        <div className="mt-3 flex h-8 items-end gap-1">
          {spark.map((v, i) => (
            <div
              key={i}
              className={`flex-1 rounded-sm ${accent ? 'bg-white/30' : 'bg-leaf-200'}`}
              style={{ height: `${Math.max((v / Math.max(...spark)) * 100, 12)}%` }}
            />
          ))}
        </div>
      )}
      {hint && <div className={`mt-2 text-xs ${accent ? 'text-leaf-100' : 'text-faint'}`}>{hint}</div>}
    </div>
  );
}