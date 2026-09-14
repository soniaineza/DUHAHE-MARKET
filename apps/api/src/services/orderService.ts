import { getProductById, type Customer, type Order, type OrderItem, type PaymentMethod } from '@duhahe/shared';
import { DELIVERY_FEE_KIGALI, DELIVERY_FEE_PROVINCE, KIGALI_DISTRICTS } from '../config';
import { createOrder, orders as storeOrders, pushNotification } from '../data/store';

let orderSeq: number | null = null;

function nextOrderNumber(): string {
  if (orderSeq === null) {
    orderSeq = storeOrders.reduce((max, o) => {
      const match = /^DH-(\d+)$/.exec(o.orderNumber);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 1000);
  }
  orderSeq += 1;
  return `DH-${orderSeq}`;
}

export function deliveryFeeFor(district?: string): number {
  if (district && KIGALI_DISTRICTS.includes(district)) return DELIVERY_FEE_KIGALI;
  return DELIVERY_FEE_PROVINCE;
}

/** Pure price calculation — does not mutate stock or create anything. */
export function calculateOrder(items: { productId: string; qty: number }[], district?: string) {
  const orderItems: OrderItem[] = [];
  const errors: { productId: string; message: string }[] = [];
  for (const line of items) {
    const prod = getProductById(line.productId);
    if (!prod) {
      errors.push({ productId: line.productId, message: 'Product not found' });
      continue;
    }
    if (prod.stockQty <= 0) {
      errors.push({ productId: prod.id, message: `"${prod.name.en}" is out of stock` });
      continue;
    }
    if (line.qty < prod.minOrderQty) {
      errors.push({ productId: prod.id, message: `Minimum order for "${prod.name.en}" is ${prod.minOrderQty} ${prod.unit}` });
      continue;
    }
    if (line.qty > prod.stockQty) {
      errors.push({ productId: prod.id, message: `Only ${prod.stockQty} ${prod.unit} of "${prod.name.en}" left in stock` });
      continue;
    }
    const qty = Math.round(line.qty / prod.step) * prod.step;
    const lineTotal = Math.round(qty * prod.price * 100) / 100;
    orderItems.push({ productId: prod.id, name: prod.name, unit: prod.unit, qty, unitPrice: prod.price, lineTotal });
  }
  const subtotal = orderItems.reduce((s, i) => s + i.lineTotal, 0);
  const deliveryFee = deliveryFeeFor(district);
  return {
    items: orderItems,
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee,
    total: Math.round((subtotal + deliveryFee) * 100) / 100,
    errors: errors.length ? errors : undefined,
  };
}

export interface CreateOrderResult {
  order: Order;
  errors?: { productId: string; message: string }[];
}

export function createOrderFromInput(input: {
  items: { productId: string; qty: number }[];
  customer: Customer;
  paymentMethod: PaymentMethod;
  note?: string;
}): CreateOrderResult {
  const calc = calculateOrder(input.items, input.customer.district);
  if (calc.errors) {
    return { order: null as unknown as Order, errors: calc.errors };
  }

  for (const item of calc.items) {
    const prod = getProductById(item.productId);
    if (prod) prod.stockQty = Math.round((prod.stockQty - item.qty) * 100) / 100;
  }

  const now = new Date().toISOString();
  const order: Order = {
    id: `ord-${crypto.randomUUID().slice(0, 8)}`,
    orderNumber: nextOrderNumber(),
    customer: input.customer,
    items: calc.items,
    subtotal: calc.subtotal,
    deliveryFee: calc.deliveryFee,
    discount: 0,
    total: calc.total,
    status: 'pending',
    paymentMethod: input.paymentMethod,
    paymentStatus: 'unpaid',
    createdAt: now,
    note: input.note,
    tracking: [{ updatedAt: now, note: 'Order received' }],
  };
  createOrder(order);
  pushNotification({
    phone: order.customer.phone,
    title: 'Order confirmed',
    body: `Order ${order.orderNumber} was received. We'll update you as it progresses.`,
    kind: 'order',
  });
  return { order };
}

export function listOrders(): Order[] {
  return [...storeOrders];
}

export function getOrderById(id: string): Order | undefined {
  return storeOrders.find((o) => o.id === id);
}