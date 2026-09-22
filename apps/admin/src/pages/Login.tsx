import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken, API_BASE } from '../api';
import { BasketIcon, LeafIcon, TruckIcon, MoneyIcon } from '../components/Icons';
import { useAdminI18n } from '../i18n';

export default function Login() {
  const { lang, setLang, t } = useAdminI18n();
  const [email, setEmail] = useState('admin@duhahe.rw');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [productCount, setProductCount] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/products?lang=en`)
      .then((res) => res.json())
      .then((body) => setProductCount(Number(body?.count ?? body?.data?.length ?? 0)))
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      setToken(res.data.token);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-bg">
      <div className="hidden lg:flex w-1/2 flex-col justify-between bg-leaf-900 p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <BasketIcon className="text-white" size={26} />
          </div>
          <div>
              <div className="text-2xl font-black tracking-tight leading-none">Duhahe Rwanda Market</div>
              <div className="text-xs text-leaf-300 mt-1">Duhahe · {t('fastDelivery')}</div>
          </div>
        </div>

        <div>
          <h1 className="text-4xl font-black leading-tight">
            Run your market
            <br />
            <span className="text-harvest-300">{t('fromAnywhere')}</span>
          </h1>
          <p className="max-w-md mt-4 text-leaf-100 leading-relaxed">
            Track orders, manage prices and stock, and follow every delivery across Rwanda — all in one place.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            {[
              { icon: TruckIcon, label: 'Orders live', sub: 'status & payments' },
              { icon: MoneyIcon, label: 'Prices & stock', sub: 'update instantly' },
              { icon: LeafIcon, label: 'Farm fresh', sub: productCount ? `${productCount} products` : 'Farm fresh local' },
            ].map((f, i) => (
              <div key={i} className="rounded-xl bg-white/10 p-3">
                <f.icon className="text-harvest-300" size={18} />
                <div className="text-xs font-bold mt-2">{f.label}</div>
                <div className="text-[10px] text-leaf-200 mt-0.5">{f.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-leaf-300">© {new Date().getFullYear()} Duhahe Rwanda Market — admin console</div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-leaf-900">
              <BasketIcon className="text-white" size={24} />
            </div>
            <div className="text-2xl font-black tracking-tight">
              Duhahe Rwanda <span className="text-harvest-500">Market</span>
            </div>
          </div>

          <div className="card p-8">
            <div className="mb-6">
              <h2 className="text-xl font-black">{t('welcome')}</h2>
              <p className="text-sm text-muted mt-1">{t('signInHelp')}</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-soft mb-1.5 uppercase tracking-wide">{t('email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-soft mb-1.5 uppercase tracking-wide">{t('password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-leaf-500"
                />
              </div>

              {error && <div className="rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 px-3 py-2">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-3"
              >
                {loading ? t('common.loading') : t('auth.signIn')}
              </button>
            </form>
          </div>

          <div className="mt-4 flex justify-end gap-1">
            {(['en', 'kin', 'fr'] as const).map((option) => (
              <button key={option} onClick={() => setLang(option)} className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${lang === option ? 'border-ink bg-ink text-white' : 'border-line text-muted'}`}>
                {option === 'kin' ? 'Kinyarwanda' : option === 'fr' ? 'Français' : 'English'}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-leaf-50 border border-leaf-100 px-4 py-3 text-xs text-ink leading-relaxed">
            <span className="font-bold">{t('demo')}:</span> {t('credentials')} {t('changeCredentials')}
          </div>
        </div>
      </div>
    </div>
  );
}