interface Bar {
  label: string;
  value: number;
  sub?: string;
}

export default function BarChart({ bars, color = '#00a9d6' }: { bars: Bar[]; color?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <div className="flex items-end gap-2 h-40">
      {bars.map((b, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0" title={`${b.label}: ${b.value}${b.sub ? ` · ${b.sub}` : ''}`}>
          <div className="text-xs font-semibold text-gray-600">{b.value}</div>
          <div
            className="w-full rounded-t-md"
            style={{ height: `${Math.max(2, (b.value / max) * 100)}%`, backgroundColor: color }}
          />
          {b.sub ? <div className="text-[9px] text-gray-400 truncate w-full text-center">{b.sub}</div> : <div className="h-3" />}
          <div className="text-[10px] text-gray-400 truncate w-full text-center">{b.label}</div>
        </div>
      ))}
    </div>
  );
}