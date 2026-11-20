/** Payment endpoints are private to the order's owner, and password guessing is capped per account. */
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

describe('payment ownership and login lockout', () => {
  let alice = '';
  let bob = '';
  let order: any;
  before(async () => {
    const { createApp } = await import('../app');
    server = http.createServer(await createApp()).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    alice = await makeAccount('Alice', '250788200001', 'alicepw1');
    bob = await makeAccount('Bob', '250788200002', 'bobpw123');
    const products = (await call('GET', '/products')).body.data as { id: string }[];
    order = (await call('POST', '/orders', {
      token: alice,
      body: { items: [{ productId: products[0].id, qty: 1 }], customer: { name: 'Alice', phone: '250788200001', district: 'Gasabo', province: 'Kigali' }, paymentMethod: 'mtn_momo' },
    })).body.data;
  });
  after(() => server.close());

  it('payments need a login', async () => {
    assert.equal((await call('POST', '/payments/create', { body: { orderId: order.id, phone: '250788200001', amount: order.total } })).status, 401);
    assert.equal((await call('GET', `/payments/status/${order.id}`)).status, 401);
    assert.equal((await call('POST', '/payments/dismiss', { body: { orderId: order.id } })).status, 401);
  });

  it("another customer cannot start a payment for, or read the status of, Alice's order", async () => {
    assert.equal((await call('POST', '/payments/create', { token: bob, body: { orderId: order.id, phone: '250788200002', amount: order.total } })).status, 404);
    assert.equal((await call('GET', `/payments/status/${order.id}`, { token: bob })).status, 404);
    assert.equal((await call('POST', '/payments/dismiss', { token: bob, body: { orderId: order.id } })).status, 404);
    assert.equal((await call('GET', `/payments/status/${order.id}`, { token: alice })).status, 200);
  });

  it('the owner can still reach their own payment', async () => {
    const r = await call('POST', '/payments/create', { token: alice, body: { method: 'cash_on_delivery', orderId: order.id, phone: '250788200001', amount: order.total } });
    assert.notEqual(r.status, 401);
    assert.notEqual(r.status, 404);
    assert.equal((await call('POST', '/payments/dismiss', { token: alice, body: { orderId: order.id } })).status, 200);
  });

  it('webhook sync and config are admin-only', async () => {
    assert.equal((await call('POST', '/webhooks/paypack/abc/sync')).status, 401);
    assert.equal((await call('GET', '/webhooks/paypack/config')).status, 401);
  });

  it('5 wrong passwords lock the account, even for the right password', async () => {
    for (let i = 0; i < 5; i++) {
      assert.equal((await call('POST', '/auth/login', { body: { phone: '250788200002', password: 'nope-nope' } })).status, 401);
    }
    assert.equal((await call('POST', '/auth/login', { body: { phone: '250788200002', password: 'bobpw123' } })).status, 429);
    // Alice is unaffected.
    assert.equal((await call('POST', '/auth/login', { body: { phone: '250788200001', password: 'alicepw1' } })).status, 200);
  });
});
