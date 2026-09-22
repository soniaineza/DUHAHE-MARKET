import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AdminCustomer } from '../api';
import { UsersIcon, SearchIcon, DownIcon } from '../components/Icons';
import { useAdminI18n } from '../i18n';

const fmtRWF = (n: number) => `${n.toLocaleString('en-RW')} RWF`;

export default function Customers() {
  const { t } = useAdminI18n();
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.customers()
      .then((res) => setCustomers(res.data))
      .catch((e) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.replace(/\D/g, '').includes(q));
  }, [customers, query]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('customers')}</h1>
          <p className="text-sm text-muted mt-0.5">{customers.length} {t('customers')}</p>
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-faint">
            <SearchIcon size={16} />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchCustomers')}
            className="w-72 rounded-xl border border-line bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
          />
        </div>
      </div>

      {customers.length === 0 && !error ? (
        <div className="card py-12 text-center text-muted text-sm flex flex-col items-center gap-2">
          <UsersIcon className="text-faint" size={24} />
          {t('noCustomers')}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const spent = c.orders.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.total, 0);
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="card overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-leaf-50/50 text-left transition"
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf-50 text-base font-black text-leaf-700 uppercase">
                      {c.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-soft truncate">{c.name}</div>
                      <div className="text-xs text-faint">{c.phone} · {t('memberSince')} {new Date(c.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="font-bold">{fmtRWF(spent)}</div>
                      <div className="text-xs text-faint">{t('totalSpent')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">{c.orders.length}</div>
                      <div className="text-xs text-faint">{t('customerOrders')}</div>
                    </div>
                    <DownIcon className={`text-faint transition-transform ${isOpen ? 'rotate-180' : ''}`} size={18} />
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 border-t border-line pt-4 grid md:grid-cols-[1fr_1fr] gap-4">
                    <div>
                      <h3 className="text-xs font-bold text-faint uppercase tracking-wide mb-2">{t('savedAddr')}</h3>
                      {c.addresses.length === 0 ? (
                        <div className="text-sm text-muted">{t('noAddr')}</div>
                      ) : (
                        <div className="space-y-2">
                          {c.addresses.map((a) => (
                            <div key={a.id} className="rounded-xl border border-line px-3 py-2.5 text-sm">
                              <div className="font-semibold">{a.label}{a.isDefault ? ' · default' : ''}</div>
                              <div className="text-xs text-faint">{a.name} · {a.district}, {a.province}{a.address ? ` · ${a.address}` : ''}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-faint uppercase tracking-wide mb-2">{t('orders')}</h3>
                      {c.orders.length === 0 ? (
                        <div className="text-sm text-muted">{t('noOrders')}</div>
                      ) : (
                        <div className="space-y-2">
                          {c.orders.slice(0, 8).map((o) => (
                            <Link key={o.id} to={`/orders/${o.id}`} className="flex items-center justify-between rounded-xl border border-line px-3 py-2.5 text-sm hover:border-leaf-500 hover:bg-leaf-50/50 transition">
                              <div>
                                <div className="font-semibold">{o.orderNumber}</div>
                                <div className="text-[11px] text-faint capitalize">{o.status.replace('_', ' ')} · {o.paymentStatus}</div>
                              </div>
                              <span className="font-bold">{fmtRWF(o.total)}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="card py-12 text-center text-muted text-sm">{t('noCustomers')}</div>
          )}
        </div>
      )}
    </div>
  );
}