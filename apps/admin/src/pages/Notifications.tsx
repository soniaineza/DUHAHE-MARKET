import { useEffect, useMemo, useState } from 'react';
import { api, type AdminNotification } from '../api';
import { BellIcon } from '../components/Icons';
import { useAdminI18n } from '../i18n';

const kindMeta: Record<string, { label: string; chip: string }> = {
  order: { label: '📦 Order', chip: 'bg-blue-50 text-blue-700 border-blue-100' },
  general: { label: '💬 General', chip: 'bg-gray-50 text-gray-600 border-gray-100' },
};

export default function Notifications() {
  const { t } = useAdminI18n();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const load = () =>
    api.notifications(phone.trim() || undefined)
      .then((res) => setItems(res.data))
      .catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => ({ all: items.length, unread: items.filter((n) => !n.read).length }), [items]);

  const filtered = useMemo(() => {
    const q = phone.trim().toLowerCase();
    if (!q) return items;
    const digits = q.replace(/\D/g, '');
    return items.filter((n) => n.phone.replace(/\D/g, '').includes(digits));
  }, [items, phone]);

  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-8 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{t('notifications')}</h1>
          <p className="text-sm text-muted mt-0.5">
            {counts.all} {t('notifications')} · {counts.unread} {t('unread')}
          </p>
        </div>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          onBlur={load}
          onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
          placeholder="Phone (0 7…)"
          className="w-56 rounded-xl border border-line bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
        />
      </div>

      {items.length === 0 ? (
        <div className="card py-12 text-center text-muted text-sm flex flex-col items-center gap-2">
          <BellIcon className="text-faint" size={24} />
          {t('notifEmpty')}
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((n) => (
            <div key={n.id} className="card p-4 flex items-start gap-3">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${n.read ? 'bg-gray-200' : 'bg-harvest-400'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-soft text-sm">{n.title}</span>
                  <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border ${kindMeta[n.kind]?.chip ?? kindMeta.general.chip}`}>
                    {kindMeta[n.kind]?.label ?? 'General'}
                  </span>
                  {!n.read && <span className="text-[10px] font-bold text-harvest-500">{t('unread')}</span>}
                  <span className="ml-auto text-xs text-faint">{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-sm text-muted mt-1">{n.body}</div>
                <div className="text-[11px] text-faint mt-1 font-mono">{n.phone}</div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="card py-12 text-center text-muted text-sm">{t('notifEmpty')}</div>
          )}
        </div>
      )}
    </div>
  );
}