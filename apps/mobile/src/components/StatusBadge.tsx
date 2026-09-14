import type { OrderStatus } from '@duhahe/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const meta: Record<OrderStatus, { color: string; bg: string }> = {
  pending: { color: '#b45309', bg: '#fef3c7' },
  packing: { color: '#1d4ed8', bg: '#dbeafe' },
  in_transit: { color: '#6d28d9', bg: '#ede9fe' },
  delivered: { color: '#15803d', bg: '#dcfce7' },
  cancelled: { color: '#6b7280', bg: '#f3f4f6' },
};

export default function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  const m = meta[status];
  return (
    <View style={[styles.badge, { backgroundColor: m.bg }]}>
      <Text style={{ color: m.color, fontWeight: '700', fontSize: 11 }}>{t(`status.${status}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
});