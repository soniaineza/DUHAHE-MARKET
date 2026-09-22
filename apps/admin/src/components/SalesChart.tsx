import { useMemo, useState } from 'react';
import { useAdminI18n } from '../i18n';

interface Point {
  label: string;
  value: number;
}

type Metric = 'orders' | 'revenue';

/* Editorial palette: ink black line for orders, warm amber for revenue. */
const SWATCH = { orders: '#111111', revenue: '#d97706' };
const LINE = '#e5e0d3'; /* warm hairline gridlines */
const AXIS = '#a39e92'; /* warm muted axis labels */
const GUIDE = '#c9c1aa'; /* hover guide */
const H = 180;
const PAD = { top: 14, right: 12, bottom: 26, left: 44 };

export default function SalesChart({ orders, revenue }: { orders: Point[]; revenue: Point[] }) {
  const { t } = useAdminI18n();
  const [metric, setMetric] = useState<Metric>('orders');
  const [hover, setHover] = useState<number | null>(null);

  const series = metric === 'orders' ? orders : revenue;
  const color = SWATCH[metric];
  const suffix = metric === 'orders' ? t('orderCount') : 'RWF';

  const { points, areaPath, linePath, ticks } = useMemo(() => {
    const max = Math.max(1, ...series.map((p) => p.value));
    const step = max <= 5 ? 1 : Math.ceil(max / 4);
    const ticks: number[] = [];
    for (let v = 0; v <= max + step * 0.01; v += step) ticks.push(v);
    const top = ticks[ticks.length - 1];
    const innerW = Math.max(1, 560 - PAD.left - PAD.right);
    const innerH = H - PAD.top - PAD.bottom;
    const points = series.map((p, i) => ({
      ...p,
      x: PAD.left + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW),
      y: PAD.top + innerH - (p.value / top) * innerH,
    }));
    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    const areaPath = points.length
      ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${PAD.top + innerH} L${points[0].x.toFixed(1)},${PAD.top + innerH} Z`
      : '';
    return { points, areaPath, linePath, ticks, top };
  }, [series]);

  return (
    <section className="panel flex flex-col p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-ink">{t('lastSeven')}</h2>
          <p className="metadata mt-0.5">{t('volumeDay')}</p>
        </div>
        <div className="flex rounded-lg border border-line p-0.5" role="tablist">
          {(['orders', 'revenue'] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={metric === m}
              onClick={() => setMetric(m)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-colors duration-150 ${
                metric === m ? 'bg-ink text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {m === 'orders' ? t('orders') : t('totalRevenue')}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-4">
        <svg
          viewBox={`0 0 560 ${H}`}
          className="block h-auto w-full"
          style={{ height: 'auto' }}
          role="img"
          aria-label={t('lastSeven')}
          onMouseLeave={() => setHover(null)}
        >
          {/* horizontal gridlines + y-axis labels */}
          {ticks.map((v) => {
            const y = PAD.top + (1 - v / ticks[ticks.length - 1]) * (H - PAD.top - PAD.bottom);
            return (
              <g key={v}>
                <line x1={PAD.left} x2={560 - PAD.right} y1={y} y2={y} stroke={LINE} strokeWidth={1} />
                <text x={PAD.left - 8} y={y + 3.5} textAnchor="end" fontSize={10} fill={AXIS}>
                  {v >= 1000 ? `${(v / 1000).toLocaleString('en')}k` : v}
                </text>
              </g>
            );
          })}

          {/* area + line */}
          <path d={areaPath} fill={color} opacity={0.08} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

          {/* hover hit areas, markers, x labels */}
          {points.map((p, i) => (
            <g key={p.label}>
              <rect
                x={(i === 0 ? PAD.left : (points[i - 1].x + p.x) / 2) - 0.5}
                y={PAD.top}
                width={i === 0 ? (points[1]?.x ?? 560 - PAD.right) - PAD.left : i === points.length - 1 ? 560 - PAD.right - (points[i - 1].x + p.x) / 2 : (points[i + 1].x - points[i - 1].x) / 2 + 1}
                height={H - PAD.top - PAD.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
              {hover === i && <line x1={p.x} x2={p.x} y1={PAD.top} y2={H - PAD.bottom} stroke={GUIDE} strokeWidth={1} />}
              <circle cx={p.x} cy={p.y} r={hover === i ? 4 : 2.5} fill="#fff" stroke={color} strokeWidth={2} />
              <text x={p.x} y={H - 8} textAnchor="middle" fontSize={10} fill={AXIS}>
                {p.label}
              </text>
            </g>
          ))}
        </svg>

        {hover != null && points[hover] && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-white px-2.5 py-1.5 text-xs shadow-sm"
            style={{ left: `${(points[hover].x / 560) * 100}%`, top: `${(points[hover].y / H) * 100 - 2}%` }}
          >
            <div className="font-semibold text-ink">{points[hover].label}</div>
            <div className="text-muted">
              {points[hover].value.toLocaleString('en')} {suffix}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
