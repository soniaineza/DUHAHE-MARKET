/** Forgot-password: emailed code, strong new password, old sessions and old password stop working. */
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

let server: http.Server;
let base = '';
let ip = 0;
async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Forwarded-For': `10.8.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as { data?: any; error?: string } };
}

const OLD = 'Old!Passw0rd';
const NEW = 'Brand#New9pass';
const suffix = Date.now().toString().slice(-6);
const graceEmail = `grace${suffix}@example.com`;
const gracePhone = `0788${suffix}`;
const bruteEmail = `brute2${suffix}@example.com`;
const brutePhone = `0789${suffix}`;
const restartEmail = `restart${suffix}@example.com`;
const restartPhone = `0787${suffix}`;

describe('forgot password', () => {
  let outbox: { channel: string; to: string; text: string }[];
  let oldToken = '';
  const lastCode = (to: string) => /(\d{6})/.exec([...outbox].reverse().find((m) => m.to === to)!.text)![1];

  before(async () => {
    const { createApp } = await import('../app');
    server = http.createServer(await createApp()).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    outbox = (await import('../services/notify')).testOutbox;
    // A real account through the real verified sign-up.
    await call('POST', '/auth/signup', { name: 'Grace M', email: graceEmail, phone: gracePhone, password: OLD, confirmPassword: OLD });
    const ok = await call('POST', '/auth/signup/verify', { email: graceEmail, emailCode: lastCode(graceEmail) });
    assert.equal(ok.status, 201);
    oldToken = ok.body.data.token;
  });
  after(() => server.close());

  it('answers the same for unknown and known emails and only emails real accounts', async () => {
    const before = outbox.length;
    const unknown = await call('POST', '/auth/forgot', { email: 'nobody@example.com' });
    assert.equal(unknown.status, 202);
    assert.equal(outbox.length, before, 'nothing is sent to an unregistered address');
    const known = await call('POST', '/auth/forgot', { email: graceEmail.toUpperCase() });
    assert.equal(known.status, 202);
    assert.deepEqual(known.body, unknown.body);
    assert.equal(outbox.length, before + 1);
    assert.equal(outbox[outbox.length - 1].to, graceEmail);
    assert.equal((await call('POST', '/auth/forgot', { email: 'not-an-email' })).status, 400);
  });

  it('rejects weak or mismatched new passwords and wrong codes without changing anything', async () => {
    const code = lastCode(graceEmail);
    assert.equal((await call('POST', '/auth/reset', { email: graceEmail, code, password: 'weakpass', confirmPassword: 'weakpass' })).status, 400);
    assert.equal((await call('POST', '/auth/reset', { email: graceEmail, code, password: NEW, confirmPassword: 'Other#1234pass' })).status, 400);
    assert.equal((await call('POST', '/auth/reset', { email: graceEmail, code: '000000', password: NEW, confirmPassword: NEW })).status, 401);
    assert.equal((await call('POST', '/auth/login', { identifier: graceEmail, password: OLD })).status, 200);
  });

  it('the emailed code sets the new password, signs in, and ends every older session', async () => {
    const code = lastCode(graceEmail);
    assert.equal((await call('GET', '/cart', undefined, oldToken)).status, 200, 'old session works before the reset');
    const reset = await call('POST', '/auth/reset', { email: graceEmail, code, password: NEW, confirmPassword: NEW });
    assert.equal(reset.status, 200);
    assert.ok(reset.body.data.token);
    assert.equal(reset.body.data.user.passwordHash, undefined);
    // New password works (by email and by phone), old one does not.
    assert.equal((await call('POST', '/auth/login', { identifier: graceEmail, password: NEW })).status, 200);
    assert.equal((await call('POST', '/auth/login', { identifier: gracePhone, password: NEW })).status, 200);
    assert.equal((await call('POST', '/auth/login', { identifier: graceEmail, password: OLD })).status, 401);
    // The session from before the reset is rejected; the new one works.
    assert.equal((await call('GET', '/cart', undefined, oldToken)).status, 401);
    assert.equal((await call('GET', '/auth/me', undefined, oldToken)).status, 401);
    assert.equal((await call('GET', '/cart', undefined, reset.body.data.token)).status, 200);
  });

  it('a code works only once', async () => {
    const code = lastCode(graceEmail);
    assert.equal((await call('POST', '/auth/reset', { email: graceEmail, code, password: 'Another#Pass77', confirmPassword: 'Another#Pass77' })).status, 410);
  });

  it('5 wrong codes cancel the reset', async () => {
    // New request (the 60s cooldown is bypassed by using a second account).
    await call('POST', '/auth/signup', { name: 'Brute F', email: bruteEmail, phone: brutePhone, password: OLD, confirmPassword: OLD });
    await call('POST', '/auth/signup/verify', { email: bruteEmail, emailCode: lastCode(bruteEmail) });
    await call('POST', '/auth/forgot', { email: bruteEmail });
    const right = lastCode(bruteEmail);
    for (let i = 0; i < 5; i++) {
      assert.equal((await call('POST', '/auth/reset', { email: bruteEmail, code: '111111', password: NEW, confirmPassword: NEW })).status, 401);
    }
    assert.equal((await call('POST', '/auth/reset', { email: bruteEmail, code: right, password: NEW, confirmPassword: NEW })).status, 429);
    assert.equal((await call('POST', '/auth/reset', { email: bruteEmail, code: right, password: NEW, confirmPassword: NEW })).status, 410);
  });

  it('a second request inside a minute sends no second email', async () => {
    const before = outbox.filter((m) => m.to === graceEmail).length;
    await call('POST', '/auth/forgot', { email: graceEmail });
    const afterFirst = outbox.filter((m) => m.to === graceEmail).length;
    await call('POST', '/auth/forgot', { email: graceEmail });
    assert.equal(outbox.filter((m) => m.to === graceEmail).length, afterFirst);
    assert.equal(afterFirst, before + 1);
  });

  it('keeps a valid code across an API restart', async () => {
    const email = restartEmail;
    const password = 'Restart#Pass9';
    await call('POST', '/auth/signup', { name: 'Restart User', email, phone: restartPhone, password: OLD, confirmPassword: OLD });
    assert.equal((await call('POST', '/auth/signup/verify', { email, emailCode: lastCode(email) })).status, 201);
    assert.equal((await call('POST', '/auth/forgot', { email })).status, 202);
    const code = lastCode(email);
    const { persistStore } = await import('../data/store');
    const { config } = await import('../config');
    const previousDemoMode = config.demoMode;
    (config as { demoMode: boolean }).demoMode = false;
    await persistStore();
    (config as { demoMode: boolean }).demoMode = previousDemoMode;

    const { createApp } = await import('../app');
    const restarted = http.createServer(await createApp()).listen(0);
    const restartedBase = `http://127.0.0.1:${(restarted.address() as AddressInfo).port}/api`;
    try {
      const reset = await fetch(`${restartedBase}/auth/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, password, confirmPassword: password }),
      });
      assert.equal(reset.status, 200);
      const login = await fetch(`${restartedBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: email, password }),
      });
      assert.equal(login.status, 200);
    } finally {
      await new Promise<void>((resolve) => restarted.close(() => resolve()));
    }
  });
});
