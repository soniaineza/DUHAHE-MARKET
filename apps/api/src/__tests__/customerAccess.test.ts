/** A signed-in customer must only ever reach their own data; anonymous callers reach none of it. */
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

let server: http.Server;
let base = '';

async function makeAccount(name: string, phone: string, password: string): Promise<string> {
  const { upsertUser } = await import('../data/store');
  const { hashPassword, signCustomerToken } = await import('../services/authService');
  const user = upsertUser({
    id: `usr-${phone}`,
    name,
    phone,
    role: 'customer',
    createdAt: new Date().toISOString(),
    passwordHash: hashPassword(password),
  });
  return signCustomerToken(user);
}

async function call(method: string, path: string, opts: { token?: string; body?: unknown } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as { data?: any; error?: string } };
}

describe('customer data access control', () => {
  let alice = '';
  let bob = '';
  let aliceAddressId = '';

  before(async () => {
    const { createApp } = await import('../app');
    const app = await createApp();
    server = http.createServer(app).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    alice = await makeAccount('Alice', '250788100001', 'alicepw1');
    bob = await makeAccount('Bob', '250788100002', 'bobpw123');
  });
  after(() => server.close());

  it('rejects anonymous access to every private endpoint', async () => {
    for (const [m, p] of [['GET', '/addresses'], ['GET', '/favorites'], ['GET', '/cart'], ['GET', '/notifications'], ['GET', '/orders/mine'], ['PUT', '/cart'], ['POST', '/orders']] as const) {
      assert.equal((await call(m, p)).status, 401, `${m} ${p}`);
    }
    // The old phone-in-the-URL style no longer leaks anything.
    assert.equal((await call('GET', '/addresses?phone=250788100001')).status, 401);
    assert.equal((await call('GET', '/orders/250788100001/recent')).status, 404);
  });

  it('a phone number sent by the client is ignored: Bob cannot see Alice by passing her phone', async () => {
    const saved = await call('POST', '/addresses', { token: alice, body: { name: 'Alice', province: 'Kigali', district: 'Gasabo', address: 'KG 1' } });
    assert.equal(saved.status, 201);
    aliceAddressId = saved.body.data.id;
    const bobView = await call('GET', '/addresses?phone=250788100001', { token: bob });
    assert.deepEqual(bobView.body.data, []);
    const aliceView = await call('GET', '/addresses', { token: alice });
    assert.equal(aliceView.body.data.length, 1);
  });

  it("Bob cannot delete or default Alice's address", async () => {
    assert.equal((await call('DELETE', `/addresses/${aliceAddressId}`, { token: bob })).status, 404);
    assert.equal((await call('POST', `/addresses/${aliceAddressId}/default`, { token: bob, body: { phone: '250788100001' } })).status, 404);
    assert.equal((await call('GET', '/addresses', { token: alice })).body.data.length, 1);
  });

  it("favourites and carts are per account, even if the body names someone else's phone", async () => {
    await call('PUT', '/favorites', { token: bob, body: { phone: '250788100001', ids: ['x1'] } });
    assert.deepEqual((await call('GET', '/favorites', { token: alice })).body.data.ids, []);
    assert.deepEqual((await call('GET', '/favorites', { token: bob })).body.data.ids, ['x1']);
  });

  it("signing up again with an existing phone cannot take over the account", async () => {
    const r = await call('POST', '/auth/signup', { body: { name: 'Mallory', email: 'mallory@example.com', phone: '0788100001', password: 'Hacked#123', confirmPassword: 'Hacked#123' } });
    assert.equal(r.status, 409);
    assert.equal((await call('POST', '/auth/login', { body: { phone: '250788100001', password: 'hacked123' } })).status, 401);
    assert.equal((await call('POST', '/auth/login', { body: { phone: '250788100001', password: 'alicepw1' } })).status, 200);
  });

  it('order tracking needs the matching order number AND phone', async () => {
    const products = (await call('GET', '/products')).body.data as { id: string }[];
    const order = (await call('POST', '/orders', {
      token: alice,
      body: { items: [{ productId: products[0].id, qty: 1 }], customer: { name: 'Alice', phone: '0788100001', district: 'Gasabo', province: 'Kigali' }, paymentMethod: 'cash_on_delivery' },
    })).body.data;
    assert.ok(order?.orderNumber);
    assert.equal((await call('GET', `/orders/track?orderNumber=${order.orderNumber}&phone=250788100001`)).status, 200);
    assert.equal((await call('GET', `/orders/track?orderNumber=${order.orderNumber}&phone=250788999999`)).status, 404);
    assert.equal((await call('GET', `/orders/mine`, { token: alice })).body.data.length >= 1, true);
    assert.equal((await call('GET', `/orders/mine`, { token: bob })).body.data.length, 0);
  });

  it('account deletion works and revokes the session', async () => {
    assert.equal((await call('DELETE', '/auth/account', { token: bob, body: { password: 'wrong' } })).status, 401);
    assert.equal((await call('DELETE', '/auth/account', { token: bob, body: { password: 'bobpw123' } })).status, 200);
    assert.equal((await call('GET', '/auth/me', { token: bob })).status, 401);
  });
});

