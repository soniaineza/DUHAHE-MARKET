import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Order } from '../api';
import type { OrderStatus } from '@duhahe/shared';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { SearchIcon, DownIcon } from '../components/Icons';
import { useAdminI18n } from '../i18n';

const fmtRWF = (n: number) => `${n.toLocaleString('en-RW')} RWF`;

const FLOW: OrderStatus[] = ['pending', 'packing', 'in_transit', 'delivered'];

export default function Orders() {
  const { t, lang } = useAdminI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    api.orders()
      .then((res) => setOrders(res.data))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length, pending: 0, packing: 0, in_transit: 0, delivered: 0, cancelled: 0 };
    orders.forEach((o) => { c[o.status] = (c[o.status] ?? 0) + 1; });
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (q) {
        const hay = [o.orderNumber, o.customer.name, o.customer.phone, o.customer.district ?? ''].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, filter, query]);

  const advanceStatus = async (o: Order, to: OrderStatus) => {
    const note =
      to === 'in_transit' ? 'Assigned to rider' : to === 'delivered' ? 'Delivered & confirmed' : undefined;
    try {
      await api.updateOrderStatus(o.id, to, note);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update order');
    }
  };

  if (error && orders.length === 0) return <div className="p-8 text-red-600">{t('failedOrders')}: {error}</div>;

  return (
    <div className="p-8 space-y-4">
      {error && orders.length > 0 && (
        <div className="rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 px-3 py-2">{error}</div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('orders')}</h1>
          <p className="text-sm text-muted mt-0.5">{counts.all} · {counts.pending} {t('pendingAction')}</p>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-faint">
            <SearchIcon size={16} />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchOrders')}
            className="w-72 rounded-xl border border-line bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(['all', 'pending', 'packing', 'in_transit', 'delivered', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              filter === s ? 'bg-leaf-600 text-white shadow' : 'bg-white border border-line text-muted hover:bg-leaf-50'
            }`}
          >
            {s === 'all' ? t('common.all', 'All') : t(`status.${s}`, s.replace('_', ' '))}
            <span className={`text-[11px] font-bold rounded-full px-1.5 ${filter === s ? 'bg-white/20' : 'bg-leaf-50 text-leaf-700'}`}>
              {counts[s] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((o) => (
          <div key={o.id} className="card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-leaf-50/50 text-left transition"
              onClick={() => setExpanded(expanded === o.id ? null : o.id)}
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf-50 font-mono text-xs font-black text-leaf-700">
                  {o.orderNumber.slice(-4)}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-soft truncate">{o.customer.name}</div>
                  <div className="text-xs text-faint">{o.customer.phone} · {o.customer.district ?? '—'}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="font-bold">{fmtRWF(o.total)}</div>
                  <div className="text-xs text-faint">{new Date(o.createdAt).toLocaleString()}</div>
                </div>
                <OrderStatusBadge status={o.status} />
                <DownIcon className={`text-faint transition-transform ${expanded === o.id ? 'rotate-180' : ''}`} size={18} />
              </div>
            </button>

            {expanded === o.id && (
              <div className="px-5 pb-5 border-t border-line pt-4 space-y-4">
                {o.status !== 'cancelled' && (
                  <div className="flex flex-wrap gap-1.5">
                    {FLOW.map((s, i) => {
                      const idx = FLOW.indexOf(o.status as OrderStatus);
                      const done = i < idx || o.status === 'delivered';
                      const current = i === idx && o.status !== 'delivered';
                      const canAdvance = i === idx && s !== 'delivered';
                      const next = i === idx;
                      return (
                        <div key={s} className="flex items-center gap-1.5">
                          <button
                            disabled={!canAdvance}
                            onClick={() => canAdvance && advanceStatus(o, FLOW[idx + 1])}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                              current
                                ? 'border-leaf-600 bg-leaf-600 text-white shadow'
                                : done
                                ? 'border-leaf-500 bg-leaf-50 text-leaf-700'
                                : 'border-line bg-white text-faint'
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${done && !current ? 'bg-leaf-500' : current ? 'bg-white' : 'bg-gray-300'}`} />
                            {s.replace('_', ' ')}
                          </button>
                          {next && <span className="text-[10px] text-leaf-600 font-black">›</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="grid md:grid-cols-[1fr_auto] gap-4">
                  <div className="space-y-1.5 text-sm">
                    {o.items.map((it) => (
                      <div key={it.productId} className="flex justify-between gap-4">
                        <span className="text-muted truncate">{it.qty} {it.unit} × {it.name[lang]}</span>
                        <span className="font-semibold shrink-0">{fmtRWF(it.lineTotal)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-line text-sm flex justify-between text-muted">
                      <span>{t('deliveryFee')}</span>
                      <span>{fmtRWF(o.deliveryFee)}</span>
                    </div>
                    <div className="text-sm font-bold flex justify-between">
                      <span>{t('total')}</span>
                      <span className="text-leaf-700">{fmtRWF(o.total)}</span>
                    </div>
                    <div className="text-xs text-faint">
                      {t('paymentLabel')}: <span className="capitalize">{o.paymentMethod.replace(/_/g, ' ')}</span> · {o.paymentStatus}
                      {o.note && <span className="italic"> · {t('note')}: {o.note}</span>}
                    </div>
                    {o.tracking && o.tracking.length > 0 && (
                      <div className="bg-leaf-50 rounded-lg px-3 py-2 text-xs text-leaf-800">
                        <span className="font-bold">{t('history')}:</span> {o.tracking.map((entry) => entry.note).join(' → ')}
                      </div>
                    )}
                    <Link to={`/orders/${o.id}`} className="inline-block mt-2 text-xs font-bold text-leaf-700 hover:text-leaf-800 hover:underline">
                      {t('viewDetails')} →
                    </Link>
                  </div>

                  <div className="flex flex-col gap-2 md:w-64">
                    {o.paymentStatus === 'unpaid' && o.status !== 'cancelled' && (
                      <div className="rounded-lg bg-amber-50 border border-amber-100 text-amber-700 py-2 text-sm text-center font-semibold">
                        {t('awaitingPayment')}
                      </div>
                    )}
                    {o.status !== 'cancelled' && o.status !== 'delivered' && (
                      <button
                        onClick={() => advanceStatus(o, o.status === 'pending' ? 'packing' : o.status === 'packing' ? 'in_transit' : 'delivered')}
                        className="btn-primary py-2.5"
                      >
                        {o.status === 'pending' ? t('movePacking') : o.status === 'packing' ? t('moveTransit') : t('markDelivered')} →
                      </button>
                    )}
                    {o.status !== 'cancelled' ? (
                      <button
                        onClick={() => advanceStatus(o, 'cancelled')}
                        className="inline-flex justify-center rounded-xl border border-line py-2 text-sm font-semibold text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition"
                      >
                        {t('cancelOrder')}
                      </button>
                    ) : null}
                    {o.status === 'delivered' && (
                      <div className="rounded-lg bg-leaf-50 text-ink py-2.5 text-sm text-center font-bold">
                        {t('delivered')} ✓
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="card py-12 text-center text-muted text-sm">{t('noOrders')}</div>
        )}
      </div>
    </div>
  );
}