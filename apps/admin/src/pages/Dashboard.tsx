import { useEffect, useMemo, useState } from 'react';
import { api, type Comparison, type DashboardStats } from '../api';
import StatCard from '../components/StatCard';
import SalesChart from '../components/SalesChart';
import { useAdminI18n } from '../i18n';

const fmtRWF = (n: number) => `${n.toLocaleString('en-RW')} RWF`;

type Stats = DashboardStats & {
  comparison?: Comparison;
};

const statusDot: Record<string, string> = {
  pending: 'bg-status-pending',
  packing: 'bg-status-packing',
  in_transit: 'bg-status-transit',
  delivered: 'bg-status-delivered',
  cancelled: 'bg-status-cancelled',
};

const catLabels: Record<string, string> = {
  staples: 'Ibinyampeke',
  vegetables: 'Imboga',
  fruits: 'Imbuto',
  kitchenware: 'Ibikoresho',
  household: 'Ibikoresho byo mu ngoro',
  drinks: 'Ibinyobwa',
  personal_care: 'Kwita ku mubiri',
  other: 'Ibindi',
};

export default function Dashboard() {
  const { t, lang } = useAdminI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.stats()
      .then((res) => setStats({ ...res.data, comparison: res.comparison }))
      .catch((e) => setError(e.message));
  }, []);

  // Operational "needs attention" list, derived from real stats — no fake data.
  const attention = useMemo(() => {
    if (!stats) return [] as { label: string; value: number }[];
    const items: { label: string; value: number }[] = [];
    if (stats.pendingOrders > 0)
      items.push({
        label: t('pendingAction'),
        value: stats.pendingOrders,
      });
    const low = stats.outOfStockCount + stats.lowStockCount;
    if (low > 0) items.push({ label: t('lowStockOnly'), value: low });
    if (stats.ordersByStatus.in_transit > 0)
      items.push({ label: t('inTransitLabel'), value: stats.ordersByStatus.in_transit });
    return items;
  }, [stats, t]);

  if (error)
    return (
      <div className="p-6">
        <div className="panel p-5 text-sm text-red-600">{t('failedStats')}: {error}</div>
      </div>
    );

  if (!stats) {
    return (
      <div className="space-y-6 p-6 lg:p-8">
        <div className="h-5 w-44 animate-pulse rounded-md bg-line" />
        <div className="panel grid grid-cols-2 md:grid-cols-4 md:divide-x md:divide-line">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="panel h-72 animate-pulse lg:col-span-2" />
          <div className="panel h-72 animate-pulse" />
        </div>
      </div>
    );
  }

  const statusRows = (['delivered', 'pending', 'in_transit', 'packing', 'cancelled'] as const)
    .map((s) => ({ s, v: stats.ordersByStatus[s] }))
    .filter((x) => x.v > 0);

  const topRevenue = stats.revenueByCategory.length ? Math.max(...stats.revenueByCategory.map((c) => c.revenue)) : 1;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      {/* Page header — compact, right-aligned context */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t('dashboard')}</h1>
          <p className="metadata mt-0.5">
            {new Date().toLocaleDateString(lang === 'kin' ? 'rw-RW' : lang === 'fr' ? 'fr-FR' : 'en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-status-delivered" />
          {t('storeLive')}
        </div>
      </div>

      {/* KPI strip: one panel, divided cells — not four floating cards */}
      <section className="panel grid grid-cols-2 md:grid-cols-4 md:divide-x md:divide-line">
        <StatCard
          label={t('ordersToday')}
          value={String(stats.todayOrders)}
          delta={stats.comparison?.changePct ?? null}
          hint={t('vsYesterday')}
        />
        <StatCard
          label={t('totalRevenue')}
          value={fmtRWF(stats.revenue)}
          hint={`+${fmtRWF(stats.todayRevenue)} ${t('today')}`}
        />
        <StatCard
          label={t('pendingToShip')}
          value={String(stats.pendingOrders)}
          hint={t('pendingPacking')}
        />
        <StatCard
          label={t('avgOrder')}
          value={fmtRWF(stats.avgOrderValue)}
          hint={`${stats.activeCustomers} ${t('activeCustomers')}`}
        />
      </section>

      {/* Needs attention — operational line, only rendered with content */}
      {attention.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
          <span className="section-title">{t('needsAttention')}</span>
          {attention.map((a) => (
            <span key={a.label} className="flex items-center gap-1.5 text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-harvest-500" />
              <b className="font-semibold text-ink tabular-nums">{a.value}</b> {a.label}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sales chart — 2/3 width */}
        <div className="lg:col-span-2">
          <SalesChart
            orders={stats.ordersByDay.map((d) => ({ label: d.day.slice(5).replace('-', '/'), value: d.orders }))}
            revenue={stats.ordersByDay.map((d) => ({ label: d.day.slice(5).replace('-', '/'), value: d.revenue }))}
          />
        </div>

        {/* Order status — scannable list, no donut */}
        <section className="panel p-5">
          <h2 className="text-sm font-bold text-ink">{t('byStatus')}</h2>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="metric-value tabular-nums">{stats.totalOrders}</span>
            <span className="metadata">{t('orderCount')}</span>
          </div>
          <ul className="mt-4 divide-y divide-line/70">
            {statusRows.map(({ s, v }) => (
              <li key={s} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2 text-soft">
                  <span className={`dot ${statusDot[s]}`} />
                  {t(`status.${s}`, s.replace('_', ' '))}
                </span>
                <span className="flex items-baseline gap-2 tabular-nums">
                  <span className="font-semibold text-ink">{v}</span>
                  <span className="metadata w-9 text-right">
                    {stats.totalOrders ? Math.round((v / stats.totalOrders) * 100) : 0}%
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top products — real table */}
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h2 className="text-sm font-bold text-ink">{t('topProducts')}</h2>
            <span className="metadata">{t('last7Short')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="w-8 pl-5">#</th>
                  <th>{t('productCol')}</th>
                  <th className="tbl-num">{t('sold')}</th>
                  <th className="tbl-num pr-5">{t('revenueCol')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.topProducts.slice(0, 6).map((top, i) => (
                  <tr key={top.product.id}>
                    <td className="pl-5 metadata tabular-nums">{i + 1}</td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-bg text-sm">
                          {top.product.emoji}
                        </span>
                        <span className="truncate font-medium text-ink">{top.product.name[lang]}</span>
                      </div>
                    </td>
                    <td className="tbl-num whitespace-nowrap">
                      {top.units} {top.product.unit}
                    </td>
                    <td className="tbl-num pr-5 font-semibold text-ink">{fmtRWF(top.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Revenue by category — thin professional bars with percentages */}
        <section className="panel p-5">
          <h2 className="text-sm font-bold text-ink">{t('revenueCategory')}</h2>
          <ul className="mt-4 space-y-3.5">
            {[...stats.revenueByCategory]
              .sort((a, b) => b.revenue - a.revenue)
              .map((c) => {
                const total = stats.revenueByCategory.reduce((a, x) => a + x.revenue, 0) || 1;
                return (
                  <li key={c.category}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="truncate text-soft">{t(`categories.${c.category}`, catLabels[c.category])}</span>
                      <span className="shrink-0 tabular-nums">
                        <b className="font-semibold text-ink">{fmtRWF(c.revenue)}</b>
                        <span className="metadata ml-2">{Math.round((c.revenue / total) * 100)}%</span>
                      </span>
                    </div>
                    <div className="bar-track mt-1.5">
                      <div className="bar-fill" style={{ width: `${(c.revenue / topRevenue) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      </div>
    </div>
  );
}