describe('store-review account', () => {
  it('is created from env, signs in, and is forced to cash on delivery', async () => {
    const { config } = await import('../config');
    (config as { reviewer: unknown }).reviewer = { phone: '250788999000', password: 'reviewpass1' };
    const { createApp } = await import('../app');
    const app = await createApp();
    const srv = http.createServer(app).listen(0);
    const b = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api`;
    try {
      const login = await (await fetch(`${b}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '250788999000', password: 'reviewpass1' }) })).json() as any;
      assert.ok(login.data?.token);
      const products = (await (await fetch(`${b}/products`)).json() as any).data;
      const order = (await (await fetch(`${b}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` },
        body: JSON.stringify({ items: [{ productId: products[0].id, qty: 1 }], customer: { name: 'R', phone: '250788999000', district: 'Gasabo', province: 'Kigali' }, paymentMethod: 'mtn_momo' }),
      })).json() as any).data;
      assert.equal(order.paymentMethod, 'cash_on_delivery');
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });

  it('cannot delete the account or pay by mobile money', async () => {
    const { config } = await import('../config');
    (config as { reviewer: unknown }).reviewer = { phone: '250788999000', password: 'reviewpass1' };
    const { createApp } = await import('../app');
    const app = await createApp();
    const srv = http.createServer(app).listen(0);
    const b = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api`;
    const auth = { 'Content-Type': 'application/json', Authorization: '' };
    try {
      const login = await (await fetch(`${b}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '250788999000', password: 'reviewpass1' }) })).json() as any;
      auth.Authorization = `Bearer ${login.data.token}`;

      const del = await fetch(`${b}/auth/account`, { method: 'DELETE', headers: auth, body: JSON.stringify({ password: 'reviewpass1' }) });
      assert.equal(del.status, 403);
      assert.match(((await del.json()) as any).error, /cannot be deleted/);
      assert.equal((await fetch(`${b}/auth/me`, { headers: auth })).status, 200);

      const products = (await (await fetch(`${b}/products`)).json() as any).data;
      const order = (await (await fetch(`${b}/orders`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ items: [{ productId: products[0].id, qty: 1 }], customer: { name: 'R', phone: '250788999000', district: 'Gasabo', province: 'Kigali' }, paymentMethod: 'cash_on_delivery' }),
      })).json() as any).data;
      const payRes = await fetch(`${b}/payments/create`, {
        method: 'POST',
        headers: auth,
        body: JSON.stringify({ orderId: order.id, method: 'mtn_momo', phone: '250788999000', amount: order.total }),
      });
      assert.equal(payRes.status, 403);
      assert.match(((await payRes.json()) as any).error, /only pay on delivery/);

      const { initiatePayment } = await import('../services/paymentService');
      const direct = await initiatePayment({ method: 'mtn_momo', orderId: order.id, phone: '250788999000', amount: order.total });
      assert.equal(direct.success, false);
      assert.match(direct.message.en, /only pay on delivery/);
      assert.equal(direct.attemptId, undefined);
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
    }
  });
});

describe('admin customer export', () => {
  it('does not expose password hashes', async () => {
    const { upsertUser, deleteUserAccount } = await import('../data/store');
    const { config } = await import('../config');
    const { createApp } = await import('../app');
    const phone = '250788000222';
    upsertUser({ id: 'usr-admin-leak', name: 'No Hash', phone, role: 'customer', createdAt: new Date().toISOString(), passwordHash: 'super-secret-hash' });
    const srv = http.createServer(await createApp()).listen(0);
    const adminBase = `http://127.0.0.1:${(srv.address() as AddressInfo).port}/api`;
    try {
      const login = await (await fetch(`${adminBase}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: config.admin.email, password: config.admin.password }),
      })).json() as any;
      for (const path of ['/admin/customers', '/admin/export']) {
        const res = await fetch(adminBase + path, { headers: { Authorization: `Bearer ${login.data.token}` } });
        assert.equal(res.status, 200);
        assert.equal((await res.text()).includes('super-secret-hash'), false, `${path} must not leak passwordHash`);
      }
    } finally {
      await new Promise<void>((resolve) => srv.close(() => resolve()));
      deleteUserAccount(phone);
    }
  });
});
