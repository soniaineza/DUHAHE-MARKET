import { Router } from 'express';
import type { OrderStatus } from '@duhahe/shared';
import { requireAdmin } from '../middleware/auth';
import { login } from '../services/authService';
import { listOrders, getOrderById } from '../services/orderService';
import { addProduct, deleteProduct, updateOrderPaymentStatus, updateOrderStatus, updateProduct, products, listCustomers, listAllNotifications, listAddressesFor, listNotificationsFor, pushNotification } from '../data/store';
import type { CategoryId, PaymentStatus, Product, Unit } from '@duhahe/shared';
import { computeStats, todayVsYesterday } from '../services/analyticsService';
import { getProduct } from '../services/productService';

const STATUSES: OrderStatus[] = ['pending', 'packing', 'in_transit', 'delivered', 'cancelled'];

function ordersForCustomer(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return listOrders()
    .filter((o) => o.customer.phone.replace(/\D/g, '') === digits)
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      total: o.total,
      createdAt: o.createdAt,
    }));
}

export const adminRouter = Router();

adminRouter.post('/auth/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const result = login(String(email ?? ''), String(password ?? ''));
  if (!result) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  res.json({ data: result });
});

adminRouter.use(requireAdmin);

adminRouter.get('/me', (req, res) => {
  res.json({ data: req.admin });
});

adminRouter.get('/stats', (_req, res) => {
  res.json({ data: computeStats(), comparison: todayVsYesterday() });
});

adminRouter.get('/orders', (_req, res) => {
  res.json({ data: listOrders() });
});

adminRouter.get('/orders/:id', (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json({ data: order });
});

