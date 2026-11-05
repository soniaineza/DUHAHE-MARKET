import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getToken, logout } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Notifications from './pages/Notifications';

const IDLE_MS = 15 * 60 * 1000; // auto sign-out after 15 minutes of inactivity

/** Guards protected pages and ends the session on logout, idle, or Back/forward restore. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const authed = !!getToken();

  useEffect(() => {
    // Re-check whenever the page is restored from the back/forward cache.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted && !getToken()) navigate('/login', { replace: true });
    };
    const onLogout = () => navigate('/login', { replace: true });
    window.addEventListener('pageshow', onShow);
    window.addEventListener('auth:logout', onLogout);

    let timer = window.setTimeout(() => void logout(), IDLE_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void logout(), IDLE_MS);
    };
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;
    events.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
    return () => {
      window.removeEventListener('pageshow', onShow);
      window.removeEventListener('auth:logout', onLogout);
      events.forEach((ev) => window.removeEventListener(ev, reset));
      window.clearTimeout(timer);
    };
  }, [navigate]);

  if (!authed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/inventory" element={<Inventory />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}