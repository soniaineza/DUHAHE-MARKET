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
    await call('POST', '/auth/signup', { name: 'Grace M', email: 'grace@example.com', phone: '0788999111', password: OLD, confirmPassword: OLD });
    const ok = await call('POST', '/auth/signup/verify', { email: 'grace@example.com', emailCode: lastCode('grace@example.com') });
    assert.equal(ok.status, 201);
    oldToken = ok.body.data.token;
  });
  after(() => server.close());

  it('answers the same for unknown and known emails and only emails real accounts', async () => {
    const before = outbox.length;
    const unknown = await call('POST', '/auth/forgot', { email: 'nobody@example.com' });
    assert.equal(unknown.status, 202);
    assert.equal(outbox.length, before, 'nothing is sent to an unregistered address');
    const known = await call('POST', '/auth/forgot', { email: 'Grace@Example.com' });
    assert.equal(known.status, 202);
    assert.deepEqual(known.body, unknown.body);
    assert.equal(outbox.length, before + 1);
    assert.equal(outbox[outbox.length - 1].to, 'grace@example.com');
    assert.equal((await call('POST', '/auth/forgot', { email: 'not-an-email' })).status, 400);
  });

  it('rejects weak or mismatched new passwords and wrong codes without changing anything', async () => {
    const code = lastCode('grace@example.com');
    assert.equal((await call('POST', '/auth/reset', { email: 'grace@example.com', code, password: 'weakpass', confirmPassword: 'weakpass' })).status, 400);
    assert.equal((await call('POST', '/auth/reset', { email: 'grace@example.com', code, password: NEW, confirmPassword: 'Other#1234pass' })).status, 400);
    assert.equal((await call('POST', '/auth/reset', { email: 'grace@example.com', code: '000000', password: NEW, confirmPassword: NEW })).status, 401);
    assert.equal((await call('POST', '/auth/login', { identifier: 'grace@example.com', password: OLD })).status, 200);
  });

  it('the emailed code sets the new password, signs in, and ends every older session', async () => {
    const code = lastCode('grace@example.com');
    assert.equal((await call('GET', '/cart', undefined, oldToken)).status, 200, 'old session works before the reset');
    const reset = await call('POST', '/auth/reset', { email: 'grace@example.com', code, password: NEW, confirmPassword: NEW });
    assert.equal(reset.status, 200);
    assert.ok(reset.body.data.token);
    assert.equal(reset.body.data.user.passwordHash, undefined);
    // New password works (by email and by phone), old one does not.
    assert.equal((await call('POST', '/auth/login', { identifier: 'grace@example.com', password: NEW })).status, 200);
    assert.equal((await call('POST', '/auth/login', { identifier: '0788999111', password: NEW })).status, 200);
    assert.equal((await call('POST', '/auth/login', { identifier: 'grace@example.com', password: OLD })).status, 401);
    // The session from before the reset is rejected; the new one works.
    assert.equal((await call('GET', '/cart', undefined, oldToken)).status, 401);
    assert.equal((await call('GET', '/auth/me', undefined, oldToken)).status, 401);
    assert.equal((await call('GET', '/cart', undefined, reset.body.data.token)).status, 200);
  });

  it('a code works only once', async () => {
    const code = lastCode('grace@example.com');
    assert.equal((await call('POST', '/auth/reset', { email: 'grace@example.com', code, password: 'Another#Pass77', confirmPassword: 'Another#Pass77' })).status, 410);
  });

  it('5 wrong codes cancel the reset', async () => {
    // New request (the 60s cooldown is bypassed by using a second account).
    await call('POST', '/auth/signup', { name: 'Brute F', email: 'brute2@example.com', phone: '0788999222', password: OLD, confirmPassword: OLD });
    await call('POST', '/auth/signup/verify', { email: 'brute2@example.com', emailCode: lastCode('brute2@example.com') });
    await call('POST', '/auth/forgot', { email: 'brute2@example.com' });
    const right = lastCode('brute2@example.com');
    for (let i = 0; i < 5; i++) {
      assert.equal((await call('POST', '/auth/reset', { email: 'brute2@example.com', code: '111111', password: NEW, confirmPassword: NEW })).status, 401);
    }
    assert.equal((await call('POST', '/auth/reset', { email: 'brute2@example.com', code: right, password: NEW, confirmPassword: NEW })).status, 429);
    assert.equal((await call('POST', '/auth/reset', { email: 'brute2@example.com', code: right, password: NEW, confirmPassword: NEW })).status, 410);
  });

  it('a second request inside a minute sends no second email', async () => {
    const before = outbox.filter((m) => m.to === 'grace@example.com').length;
    await call('POST', '/auth/forgot', { email: 'grace@example.com' });
    const afterFirst = outbox.filter((m) => m.to === 'grace@example.com').length;
    await call('POST', '/auth/forgot', { email: 'grace@example.com' });
    assert.equal(outbox.filter((m) => m.to === 'grace@example.com').length, afterFirst);
    assert.equal(afterFirst, before + 1);
  });
});
