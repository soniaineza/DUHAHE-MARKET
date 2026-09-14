import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Order } from '../api';
import type { OrderStatus } from '@duhahe/shared';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { ArrowLeftIcon } from '../components/Icons';
import { useAdminI18n } from '../i18n';

const fmtRWF = (n: number) => `${n.toLocaleString('en-RW')} RWF`;

const FLOW: OrderStatus[] = ['pending', 'packing', 'in_transit', 'delivered'];
const NEXT: Record<OrderStatus, { label: string; to: OrderStatus; note?: string }> = {
  pending: { label: 'Move to Packing', to: 'packing' },
  packing: { label: 'Move to In Transit', to: 'in_transit', note: 'Assigned to rider' },
  in_transit: { label: 'Mark Delivered', to: 'delivered', note: 'Delivered & confirmed' },
  delivered: { label: 'Delivered', to: 'delivered' },
  cancelled: { label: 'Cancelled', to: 'cancelled' },
};

export default function OrderDetail() {
  const { t, lang } = useAdminI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    api.order(id)
      .then((res) => setOrder(res.data))
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const advance = async (to: OrderStatus) => {
    if (!order || busy) return;
    setBusy(true);
    try {
      const next = NEXT[order.status as OrderStatus];
      const action = to === next.to ? next : NEXT[to];
      await api.updateOrderStatus(order.id, action.to, action.note);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update order');
    } finally {
      setBusy(false);
    }
  };

  if (error && !order) return <div className="p-8 text-red-600">{t('failedOrder')}: {error}</div>;
  if (!order) {
    return (
      <div className="p-8 space-y-4 max-w-3xl">
        <div className="h-8 w-48 rounded-lg bg-leaf-50 animate-pulse" />
        <div className="card h-64 animate-pulse" />
      </div>
    );
  }

  const statusMeta: Record<OrderStatus, { label: string; chip: string }> = {
    pending: { label: 'Pending', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
    packing: { label: 'Packing', chip: 'bg-blue-50 text-blue-700 border-blue-200' },
    in_transit: { label: 'In Transit', chip: 'bg-violet-50 text-violet-700 border-violet-200' },
    delivered: { label: 'Delivered', chip: 'bg-green-50 text-green-700 border-green-200' },
    cancelled: { label: 'Cancelled', chip: 'bg-gray-100 text-gray-600 border-gray-200' },
  };

  const st = order.status;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-leaf-700 transition">
        <ArrowLeftIcon size={16} /> {t('backOrders')}
      </button>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight">{order.orderNumber}</h1>
            <OrderStatusBadge status={st} />
          </div>
          <p className="text-sm text-muted mt-1">
            {t('placed')} {new Date(order.createdAt).toLocaleString()} · {order.customer.name} · {order.customer.phone}
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-leaf-700">{fmtRWF(order.total)}</div>
          <div className="text-xs text-faint capitalize">
            {order.paymentMethod.replace(/_/g, ' ')} · {order.paymentStatus}
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 px-3 py-2">{error}</div>}

      {st !== 'cancelled' && st !== 'delivered' && (
        <div className="card p-5">
          <h2 className="font-bold text-soft mb-3">{t('updateStatus')}</h2>
          <div className="flex flex-wrap gap-2">
            {FLOW.map((s) => {
              const idx = FLOW.indexOf(st);
              const pos = FLOW.indexOf(s);
              const done = pos < idx;
              const current = pos === idx;
              const isNext = pos === idx + 1;
              return (
                <div key={s} className="flex items-center gap-1.5">
                  <button
                    onClick={() => isNext && advance(s)}
                    disabled={!isNext || busy}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                      current
                        ? 'border-leaf-600 bg-leaf-600 text-white shadow'
                        : done
                        ? 'border-leaf-500 bg-leaf-50 text-leaf-700'
                        : isNext
                        ? 'border-leaf-600 bg-leaf-600 text-white shadow hover:bg-leaf-700'
                        : 'border-line bg-white text-faint'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${done && !current ? 'bg-leaf-500' : current || isNext ? 'bg-white' : 'bg-gray-300'}`} />
                    {t(`status.${s}`, s.replace('_', ' '))}
                  </button>
                  {isNext && <span className="text-[10px] text-leaf-600 font-black">›</span>}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => advance('cancelled')}
            disabled={busy}
            className="mt-4 inline-flex justify-center rounded-xl border border-line px-4 py-2 text-sm font-semibold text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition"
          >
            {t('cancelOrder')}
          </button>
        </div>
      )}

      {st === 'delivered' && (
        <div className="rounded-lg bg-green-50 text-green-700 py-3 text-sm text-center font-bold">{t('delivered')} ✓</div>
      )}

      <div className="card p-5">
        <h2 className="font-bold text-soft mb-3">{t('items')}</h2>
        <div className="space-y-2">
          {order.items.map((it) => (
            <div key={it.productId} className="flex justify-between gap-4 text-sm">
              <span className="text-muted truncate">
                {it.qty} {it.unit} × {it.name[lang]}
              </span>
              <span className="font-semibold shrink-0">{fmtRWF(it.lineTotal)}</span>
            </div>
          ))}
        </div>
        <div className="pt-3 border-t border-line mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-muted"><span>{t('deliveryFee')}</span><span>{fmtRWF(order.deliveryFee)}</span></div>
          <div className="flex justify-between font-bold"><span>{t('total')}</span><span className="text-leaf-700">{fmtRWF(order.total)}</span></div>
          {order.note && <div className="text-xs text-faint italic">{t('note')}: {order.note}</div>}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-bold text-soft mb-3">{t('customer')}</h2>
        <dl className="grid md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div><dt className="text-faint text-xs font-bold">{t('name')}</dt><dd className="font-semibold">{order.customer.name}</dd></div>
          <div><dt className="text-faint text-xs font-bold">{t('phone')}</dt><dd className="font-semibold">{order.customer.phone}</dd></div>
          <div><dt className="text-faint text-xs font-bold">{t('province')}</dt><dd>{order.customer.province ?? '—'}</dd></div>
          <div><dt className="text-faint text-xs font-bold">{t('district')}</dt><dd>{order.customer.district ?? '—'}</dd></div>
          <div><dt className="text-faint text-xs font-bold">{t('address')}</dt><dd>{order.customer.address ?? '—'}</dd></div>
          {order.customer.email && (
            <div><dt className="text-faint text-xs font-bold">{t('email')}</dt><dd>{order.customer.email}</dd></div>
          )}
        </dl>
      </div>

      {order.tracking && order.tracking.length > 0 && (
        <div className="card p-5">
          <h2 className="font-bold text-soft mb-3">{t('tracking')}</h2>
          <ol className="space-y-3">
            {[...order.tracking].reverse().map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${i === 0 ? 'bg-leaf-500' : 'bg-leaf-100'}`} />
                <div>
                  <div className="text-sm font-semibold">{t.note}</div>
                  <div className="text-xs text-faint">{new Date(t.updatedAt).toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-bold text-soft mb-3">{t('quickActions')}</h2>
        <div className="flex flex-wrap gap-2">
          {st !== 'cancelled' && st !== 'delivered' && (
            <button
              onClick={() => advance(st === 'pending' ? 'packing' : st === 'packing' ? 'in_transit' : 'delivered')}
              disabled={busy}
              className="btn-primary py-2.5"
            >
              {st === 'pending' ? t('movePacking') : st === 'packing' ? t('moveTransit') : t('markDelivered')} →
            </button>
          )}
          {st !== 'cancelled' && st !== 'delivered' && (
            <button
              onClick={() => advance('cancelled')}
              disabled={busy}
              className="inline-flex justify-center rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition"
            >
              {t('cancelOrder')}
            </button>
          )}
          <a
            href={`tel:${order.customer.phone}`}
            className="inline-flex justify-center rounded-xl border border-line px-4 py-2.5 text-sm font-semibold text-muted hover:bg-leaf-50 hover:text-leaf-700 transition"
          >
            {t('callCustomer')}
          </a>
        </div>
      </div>

      <div className="text-xs text-faint">{t('statusLabel', 'Status')}: {t(`status.${st}`, statusMeta[st].label)} · ID: {order.id}</div>
    </div>
  );
}