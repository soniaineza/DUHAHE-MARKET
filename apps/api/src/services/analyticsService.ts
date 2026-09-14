import type { CategoryId, DashboardStats, OrderStatus } from '@duhahe/shared';
import { getProductById } from '@duhahe/shared';
import { orders, products as productStore } from '../data/store';

const DAY_MS = 24 * 3600 * 1000;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function computeStats(): DashboardStats {
  const now = Date.now();
  const totals = orders.reduce(
    (acc, o) => {
      acc.revenue += o.paymentStatus === 'paid' ? o.total : 0;
      acc.count += 1;
      return acc;
    },
    { revenue: 0, count: 0 }
  );

  const todayKey = dayKey(new Date());
  const yesterdayKey = dayKey(new Date(now - DAY_MS));
  const today = orders.filter((o) => dayKey(new Date(o.createdAt)) === todayKey);
  const yesterday = orders.filter((o) => dayKey(new Date(o.createdAt)) === yesterdayKey);
  const todayRevenue = today.reduce((s, o) => s + (o.paymentStatus === 'paid' ? o.total : 0), 0);

  const statuses = ['pending', 'packing', 'in_transit', 'delivered', 'cancelled'] as OrderStatus[];
  const ordersByStatus = Object.fromEntries(statuses.map((s) => [s, orders.filter((o) => o.status === s).length])) as Record<OrderStatus, number>;

  const ordersByDay = Array.from({ length: 7 }, (_, i) => {
    const day = dayKey(new Date(now - (6 - i) * DAY_MS));
    const dayOrders = orders.filter((o) => dayKey(new Date(o.createdAt)) === day);
    return {
      day,
      orders: dayOrders.length,
      revenue: dayOrders.reduce((s, o) => s + (o.paymentStatus === 'paid' ? o.total : 0), 0),
    };
  });

  const revByCat = new Map<CategoryId, number>();
  const productUnits = new Map<string, { units: number; revenue: number }>();
  for (const o of orders) {
    if (o.paymentStatus !== 'paid') continue;
    for (const item of o.items) {
      const prod = getProductById(item.productId);
      const cat: CategoryId = prod?.category ?? 'staples';
      revByCat.set(cat, (revByCat.get(cat) ?? 0) + item.lineTotal);
      const cur = productUnits.get(item.productId) ?? { units: 0, revenue: 0 };
      cur.units += item.qty;
      cur.revenue += item.lineTotal;
      productUnits.set(item.productId, cur);
    }
  }

  const topProducts = [...productUnits.entries()]
    .sort((a, b) => b[1].units - a[1].units)
    .slice(0, 8)
    .map(([id, v]) => ({ product: getProductById(id)!, units: v.units, revenue: v.revenue }));

  const outOfStockCount = [...productStore.values()].filter((p) => p.stockQty <= 0).length;
  const lowStockCount = [...productStore.values()].filter((p) => p.stockQty > 0 && p.stockQty <= 20).length;
  const activeCustomers = new Set(orders.map((o) => o.customer.phone)).size;

  return {
    totalOrders: totals.count,
    revenue: Math.round(totals.revenue * 100) / 100,
    avgOrderValue: totals.count ? Math.round((totals.revenue / totals.count) * 100) / 100 : 0,
    todayOrders: today.length,
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    pendingOrders: ordersByStatus.pending + ordersByStatus.packing,
    activeCustomers,
    outOfStockCount,
    lowStockCount,
    ordersByDay,
    ordersByStatus,
    revenueByCategory: [...revByCat.entries()].map(([category, revenue]) => ({ category, revenue: Math.round(revenue * 100) / 100 })),
    topProducts,
  };
}

export function todayVsYesterday(): { today: number; yesterday: number; changePct: number } {
  const todayKey = dayKey(new Date());
  const yesterdayKey = dayKey(new Date(Date.now() - DAY_MS));
  const count = (k: string) => orders.filter((o) => dayKey(new Date(o.createdAt)) === k).length;
  const today = count(todayKey);
  const yesterday = count(yesterdayKey);
  const changePct = yesterday === 0 ? (today === 0 ? 0 : 100) : Math.round(((today - yesterday) / yesterday) * 1000) / 10;
  return { today, yesterday, changePct };
}