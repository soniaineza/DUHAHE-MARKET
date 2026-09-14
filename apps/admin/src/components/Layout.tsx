import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, clearToken, type AdminProfile } from '../api';
import { BasketIcon, GridIcon, CartIcon, TagIcon, LogoutIcon } from './Icons';
import { useAdminI18n } from '../i18n';

const links = [
  { to: '/', label: 'Dashboard', icon: GridIcon, end: true },
  { to: '/orders', label: 'Orders', icon: CartIcon, end: false },
  { to: '/inventory', label: 'Price & Stock', icon: TagIcon, end: false },
];

export default function Layout() {
  const { lang, setLang, t } = useAdminI18n();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [initials, setInitials] = useState('EM');

  const labels = {
    dashboard: t('dashboard'),
    orders: t('orders'),
    inventory: t('inventory'),
  };

  useEffect(() => {
    api.me()
      .then((res) => {
        setAdmin(res.data);
        const parts = res.data.name.trim().split(/\s+/);
        const initials = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || 'A';
        setInitials(initials);
      })
      .catch(() => {});
  }, []);

  const signOut = () => {
    clearToken();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="sticky top-0 h-screen w-64 shrink-0 bg-leaf-900 text-white flex flex-col">
        <div className="px-5 py-6 border-b border-leaf-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-leaf-400 to-leaf-700 shadow-lg shadow-leaf-900/40">
              <BasketIcon className="text-white" size={22} />
            </div>
            <div>
              <div className="text-lg font-black tracking-tight leading-none">Duhahe</div>
              <div className="text-[11px] text-leaf-300 mt-0.5 font-semibold">Duhahe Market</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive ? 'bg-leaf-700 text-white' : 'text-leaf-200 hover:bg-leaf-800 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-harvest-300" />}
                  <l.icon className={isActive ? 'text-harvest-300' : 'text-leaf-300 group-hover:text-harvest-300'} size={19} />
                  {l.to === '/' ? labels.dashboard : l.to === '/orders' ? labels.orders : labels.inventory}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-leaf-800 space-y-3">
          <div className="flex items-center gap-1 rounded-lg bg-leaf-800 p-1">
            {(['en', 'kin', 'fr'] as const).map((option) => (
              <button key={option} onClick={() => setLang(option)} className={`flex-1 rounded-md px-2 py-1 text-[11px] font-bold uppercase ${lang === option ? 'bg-harvest-300 text-leaf-900' : 'text-leaf-200 hover:text-white'}`}>
                {option === 'kin' ? 'Kiny' : option === 'fr' ? 'FR' : 'EN'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-leaf-200">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            API connected
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-leaf-800 text-xs font-bold text-leaf-100">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{admin?.name ?? 'Duhahe admin'}</div>
              <div className="text-[11px] text-leaf-300 truncate">{admin?.email ?? 'Market owner'}</div>
            </div>
            <button onClick={signOut} title={t('signOut')} className="text-leaf-300 hover:text-white transition">
              <LogoutIcon size={18} />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}