import { getProductById, type Customer, type Order, type OrderStatus, type PaymentMethod } from '@duhahe/shared';
import { orders, products } from './store';

const NAMES = [
  { name: 'Jean Bosco Niyonzima', phone: '250788123456' },
  { name: 'Claudine Uwase', phone: '250789234567' },
  { name: 'Eric Habimana', phone: '250781345678' },
  { name: 'Aline Ingabire', phone: '250782456789' },
  { name: 'Patrick Mugisha', phone: '250783567890' },
  { name: 'Chantal Mukamana', phone: '250784678901' },
  { name: 'Olivier Nsengimana', phone: '250785789012' },
  { name: 'Sandrine Umuhoza', phone: '250786890123' },
  { name: 'Emmanuel Rukundo', phone: '250787901234' },
  { name: 'Josiane Uwimbabazi', phone: '250788012345' },
  { name: 'Fidele Ngoga', phone: '250784112233' },
  { name: 'Bernadette Nyiraminani', phone: '250788445566' },
];

const STATUSES: OrderStatus[] = ['pending', 'packing', 'in_transit', 'delivered', 'delivered', 'delivered', 'delivered', 'cancelled'];
const METHODS: PaymentMethod[] = ['mtn_momo', 'airtel_money', 'cash_on_delivery'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildOrder(index: number): Order {
  const customer: Customer = { name: NAMES[index % NAMES.length].name, phone: NAMES[index % NAMES.length].phone, district: pick(['Gasabo', 'Kicukiro', 'Nyarugenge', 'Musanze', 'Huye', 'Rubavu']) };
  const lineCount = randInt(1, 4);
  const ids = [...products.keys()];
  const used = new Set<string>();
  const items = [];
  for (let i = 0; i < lineCount; i++) {
    const key = pick(ids);
    if (used.has(key)) continue;
    used.add(key);
    const prod = getProductById(key)!;
    const qty = Math.round((Math.random() * 3 + prod.minOrderQty) / prod.step) * prod.step;
    items.push({
      productId: prod.id,
      name: prod.name,
      unit: prod.unit,
      qty,
      unitPrice: prod.price,
      lineTotal: Math.round(qty * prod.price * 100) / 100,
    });
  }
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);
  const deliveryFee = customer.district && ['Gasabo', 'Kicukiro', 'Nyarugenge'].includes(customer.district) ? 1000 : 2500;
  const status = STATUSES[index % STATUSES.length];
  const createdAt = new Date(Date.now() - randInt(0, 6) * 24 * 3600 * 1000 - randInt(0, 12) * 3600 * 1000).toISOString();
  const paid = status !== 'cancelled';
  return {
    id: `ord-${index + 1}`,
    orderNumber: `DH-${String(1000 + index)}`,
    customer,
    items,
    subtotal: Math.round(subtotal * 100) / 100,
    deliveryFee,
    discount: 0,
    total: Math.round((subtotal + deliveryFee) * 100) / 100,
    status,
    paymentMethod: pick(METHODS),
    paymentStatus: paid ? 'paid' : 'unpaid',
    createdAt,
    note: undefined,
    tracking: [{ updatedAt: createdAt, note: 'Order received' }],
  };
}

export function seedOrders(force = false): Order[] {
  if (!force && orders.length > 0) return orders;
  orders.length = 0;
  for (let i = 0; i < 42; i++) {
    orders.push(buildOrder(i));
  }
  orders.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return orders;
}