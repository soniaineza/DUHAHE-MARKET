export type Language = 'en' | 'kin' | 'fr';
export type CategoryId = 'staples' | 'vegetables' | 'fruits' | 'kitchenware' | 'household' | 'drinks' | 'personal_care' | 'other';

export type Unit = 'kg' | 'piece' | 'bundle' | 'pack' | 'dozen' | 'liter' | 'box' | 'bottle' | 'can' | 'bag' | 'pair';

export interface LocalizedText {
  en: string;
  kin: string;
  fr: string;
}

export interface Product {
  id: string;
  sku: string;
  category: CategoryId;
  name: LocalizedText;
  description: LocalizedText;
  /** Price in RWF, per `unit`. */
  price: number;
  unit: Unit;
  /** Available quantity, in `unit`. */
  stockQty: number;
  /** Minimum purchasable quantity, in `unit`. */
  minOrderQty: number;
  /** Step allowed when adjusting quantity (e.g. 0.5 kg). */
  step: number;
  emoji: string;
  organic: boolean;
  farmer?: string;
}

export interface CartItem {
  productId: string;
  qty: number;
}

export type OrderStatus = 'pending' | 'packing' | 'in_transit' | 'delivered' | 'cancelled';
export type PaymentMethod = 'mtn_momo' | 'airtel_money' | 'cash_on_delivery';
export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded';

export interface OrderItem {
  productId: string;
  name: LocalizedText;
  unit: Unit;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Customer {
  name: string;
  phone: string;
  email?: string;
  province?: string;
  district?: string;
  address?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customer: Customer;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  discount: number;
  total: number;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  createdAt: string;
  note?: string;
  tracking?: { updatedAt: string; note: string }[];
}

export interface DashboardStats {
  totalOrders: number;
  revenue: number;
  avgOrderValue: number;
  todayOrders: number;
  todayRevenue: number;
  pendingOrders: number;
  activeCustomers: number;
  outOfStockCount: number;
  lowStockCount: number;
  ordersByDay: { day: string; orders: number; revenue: number }[];
  ordersByStatus: Record<OrderStatus, number>;
  revenueByCategory: { category: CategoryId; revenue: number }[];
  topProducts: { product: Product; units: number; revenue: number }[];
}

export interface PaymentRequest {
  method: PaymentMethod;
  orderId: string;
  phone: string;
  amount: number;
}

export interface PaymentResult {
  success: boolean;
  providerRequestId?: string;
  message: LocalizedText;
  status: PaymentStatus;
}