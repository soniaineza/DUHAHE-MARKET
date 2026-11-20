import crypto from 'node:crypto';
import { Router } from 'express';
import { config } from '../config';
import type { Request, Response } from 'express';
import { canonicalRwandaPhone, isStrongPassword, isValidEmail, normalizeEmail, normalizeProvince, provinceOfDistrict, type PaymentMethod } from '@duhahe/shared';
import { emailAvailable, sendEmail, sendSms, smsAvailable } from '../services/notify';
import { calculateOrder, createOrderFromInput, getOrderById, listOrders } from '../services/orderService';
import { dismissPayment, initiatePayment, syncOrderPayment } from '../services/paymentService';
import { codeSendRateLimit, trackRateLimit } from '../middleware/rateLimit';
import { signCustomerToken, verifyCustomerToken, revokeToken, hashPassword, verifyPassword } from '../services/authService';
import {
  addAddress,
  consumeOtp,
  deleteUserAccount,
  deleteResetCode,
  getCartFor,
  getFavoritesFor,
  getResetCode,
  findUserByPhone,
  getUserByEmail,
  getUserByPhone,
  listAddressesFor,
  listNotificationsFor,
  markNotificationRead,
  removeAddress,
  setCartFor,
  setDefaultAddress,
  setFavoritesFor,
  setOtp,
  setResetCode,
  sweepResetCodes,
  toggleFavorite,
  upsertUser,
} from '../data/store';

const METHODS: PaymentMethod[] = ['mtn_momo', 'airtel_money', 'cash_on_delivery'];

