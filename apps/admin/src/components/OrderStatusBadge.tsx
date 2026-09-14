import type { OrderStatus } from '@duhahe/shared';
import { useAdminI18n } from '../i18n';

const colors: Record<OrderStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  packing: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-violet-100 text-violet-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useAdminI18n();
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[status]}`}>
      {t(`status.${status}`, status.replace('_', ' '))}
    </span>
  );
}