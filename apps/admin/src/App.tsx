import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { getToken } from './api';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Inventory from './pages/Inventory';
import Customers from './pages/Customers';
import Notifications from './pages/Notifications';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: <RequireAuth><Layout /></RequireAuth>,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/orders', element: <Orders /> },
      { path: '/orders/:id', element: <OrderDetail /> },
      { path: '/customers', element: <Customers /> },
      { path: '/notifications', element: <Notifications /> },
      { path: '/inventory', element: <Inventory /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}