function normalizePhone(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

/** Same subscriber regardless of format (0788…, 250788…, +250 788…): compare the last 9 digits. */
function samePhone(a: unknown, b: unknown): boolean {
  const x = normalizePhone(a).slice(-9);
  return x.length === 9 && x === normalizePhone(b).slice(-9);
}

/** Strip the password hash before any user object leaves the API. */
function publicUser(user: { id: string; name: string; phone: string; email?: string; phoneVerified?: boolean; role: 'customer'; createdAt: string }) {
  return { id: user.id, name: user.name, phone: user.phone, email: user.email, phoneVerified: !!user.phoneVerified, role: user.role, createdAt: user.createdAt };
}

/**
 * Resolve the signed-in customer from the Bearer token. The phone number is ALWAYS taken from the
 * verified token (never from the request), so one customer can never read or change another's data.
 * Sends 401 and returns null when the caller is not signed in (or the account no longer exists).
 */
/** The account behind a customer token, or undefined (bad/expired/revoked token, deleted account, or a session from before a password reset). */
function customerFromToken(token: string) {
  const payload = verifyCustomerToken(token);
  const user = payload ? getUserByPhone(payload.phone) : undefined;
  if (!payload || !user) return undefined;
  if ((payload.pv ?? 0) !== (user.passwordChangedAt ?? 0)) return undefined;
  return user;
}

function requireCustomer(req: Request, res: Response): string | null {
  const header = req.headers.authorization ?? '';
  const user = customerFromToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  if (!user) {
    res.status(401).json({ error: 'Please sign in' });
    return null;
  }
  return user.phone;
}

/** Per-account brute-force guard: 5 wrong passwords lock that phone's login for 15 minutes. */
const loginFailures = new Map<string, { fails: number; lockedUntil: number }>();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
function loginLocked(phone: string): boolean {
  const f = loginFailures.get(phone);
  return !!f && f.lockedUntil > Date.now();
}
function noteLoginFailure(phone: string) {
  const fails = (loginFailures.get(phone)?.fails ?? 0) + 1;
  loginFailures.set(phone, fails >= MAX_FAILS ? { fails: 0, lockedUntil: Date.now() + LOCK_MS } : { fails, lockedUntil: 0 });
}

export const customerRouter = Router();

// ---- Sign-up with verified contact details --------------------------------------------------------------
// An account only exists after the customer proves they own the email (and, when an SMS provider is
// configured, the phone number) by entering the 6-digit codes we send. Until then nothing is created.

interface PendingSignup {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  emailCodeHash: string;
  phoneCodeHash?: string;
  expiresAt: number;
  attempts: number;
  sends: number;
  lastSentAt: number;
}
const pendingSignups = new Map<string, PendingSignup>();
const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const MAX_SENDS = 5;

const hashCode = (code: string) => crypto.createHash('sha256').update(`duhahe-code:${code}`).digest('hex');
const newCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
function codeMatches(input: unknown, expectedHash: string): boolean {
  const a = Buffer.from(hashCode(String(input ?? '').trim()));
  const b = Buffer.from(expectedHash);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function sweepPending() {
  const now = Date.now();
  for (const [k, v] of pendingSignups) if (v.expiresAt < now) pendingSignups.delete(k);
}

/** Generate fresh codes for a pending sign-up and deliver them. Throws if delivery fails. */
async function sendSignupCodes(p: PendingSignup): Promise<void> {
  const emailCode = newCode();
  p.emailCodeHash = hashCode(emailCode);
  const phoneCode = smsAvailable() ? newCode() : undefined;
  p.phoneCodeHash = phoneCode ? hashCode(phoneCode) : undefined;
  p.expiresAt = Date.now() + CODE_TTL_MS;
  p.attempts = 0;
  p.sends += 1;
  p.lastSentAt = Date.now();
  await sendEmail(
    p.email,
    'Your Duhahe Rwanda Market verification code',
    `Your verification code is ${emailCode}. It expires in 10 minutes. If you did not try to create an account, ignore this email.`
  );
  if (phoneCode) await sendSms(p.phone, `Duhahe Rwanda Market code: ${phoneCode}. Expires in 10 minutes.`);
}

customerRouter.post('/auth/signup', codeSendRateLimit, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = normalizeEmail(req.body?.email);
  const phone = canonicalRwandaPhone(req.body?.phone);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const confirm = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';
  if (name.length < 2 || name.length > 80) {
    res.status(400).json({ error: 'Please enter your full name' });
    return;
  }
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address' });
    return;
  }
  if (!phone) {
    res.status(400).json({ error: 'Please enter a valid Rwandan mobile number (e.g. 0788 123 456)' });
    return;
  }
  if (!isStrongPassword(password)) {
    res.status(400).json({
      error: 'Password needs at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol',
    });
    return;
  }
  if (password !== confirm) {
    res.status(400).json({ error: 'Passwords do not match' });
    return;
  }
  if (getUserByEmail(email) || findUserByPhone(phone)) {
    res.status(409).json({ error: 'An account with this email or phone number already exists. Please sign in.' });
    return;
  }
  if (!emailAvailable()) {
    res.status(503).json({ error: 'Account verification is not available right now. Please try again later.' });
    return;
  }
  sweepPending();
  const existing = pendingSignups.get(email);
  if (existing && Date.now() - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: 'A code was just sent. Please wait a minute before trying again.' });
    return;
  }
  const pending: PendingSignup = {
    name,
    email,
    phone,
    passwordHash: hashPassword(password),
    emailCodeHash: '',
    expiresAt: 0,
    attempts: 0,
    sends: existing?.sends ?? 0,
    lastSentAt: 0,
  };
  if (pending.sends >= MAX_SENDS) {
    res.status(429).json({ error: 'Too many codes requested. Please try again later.' });
    return;
  }
  try {
    await sendSignupCodes(pending);
  } catch (err) {
    console.error('Verification email/SMS failed:', err instanceof Error ? err.message : err);
    res.status(502).json({
      error: 'We could not send the verification code. Check your email address and phone number and try again.',
    });
    return;
  }
  pendingSignups.set(email, pending);
  res.status(202).json({
    data: { email, phoneVerificationRequired: !!pending.phoneCodeHash, expiresInSeconds: CODE_TTL_MS / 1000 },
  });
});

customerRouter.post('/auth/signup/resend', codeSendRateLimit, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const pending = pendingSignups.get(email);
  if (!pending) {
    res.status(404).json({ error: 'Sign-up expired. Please start again.' });
    return;
  }
  if (Date.now() - pending.lastSentAt < RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: 'Please wait a minute before requesting another code.' });
    return;
  }
  if (pending.sends >= MAX_SENDS) {
    pendingSignups.delete(email);
    res.status(429).json({ error: 'Too many codes requested. Please start again later.' });
    return;
  }
  try {
    await sendSignupCodes(pending);
  } catch (err) {
    console.error('Verification resend failed:', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'We could not send the code. Please try again.' });
    return;
  }
  res.json({
    data: { email, phoneVerificationRequired: !!pending.phoneCodeHash, expiresInSeconds: CODE_TTL_MS / 1000 },
  });
});

