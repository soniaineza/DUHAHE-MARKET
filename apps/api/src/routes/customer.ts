import { Router } from 'express';
import type { PaymentMethod } from '@duhahe/shared';
import { calculateOrder, createOrderFromInput, listOrders } from '../services/orderService';
import { initiatePayment } from '../services/paymentService';
import { signCustomerToken, verifyCustomerToken } from '../services/authService';
import {
  addAddress,
  consumeOtp,
  getUserByPhone,
  listAddressesFor,
  listNotificationsFor,
  markNotificationRead,
  removeAddress,
  setDefaultAddress,
  setOtp,
  upsertUser,
} from '../data/store';

const METHODS: PaymentMethod[] = ['mtn_momo', 'airtel_money', 'cash_on_delivery'];

function normalizePhone(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export const customerRouter = Router();

customerRouter.post('/auth/signup', (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const phone = normalizePhone(req.body?.phone);
  if (!name) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }
  if (phone.length < 9) {
    res.status(400).json({ error: 'A valid phone number is required' });
    return;
  }
  const existing = getUserByPhone(phone);
  const user = upsertUser({
    id: existing?.id ?? `usr-${crypto.randomUUID().slice(0, 8)}`,
    name,
    phone,
    role: 'customer',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  });
  const token = signCustomerToken(user);
  res.status(201).json({ data: { token, user } });
});

customerRouter.post('/auth/request-otp', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (phone.length < 9) {
    res.status(400).json({ error: 'A valid phone number is required' });
    return;
  }
  const demoCode = String(Math.floor(100000 + Math.random() * 900000));
  setOtp(phone, demoCode);
  res.json({ data: { phone, demoCode, registered: !!getUserByPhone(phone) } });
});

customerRouter.post('/auth/verify', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code ?? '').trim();
  if (phone.length < 9 || !consumeOtp(phone, code)) {
    res.status(401).json({ error: 'Invalid or expired code' });
    return;
  }
  const existing = getUserByPhone(phone);
  const user = upsertUser(
    existing ?? {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Duhahe customer',
      phone,
      role: 'customer',
      createdAt: new Date().toISOString(),
    }
  );
  const token = signCustomerToken(user);
  res.json({ data: { token, user } });
});

customerRouter.get('/auth/me', (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = verifyCustomerToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = getUserByPhone(payload.phone);
  if (!user) {
    res.status(401).json({ error: 'Account not found' });
    return;
  }
  res.json({ data: { user } });
});

customerRouter.get('/notifications', (req, res) => {
  const phone = normalizePhone(req.query.phone);
  if (!phone) {
    res.status(400).json({ error: 'Phone is required' });
    return;
  }
  res.json({ data: listNotificationsFor(phone) });
});

customerRouter.post('/notifications/:id/read', (req, res) => {
  const note = markNotificationRead(req.params.id);
  if (!note) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  res.json({ data: note });
});

customerRouter.get('/addresses', (req, res) => {
  const phone = normalizePhone(req.query.phone);
  if (!phone) {
    res.status(400).json({ error: 'Phone is required' });
    return;
  }
  res.json({ data: listAddressesFor(phone) });
});

customerRouter.post('/addresses', (req, res) => {
  const { label, name, province, district, address, isDefault } = req.body ?? {};
  const phone = normalizePhone(req.body?.phone);
  if (!phone || !name || !province || !district) {
    res.status(400).json({ error: 'Phone, name, province and district are required' });
    return;
  }
  const saved = addAddress({
    phone,
    label: typeof label === 'string' && label.trim() ? label.trim() : district,
    name: String(name).trim(),
    province: String(province).trim(),
    district: String(district).trim(),
    address: typeof address === 'string' && address.trim() ? address.trim() : undefined,
    isDefault: !!isDefault,
  });
  res.status(201).json({ data: saved });
});

customerRouter.delete('/addresses/:id', (req, res) => {
  const removed = removeAddress(req.params.id);
  if (!removed) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }
  res.json({ data: removed });
});

customerRouter.post('/addresses/:id/default', (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  if (!phone) {
    res.status(400).json({ error: 'Phone is required' });
    return;
  }
  const updated = setDefaultAddress(phone, req.params.id);
  if (!updated) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }
  res.json({ data: updated });
});

customerRouter.post('/orders/calculate', (req, res) => {
  const { items = [], district } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Items are required' });
    return;
  }
  const calc = calculateOrder(items, district);
  if (calc.errors) {
    res.status(409).json({ error: 'Some items are not orderable', details: calc.errors });
    return;
  }
  res.json({ data: { items: calc.items, subtotal: calc.subtotal, deliveryFee: calc.deliveryFee, total: calc.total } });
});

customerRouter.post('/orders', (req, res) => {
  const { items, customer, paymentMethod, note } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Items are required' });
    return;
  }
  if (!customer?.name || !customer?.phone) {
    res.status(400).json({ error: 'Customer name and phone are required' });
    return;
  }
  const method = METHODS.includes(paymentMethod) ? paymentMethod : 'cash_on_delivery';
  const result = createOrderFromInput({ items, customer, paymentMethod: method, note });
  if (result.errors) {
    res.status(409).json({ error: 'Some items could not be ordered', details: result.errors });
    return;
  }
  res.status(201).json({ data: result.order });
});

customerRouter.get('/orders/:phone/recent', (req, res) => {
  const phone = req.params.phone.replace(/\D/g, '');
  const mine = listOrders()
    .filter((o) => o.customer.phone.replace(/\D/g, '').endsWith(phone))
    .slice(0, 20);
  res.json({ data: mine });
});

customerRouter.post('/payments/stub', async (req, res) => {
  const { method, orderId, phone, amount } = req.body ?? {};
  if (!orderId || !phone || !amount) {
    res.status(400).json({ error: 'orderId, phone and amount are required' });
    return;
  }
  const m = METHODS.includes(method) ? method : 'mtn_momo';
  try {
    const result = await initiatePayment({ method: m, orderId: String(orderId), phone: String(phone), amount: Number(amount) });
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Payment failed' });
  }
});