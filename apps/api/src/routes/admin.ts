import { Router } from 'express';
import type { OrderStatus } from '@duhahe/shared';
import { requireAdmin } from '../middleware/auth';
import { login } from '../services/authService';
import { listOrders, getOrderById } from '../services/orderService';
import { addProduct, updateOrderStatus, updateProduct, products } from '../data/store';
import type { CategoryId, Product, Unit } from '@duhahe/shared';
import { computeStats, todayVsYesterday } from '../services/analyticsService';
import { getProduct } from '../services/productService';

const STATUSES: OrderStatus[] = ['pending', 'packing', 'in_transit', 'delivered', 'cancelled'];

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
  const { price, stockQty, organic } = req.body ?? {};
  const patch: { price?: number; stockQty?: number; organic?: boolean } = {};
  if (typeof price === 'number' && price >= 0) patch.price = Math.round(price * 100) / 100;
  if (typeof stockQty === 'number' && stockQty >= 0) patch.stockQty = stockQty;
  if (typeof organic === 'boolean') patch.organic = organic;
  const prod = updateProduct(req.params.id, patch);
  if (!prod) {
    res.status(404).json({ error: 'Product not found' });
    return;
  }
  const ref = getProduct(req.params.id);
  res.json({ data: ref ?? prod });
});