customerRouter.post('/auth/signup/verify', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const pending = pendingSignups.get(email);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingSignups.delete(email);
    res.status(410).json({ error: 'The code expired. Please start again.' });
    return;
  }
  pending.attempts += 1;
  if (pending.attempts > MAX_CODE_ATTEMPTS) {
    pendingSignups.delete(email);
    res.status(429).json({ error: 'Too many wrong codes. Please start again.' });
    return;
  }
  const emailOk = codeMatches(req.body?.emailCode, pending.emailCodeHash);
  const phoneOk = pending.phoneCodeHash ? codeMatches(req.body?.phoneCode, pending.phoneCodeHash) : true;
  if (!emailOk || !phoneOk) {
    res.status(401).json({ error: !emailOk ? 'The email code is not correct' : 'The phone code is not correct' });
    return;
  }
  if (getUserByEmail(email) || findUserByPhone(pending.phone)) {
    pendingSignups.delete(email);
    res.status(409).json({ error: 'An account with this email or phone number already exists. Please sign in.' });
    return;
  }
  const user = upsertUser({
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    name: pending.name,
    phone: pending.phone,
    email: pending.email,
    emailVerified: true,
    phoneVerified: !!pending.phoneCodeHash,
    role: 'customer',
    createdAt: new Date().toISOString(),
    passwordHash: pending.passwordHash,
  });
  pendingSignups.delete(email);
  res.status(201).json({ data: { token: signCustomerToken(user), user: publicUser(user) } });
});

/** Sign in with the email OR the phone number the account was registered with, plus the password. */
customerRouter.post('/auth/login', (req, res) => {
  const identifier = String(req.body?.identifier ?? req.body?.phone ?? '').trim();
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!identifier || !password) {
    res.status(400).json({ error: 'Email or phone and password are required' });
    return;
  }
  const byEmail = identifier.includes('@');
  const lockKey = byEmail ? normalizeEmail(identifier) : identifier.replace(/\D/g, '').slice(-9);
  if (loginLocked(lockKey)) {
    res.status(429).json({ error: 'Too many wrong passwords. Try again in 15 minutes.' });
    return;
  }
  const user = byEmail ? getUserByEmail(identifier) : findUserByPhone(identifier);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    noteLoginFailure(lockKey);
    res.status(401).json({ error: 'Invalid email/phone or password' });
    return;
  }
  loginFailures.delete(lockKey);
  res.json({ data: { token: signCustomerToken(user), user: publicUser(user) } });
});

// ---- Forgot password -----------------------------------------------------------------------------------
// A 6-digit code is emailed to the account's verified email. Asking never reveals whether an email is
// registered (the answer is always the same). A successful reset signs out every other session.

customerRouter.post('/auth/forgot', codeSendRateLimit, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!isValidEmail(email)) {
    res.status(400).json({ error: 'Please enter a valid email address' });
    return;
  }
  if (!emailAvailable()) {
    res.status(503).json({ error: 'Password reset is not available right now. Please try again later.' });
    return;
  }
  sweepResetCodes();
  const answer = () => res.status(202).json({ data: { ok: true, expiresInSeconds: CODE_TTL_MS / 1000 } });
  const user = getUserByEmail(email);
  if (!user) {
    answer(); // same answer as for a real account, so the endpoint cannot be used to find who is registered
    return;
  }
  const existing = getResetCode(email);
  const now = Date.now();
  if (existing && now - existing.lastSentAt < RESEND_COOLDOWN_MS) {
    answer();
    return;
  }
  const sends = existing && existing.expiresAt > now ? existing.sends : 0;
  if (sends >= MAX_SENDS) {
    answer();
    return;
  }
  const code = newCode();
  try {
    await sendEmail(
      email,
      'Reset your Duhahe Rwanda Market password',
      `Your password reset code is ${code}. It expires in 10 minutes. If you did not ask to reset your password, ignore this email - your password has not changed.`
    );
  } catch (err) {
    console.error('Password reset email failed:', err instanceof Error ? err.message : err);
    res.status(502).json({ error: 'We could not send the code. Please try again.' });
    return;
  }
  setResetCode({ email, codeHash: hashCode(code), userPhone: user.phone, expiresAt: now + CODE_TTL_MS, attempts: 0, sends: sends + 1, lastSentAt: now });
  answer();
});

