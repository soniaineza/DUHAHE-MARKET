import type { OrderStatus } from '@duhahe/shared';
import { useAdminI18n } from '../i18n';

/* Restrained operational palette — soft backgrounds, strong text, hairline border. */
const colors: Record<OrderStatus, string> = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  packing: 'bg-sky-50 text-sky-800 border-sky-200',
  in_transit: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  delivered: 'bg-leaf-50 text-ink border-leaf-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useAdminI18n();
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${colors[status]}`}>
      {t(`status.${status}`, status.replace('_', ' '))}
    </span>
  );
}
