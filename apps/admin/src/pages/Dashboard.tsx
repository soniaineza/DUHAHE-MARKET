import { useEffect, useState } from 'react';
import { api, type Comparison, type DashboardStats } from '../api';
import StatCard from '../components/StatCard';
import BarChart from '../components/BarChart';
import { CartIcon, MoneyIcon, TruckIcon, StarIcon } from '../components/Icons';
import { useAdminI18n } from '../i18n';

const fmtRWF = (n: number) => `${n.toLocaleString('en-RW')} RWF`;

type Stats = DashboardStats & {
  comparison?: Comparison;
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

  if (error) return <div className="text-red-600">{t('failedStats')}: {error}</div>;
  if (!stats) {
    return (
      <div className="p-8 space-y-6">
        <div className="h-7 w-40 rounded-lg bg-leaf-50 animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="card h-36 animate-pulse" />)}
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {[0, 1].map((i) => <div key={i} className="card h-64 animate-pulse" />)}
        </div>
      </div>
    );
  }

  const catLabels: Record<string, string> = {
    staples: 'Food',
    vegetables: 'Vegetables',
    fruits: 'Fruits',
    kitchenware: 'Kitchen',
    household: 'Household',
    drinks: 'Drinks',
    personal_care: 'Personal Care',
    other: 'Other',
  };

  const catEmojis: Record<string, string> = {
    staples: '🌾',
    vegetables: '🥬',
    fruits: '🍍',
    kitchenware: '🍲',
    household: '🧺',
    drinks: '🥤',
    personal_care: '🧴',
    other: '🕯️',
  };

  const statusMeta: Record<string, { color: string; dot: string }> = {
    pending: { color: '#f59e0b', dot: 'bg-amber-500' },
    packing: { color: '#3b82f6', dot: 'bg-blue-500' },
    in_transit: { color: '#8b5cf6', dot: 'bg-violet-500' },
    delivered: { color: '#22c55e', dot: 'bg-green-500' },
    cancelled: { color: '#9ca3af', dot: 'bg-gray-400' },
  };

  const statusSlice = (['pending', 'packing', 'in_transit', 'delivered', 'cancelled'] as const)
    .map((s) => ({ s, v: stats.ordersByStatus[s] }))
    .filter((x) => x.v > 0);
  const statusTotal = statusSlice.reduce((a, b) => a + b.v, 0);
  const conic = statusSlice
    .map((x, i) => {
      const from = (statusSlice.slice(0, i).reduce((a, b) => a + b.v, 0) / statusTotal) * 360;
      const to = ((statusSlice.slice(0, i + 1).reduce((a, b) => a + b.v, 0)) / statusTotal) * 360;
      return `${statusMeta[x.s].color} ${from}deg ${to}deg`;
    })
    .join(', ');

  const topRevenue = stats.revenueByCategory.length ? Math.max(...stats.revenueByCategory.map((c) => c.revenue)) : 1;
  const daySpark = stats.ordersByDay.map((d) => d.orders);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
            <h1 className="text-2xl font-black tracking-tight">{t('dashboard')}</h1>
          <p className="text-sm text-muted mt-0.5">
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-white border border-line px-4 py-2 text-sm text-muted">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {t('storeLive')}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label={t('ordersToday')}
          value={String(stats.todayOrders)}
          icon={<CartIcon size={20} />}
          iconBg="text-leaf-600"
          spark={daySpark}
          delta={stats.comparison?.changePct ?? 0}
          accent
        />
        <StatCard
          label={t('totalRevenue')}
          value={fmtRWF(stats.revenue)}
          hint={`${fmtRWF(stats.todayRevenue)} today`}
          icon={<MoneyIcon size={20} />}
          iconBg="bg-harvest-50 text-harvest-500"
        />
        <StatCard
          label={t('pendingToShip')}
          value={String(stats.pendingOrders)}
          hint={t('pendingPacking')}
          icon={<TruckIcon size={20} />}
          iconBg="bg-blue-50 text-blue-500"
        />
        <StatCard
          label={t('avgOrder')}
          value={fmtRWF(stats.avgOrderValue)}
          hint={`${stats.activeCustomers} ${t('activeCustomers')}`}
          icon={<StarIcon size={20} />}
          iconBg="bg-violet-50 text-violet-500"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-soft">{t('lastSeven')}</h2>
              <p className="text-xs text-faint">{t('volumeDay')}</p>
            </div>
            <span className="rounded-full bg-leaf-50 text-leaf-700 text-xs font-bold px-3 py-1">
              {stats.ordersByDay.reduce((a, d) => a + d.orders, 0)} {t('orderCount')}
            </span>
          </div>
          <BarChart
            bars={stats.ordersByDay.map((d) => ({
              label: d.day.slice(5).replace('-', '/'),
              value: d.orders,
              sub: d.revenue.toString(),
            }))}
          />
        </div>

        <div className="card p-5">
          <h2 className="font-bold text-soft mb-4">{t('byStatus')}</h2>
          <div className="flex items-center gap-6">
            <div
              className="relative h-36 w-36 shrink-0 rounded-full"
              style={{ background: `conic-gradient(${conic})` }}
            >
              <div className="absolute inset-4 rounded-full bg-white flex items-center justify-center flex-col">
                <span className="text-2xl font-black text-ink">{stats.totalOrders}</span>
                <span className="text-[10px] text-faint font-bold uppercase">{t('orderCount')}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {(['pending', 'packing', 'in_transit', 'delivered', 'cancelled'] as const).map((s) => {
                const v = stats.ordersByStatus[s];
                const pct = stats.totalOrders ? Math.round((v / stats.totalOrders) * 100) : 0;
                return (
                  <div key={s} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 capitalize">
                      <span className={`h-2.5 w-2.5 rounded-full ${statusMeta[s].dot}`} />
                      {t(`status.${s}`, s.replace('_', ' '))}
                    </span>
                    <span className="text-muted font-semibold">{v} · {pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h2 className="font-bold text-soft mb-4">{t('revenueCategory')}</h2>
          <div className="space-y-3">
            {stats.revenueByCategory
              .sort((a, b) => b.revenue - a.revenue)
              .map((c) => {
                return (
                  <div key={c.category} className="flex items-center gap-3">
                    <span className="text-lg w-7 text-center">{catEmojis[c.category]}</span>
                    <span className="w-24 text-sm text-muted">{t(`categories.${c.category}`, catLabels[c.category])}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-leaf-50">
                      <div
                        className="h-2.5 rounded-full bg-gradient-to-r from-leaf-500 to-leaf-400"
                        style={{ width: `${(c.revenue / topRevenue) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold w-28 text-right">{fmtRWF(c.revenue)}</span>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-bold text-soft mb-4">{t('topProducts')}</h2>
          <div className="space-y-2.5">
            {stats.topProducts.slice(0, 6).map((top, i) => (
              <div key={top.product.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-leaf-50 transition">
                <span className={`text-xs font-black w-5 text-center ${i === 0 ? 'text-harvest-500' : 'text-faint'}`}>#{i + 1}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-leaf-50 text-lg">{top.product.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{top.product.name[lang]}</div>
                  <div className="text-xs text-faint">{top.units} {top.product.unit} {t('sold')}</div>
                </div>
                <span className="text-sm font-bold">{fmtRWF(top.revenue)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}