customerRouter.post('/auth/reset', (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const confirm = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';
  if (!isStrongPassword(password)) {
    res.status(400).json({
      error: 'Password needs at least 8 characters with an uppercase letter, a lowercase letter, a number and a symbol',
    });
    return;
  }
  if (password !== confirm) {
    res.status(400).json({ error: 'Passwords do not match' });
    return;
  }
  sweepResetCodes();
  const pending = getResetCode(email);
  if (!pending) {
    deleteResetCode(email);
    res.status(410).json({ error: 'The code expired. Please request a new one.' });
    return;
  }
  const attempts = pending.attempts + 1;
  if (attempts > MAX_CODE_ATTEMPTS) {
    deleteResetCode(email);
    res.status(429).json({ error: 'Too many wrong codes. Please request a new one.' });
    return;
  }
  setResetCode({ ...pending, attempts });
  if (!codeMatches(req.body?.code, pending.codeHash)) {
    res.status(401).json({ error: 'The code is not correct' });
    return;
  }
  const user = getUserByPhone(pending.userPhone);
  if (!user || user.email !== email) {
    deleteResetCode(email);
    res.status(410).json({ error: 'The code expired. Please request a new one.' });
    return;
  }
  const updated = upsertUser({ ...user, passwordHash: hashPassword(password), passwordChangedAt: Date.now() });
  deleteResetCode(email);
  loginFailures.delete(email);
  loginFailures.delete(updated.phone.replace(/\D/g, '').slice(-9));
  res.json({ data: { token: signCustomerToken(updated), user: publicUser(updated) } });
});

customerRouter.post('/auth/logout', (req, res) => {
  const header = req.headers.authorization ?? '';
  revokeToken(header.startsWith('Bearer ') ? header.slice(7) : '');
  res.json({ data: { ok: true } });
});

/** Required by Apple App Store & Google Play: in-app account deletion. */
customerRouter.delete('/auth/account', (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = customerFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  if (config.reviewer && samePhone(user.phone, config.reviewer.phone)) {
    res.status(403).json({ error: 'The store-review account cannot be deleted from the app.' });
    return;
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const lockKey = user.phone.replace(/\D/g, '').slice(-9);
  if (user.passwordHash && (loginLocked(lockKey) || !verifyPassword(password, user.passwordHash))) {
    if (!loginLocked(lockKey)) noteLoginFailure(lockKey);
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }
  deleteUserAccount(user.phone);
  revokeToken(token);
  res.json({ data: { ok: true } });
});

customerRouter.get('/auth/me', (req, res) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const user = customerFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  res.json({ data: { user: publicUser(user) } });
});

customerRouter.get('/notifications', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  res.json({ data: listNotificationsFor(phone) });
});

customerRouter.post('/notifications/:id/read', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  if (!listNotificationsFor(phone).some((n) => n.id === req.params.id)) {
    res.status(404).json({ error: 'Notification not found' });
    return;
  }
  res.json({ data: markNotificationRead(req.params.id) });
});

customerRouter.get('/addresses', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  res.json({ data: listAddressesFor(phone) });
});

customerRouter.post('/addresses', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  const { label, name, province, district, address, isDefault } = req.body ?? {};
  if (!name || !province || !district) {
    res.status(400).json({ error: 'Name, province and district are required' });
    return;
  }
  const saved = addAddress({
    phone,
    label: typeof label === 'string' && label.trim() ? label.trim() : district,
    name: String(name).trim(),
    province: provinceOfDistrict(String(district)) ?? normalizeProvince(String(province)) ?? String(province).trim(),
    district: String(district).trim(),
    address: typeof address === 'string' && address.trim() ? address.trim() : undefined,
    isDefault: !!isDefault,
  });
  res.status(201).json({ data: saved });
});

customerRouter.delete('/addresses/:id', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  if (!listAddressesFor(phone).some((a) => a.id === req.params.id)) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }
  res.json({ data: removeAddress(req.params.id) });
});

customerRouter.post('/addresses/:id/default', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  const updated = setDefaultAddress(phone, req.params.id);
  if (!updated) {
    res.status(404).json({ error: 'Address not found' });
    return;
  }
  res.json({ data: updated });
});

customerRouter.get('/favorites', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  res.json({ data: { ids: getFavoritesFor(phone) } });
});

customerRouter.put('/favorites', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  res.json({ data: { ids: setFavoritesFor(phone, ids) } });
});

customerRouter.post('/favorites/toggle', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';
  if (!productId) {
    res.status(400).json({ error: 'productId is required' });
    return;
  }
  res.json({ data: { ids: toggleFavorite(phone, productId) } });
});

customerRouter.get('/cart', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  res.json({ data: { items: getCartFor(phone) } });
});

customerRouter.put('/cart', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  res.json({ data: { items: setCartFor(phone, items) } });
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
  const accountPhone = requireCustomer(req, res);
  if (!accountPhone) return;
  const { items, customer, paymentMethod, note } = req.body ?? {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Items are required' });
    return;
  }
  if (!customer?.name || !customer?.phone) {
    res.status(400).json({ error: 'Customer name and phone are required' });
    return;
  }
  let method = METHODS.includes(paymentMethod) ? paymentMethod : 'cash_on_delivery';
  // Store-review account: never start a real mobile-money charge, and never let the
  // published demo credentials be used to place an order for somebody else's phone.
  const isReviewer = !!config.reviewer && samePhone(accountPhone, config.reviewer.phone);
  if (isReviewer) method = 'cash_on_delivery';
  const orderCustomer = isReviewer ? { ...customer, name: 'Store Reviewer', phone: accountPhone } : customer;
  const result = createOrderFromInput({ items, customer: orderCustomer, accountPhone, paymentMethod: method, note });
  if (result.errors) {
    res.status(409).json({ error: 'Some items could not be ordered', details: result.errors });
    return;
  }
  res.status(201).json({ data: result.order });
});

