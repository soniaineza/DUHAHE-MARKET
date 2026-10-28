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

/**
 * One mobile-money request sent to the provider. A retry is ALWAYS a new attempt with its own id,
 * idempotency key and provider reference, so an event can only ever settle the attempt it belongs to.
 *  - initiated : created locally, the provider has not (yet) confirmed it exists
 *  - pending   : provider created it and is waiting for the customer
 *  - paid      : provider confirmed success for the exact amount and it settled the order
 *  - failed    : provider confirmed failure (customer cancelled / declined / timed out)
 *  - duplicate : provider confirmed success but the order was already paid -> customer charged twice
 *  - mismatch  : provider reported success for the wrong amount; order NOT marked paid
 */
export type PaymentAttemptStatus = 'initiated' | 'pending' | 'paid' | 'failed' | 'duplicate' | 'mismatch';

export interface PaymentAttempt {
  id: string;
  /** Provider transaction reference; set once the provider has created the request. */
  ref?: string;
  /** Sent as the provider Idempotency-Key. Unique per attempt, stable across HTTP re-sends of that attempt. */
  idempotencyKey: string;
  amount: number;
  phone: string;
  status: PaymentAttemptStatus;
  createdAt: string;
  settledAt?: string;
  /**
   * Set when the customer confirmed they cancelled this request on their phone and asked for a new one
   * before the provider reported a final answer. The attempt stays open and keeps being reconciled, so if it
   * is ever approved the money is recorded (and flagged as a duplicate if the order was already paid).
   */
  supersededAt?: string;
  /** Amount the provider reported when it differs from `amount`. */
  providerAmount?: number;
}

export interface PaymentIssue {
  at: string;
  kind: 'duplicate_charge' | 'amount_mismatch';
  attemptId: string;
  ref?: string;
  amount: number;
  note: string;
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
  /** Reference returned by the payment gateway (stub or provider). */
  providerReference?: string;
  /** Every mobile-money payment attempt for this order, oldest first. Each has its own provider reference. */
  paymentAttempts?: PaymentAttempt[];
  /** Payment problems that need a human (e.g. a customer charged twice). Surfaced in the admin. */
  paymentIssues?: PaymentIssue[];
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
  /**
   * Customer-confirmed early retry: "I cancelled attempt <id> on my phone, send a new request now". The server
   * still re-checks the provider first and only honours this under strict conditions.
   */
  supersedeAttemptId?: string;
}

export interface PaymentResult {
  success: boolean;
  providerRequestId?: string;
  /** The payment attempt this result belongs to. */
  attemptId?: string;
  message: LocalizedText;
  status: PaymentStatus;
}