adminRouter.patch('/orders/:id/status', (req, res) => {
  const { status, note } = req.body ?? {};
  if (!STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  const order = updateOrderStatus(req.params.id, status, note);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json({ data: order });
});

adminRouter.get('/inventory', (_req, res) => {
  const inventory = [...products.values()].map((prod) => ({
    ...prod,
    lowStock: prod.stockQty > 0 && prod.stockQty <= 20,
    outOfStock: prod.stockQty <= 0,
  }));
  res.json({ data: inventory });
});

adminRouter.post('/inventory', (req, res) => {
  const body = req.body ?? {};
  const categories: CategoryId[] = ['staples', 'vegetables', 'fruits', 'kitchenware', 'household', 'drinks', 'personal_care', 'other'];
  const units: Unit[] = ['kg', 'piece', 'bundle', 'pack', 'dozen', 'liter', 'box', 'bottle', 'can', 'bag', 'pair'];
  const name = body.name;
  const description = body.description;
  const category = body.category as CategoryId;
  const unit = body.unit as Unit;
  const price = Number(body.price);
  const stockQty = Number(body.stockQty);
  const minOrderQty = Number(body.minOrderQty ?? (unit === 'kg' ? 0.5 : 1));
  const step = Number(body.step ?? (unit === 'kg' ? 0.5 : 1));
  if (!name?.en?.trim() || !name?.kin?.trim() || !name?.fr?.trim() || !categories.includes(category) || !units.includes(unit) || !Number.isFinite(price) || price < 0 || !Number.isFinite(stockQty) || stockQty < 0 || !Number.isFinite(minOrderQty) || minOrderQty <= 0 || !Number.isFinite(step) || step <= 0) {
    res.status(400).json({ error: 'Complete valid product details are required' });
    return;
  }
  const sku = String(body.sku ?? '').trim().toUpperCase();
  if (!sku || [...products.values()].some((product) => product.sku.toLowerCase() === sku.toLowerCase())) {
    res.status(409).json({ error: 'A unique SKU is required' });
    return;
  }
  const product: Product = {
    id: `custom-${crypto.randomUUID().slice(0, 8)}`,
    sku,
    category,
    name: { en: String(name.en).trim(), kin: String(name.kin).trim(), fr: String(name.fr).trim() },
    description: {
      en: String(description?.en ?? name.en).trim(),
      kin: String(description?.kin ?? name.kin).trim(),
      fr: String(description?.fr ?? name.fr).trim(),
    },
    price: Math.round(price * 100) / 100,
    unit,
    stockQty: Math.round(stockQty * 100) / 100,
    minOrderQty: Math.round(minOrderQty * 100) / 100,
    step: Math.round(step * 100) / 100,
    emoji: typeof body.emoji === 'string' && body.emoji.trim() ? body.emoji.trim() : '🛒',
    organic: body.organic !== false,
    farmer: typeof body.farmer === 'string' && body.farmer.trim() ? body.farmer.trim() : undefined,
  };
  res.status(201).json({ data: addProduct(product) });
});

adminRouter.patch('/inventory/:id', (req, res) => {
  const { price, stockQty, organic, name, description, category, unit, farmer, emoji, minOrderQty, step } = req.body ?? {};
  const categories: CategoryId[] = ['staples', 'vegetables', 'fruits', 'kitchenware', 'household', 'drinks', 'personal_care', 'other'];
  const units: Unit[] = ['kg', 'piece', 'bundle', 'pack', 'dozen', 'liter', 'box', 'bottle', 'can', 'bag', 'pair'];
  const patch: Partial<Omit<Product, 'id'>> = {};

  if (typeof price === 'number' && Number.isFinite(price) && price >= 0) patch.price = Math.round(price * 100) / 100;
  if (typeof stockQty === 'number' && Number.isFinite(stockQty) && stockQty >= 0) patch.stockQty = stockQty;
  if (typeof organic === 'boolean') patch.organic = organic;
  if (typeof minOrderQty === 'number' && Number.isFinite(minOrderQty) && minOrderQty > 0) patch.minOrderQty = minOrderQty;
  if (typeof step === 'number' && Number.isFinite(step) && step > 0) patch.step = step;
  if (typeof category === 'string' && categories.includes(category as CategoryId)) patch.category = category as CategoryId;
  if (typeof unit === 'string' && units.includes(unit as Unit)) patch.unit = unit as Unit;
  if (typeof emoji === 'string' && emoji.trim()) patch.emoji = emoji.trim();
  if (typeof farmer === 'string') patch.farmer = farmer.trim() ? farmer.trim() : undefined;
  if (name && typeof name === 'object') {
    const n = name as { en?: unknown; kin?: unknown; fr?: unknown };
    if (typeof n.en === 'string' && n.en.trim()) patch.name = { ...(products.get(req.params.id)?.name ?? { en: '', kin: '', fr: '' }), ...patch.name, en: n.en.trim() };
    if (typeof n.kin === 'string' && n.kin.trim()) patch.name = { ...(patch.name ?? products.get(req.params.id)?.name ?? { en: '', kin: '', fr: '' }), kin: n.kin.trim() };
    if (typeof n.fr === 'string' && n.fr.trim()) patch.name = { ...(patch.name ?? products.get(req.params.id)?.name ?? { en: '', kin: '', fr: '' }), fr: n.fr.trim() };
  }
  if (description && typeof description === 'object') {
    const d = description as { en?: unknown; kin?: unknown; fr?: unknown };
    const base = products.get(req.params.id)?.description ?? { en: '', kin: '', fr: '' };
    const en = typeof d.en === 'string' && d.en.trim() ? d.en.trim() : base.en;
    const kin = typeof d.kin === 'string' && d.kin.trim() ? d.kin.trim() : base.kin;
    const fr = typeof d.fr === 'string' && d.fr.trim() ? d.fr.trim() : base.fr;
    patch.description = { en, kin, fr };
  }

  const prod = updateProduct(req.params.id, patch);
  if (!prod) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  const ref = getProduct(req.params.id);
  res.json({ data: ref ?? prod });
});

adminRouter.delete('/inventory/:id', (req, res) => {
  const removed = deleteProduct(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  res.json({ data: removed });
});

adminRouter.get('/customers', (_req, res) => {
  const customers = listCustomers().map((user) => ({
    ...user,
    addresses: listAddressesFor(user.phone),
    orders: ordersForCustomer(user.phone),
  }));
  res.json({ data: customers });
});

adminRouter.get('/notifications', (req, res) => {
  const phone = typeof req.query.phone === 'string' ? req.query.phone : '';
  const all = phone ? listNotificationsFor(phone) : listAllNotifications();
  res.json({ data: all });
});

adminRouter.get('/orders/:id/payment', (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json({
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      providerReference: order.providerReference,
      total: order.total,
    },
  });
});

adminRouter.patch('/orders/:id/payment', (req, res) => {
  const { paymentStatus, note } = req.body ?? {};
  const allowed: PaymentStatus[] = ['unpaid', 'paid', 'failed', 'refunded'];
  if (!allowed.includes(paymentStatus)) {
    res.status(400).json({ error: 'Invalid payment status' });
    return;
  }
  const order = getOrderById(req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const changed = order.paymentStatus !== paymentStatus;
  updateOrderPaymentStatus(order.id, paymentStatus);
  if (changed) {
    const label = paymentStatus.replace('_', ' ');
    order.tracking?.push({ updatedAt: new Date().toISOString(), note: note ?? `Payment → ${label}` });
    pushNotification({
      phone: order.customer.phone,
      title: 'Payment update',
      body:
        paymentStatus === 'refunded'
          ? `Refund for order ${order.orderNumber} recorded.`
          : paymentStatus === 'paid'
          ? `Payment for order ${order.orderNumber} confirmed.`
          : `Payment status for order ${order.orderNumber} is now ${label}.`,
      kind: 'order',
    });
  }
  res.json({ data: order });
});