/**
 * Guest-friendly tracking: a single order is returned only when BOTH the order number and the phone
 * number it was placed with match (order numbers alone are sequential and guessable).
 */
customerRouter.get('/orders/track', trackRateLimit, (req, res) => {
  const orderNumber = typeof req.query.orderNumber === 'string' ? req.query.orderNumber.trim() : '';
  const phone = normalizePhone(req.query.phone);
  const order =
    orderNumber && phone.length >= 9
      ? listOrders().find((o) => o.orderNumber === orderNumber && samePhone(o.customer.phone, phone))
      : undefined;
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  res.json({ data: order });
});

/** The signed-in customer's own recent orders. */
customerRouter.get('/orders/mine', (req, res) => {
  const phone = requireCustomer(req, res);
  if (!phone) return;
  const mine = listOrders()
    .filter((o) => o.accountPhone === phone || samePhone(o.customer.phone, phone))
    .slice(0, 20);
  res.json({ data: mine });
});

/** An order belongs to the account that placed it (or, for older orders, the account whose phone it carries). */
function ownsOrder(order: { accountPhone?: string; customer: { phone: string } } | undefined, phone: string): boolean {
  return !!order && (order.accountPhone === phone || samePhone(order.customer.phone, phone));
}

const createPaymentHandler = async (req: Request, res: Response) => {
  const accountPhone = requireCustomer(req, res);
  if (!accountPhone) return;
  const { method, orderId, phone, amount, supersedeAttemptId } = req.body ?? {};
  if (!orderId || !phone || amount === undefined || amount === null || amount === '') {
    res.status(400).json({ error: 'orderId, phone and amount are required' });
    return;
  }
  if (!Number.isFinite(Number(amount))) {
    res.status(400).json({ error: 'amount must be a number' });
    return;
  }
  if (!ownsOrder(getOrderById(String(orderId)), accountPhone)) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  // The store-review password is published in the App Store listing. Even if someone
  // calls the payment API directly, no reviewer order may start a real charge.
  if (config.reviewer && samePhone(accountPhone, config.reviewer.phone)) {
    res.status(403).json({ error: 'The store-review account can only pay on delivery.' });
    return;
  }
  // NOTE: the amount is only a client claim — paymentService rejects it unless
  // it exactly equals the order total computed by the server.
  const m = METHODS.includes(method) ? method : 'mtn_momo';
  try {
    const result = await initiatePayment({
      method: m,
      orderId: String(orderId),
      phone: String(phone),
      amount: Number(amount),
      supersedeAttemptId: typeof supersedeAttemptId === 'string' && supersedeAttemptId ? supersedeAttemptId : undefined,
    });
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Payment failed' });
  }
};

customerRouter.post('/payments/create', createPaymentHandler);
customerRouter.post('/payments/stub', createPaymentHandler);

/**
 * Live payment status for the waiting screen: reconciles the order with
 * Paypack so approval, cancellation and expiry are all detected.
 */
customerRouter.get('/payments/status/:orderId', async (req, res) => {
  const accountPhone = requireCustomer(req, res);
  if (!accountPhone) return;
  if (!ownsOrder(getOrderById(req.params.orderId), accountPhone)) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  try {
    const attemptId = typeof req.query.attempt === 'string' ? req.query.attempt : undefined;
    const result = await syncOrderPayment(req.params.orderId, attemptId);
    if (!result) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Payment status check failed' });
  }
});

customerRouter.post('/payments/dismiss', async (req, res) => {
  const accountPhone = requireCustomer(req, res);
  if (!accountPhone) return;
  const { orderId, attemptId } = req.body ?? {};
  if (!orderId) {
    res.status(400).json({ error: 'orderId is required' });
    return;
  }
  if (!ownsOrder(getOrderById(String(orderId)), accountPhone)) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  try {
    const result = await dismissPayment(String(orderId), typeof attemptId === 'string' && attemptId ? attemptId : undefined);
    if (!result) {
      res.status(404).json({ error: 'Payment attempt not found' });
      return;
    }
    res.json({ data: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Could not close payment request' });
  }
});