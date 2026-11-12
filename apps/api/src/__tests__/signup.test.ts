/** Sign-up proves ownership of the email (and phone, when SMS is on) before any account exists. */
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { checkPassword, isStrongPassword, canonicalRwandaPhone } from '@duhahe/shared';

let server: http.Server;
let base = '';
let ip = 0;
async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Each request pretends to come from a new IP so the per-IP limiters do not interfere with these tests.
      'X-Forwarded-For': `10.9.${Math.floor(ip / 250)}.${(ip++ % 250) + 1}`,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as { data?: any; error?: string } };
}

const GOOD = 'Str0ng!Pass';
const form = (over: Record<string, unknown> = {}) => ({
  name: 'Jean Bosco',
  email: 'jean@example.com',
  phone: '0788123456',
  password: GOOD,
  confirmPassword: GOOD,
  ...over,
});

describe('password and phone rules (shared)', () => {
  it('needs 8+ chars with upper, lower, number and symbol', () => {
    assert.equal(isStrongPassword('Str0ng!Pass'), true);
    for (const weak of ['Sh0rt!A', 'alllowercase1!', 'ALLUPPERCASE1!', 'NoNumbers!!', 'NoSymbols123', 'Aa1!']) {
      assert.equal(isStrongPassword(weak), false, weak);
    }
    assert.equal(checkPassword('abc').length, false);
  });
  it('normalises Rwandan mobile numbers and rejects others', () => {
    for (const ok of ['0788123456', '788123456', '250788123456', '+250 788 123 456']) {
      assert.equal(canonicalRwandaPhone(ok), '250788123456');
    }
    for (const bad of ['0123456789', '12345', '0688123456', '+254712345678', '']) {
      assert.equal(canonicalRwandaPhone(bad), null, bad);
    }
  });
});

describe('verified sign-up', () => {
  let outbox: { channel: string; to: string; text: string }[];
  before(async () => {
    const { createApp } = await import('../app');
    server = http.createServer(await createApp()).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
    outbox = (await import('../services/notify')).testOutbox;
  });
  const lastCode = (to: string) => /(\d{6})/.exec([...outbox].reverse().find((m) => m.to === to)!.text)![1];

  it('rejects weak passwords, mismatched confirmation, bad emails and bad phones', async () => {
    assert.equal((await call('POST', '/auth/signup', form({ password: 'weakpass', confirmPassword: 'weakpass' }))).status, 400);
    assert.equal((await call('POST', '/auth/signup', form({ confirmPassword: 'Different1!' }))).status, 400);
    assert.equal((await call('POST', '/auth/signup', form({ email: 'not-an-email' }))).status, 400);
    assert.equal((await call('POST', '/auth/signup', form({ phone: '12345' }))).status, 400);
    assert.equal(outbox.length, 0, 'nothing is sent for invalid input');
  });

  it('creates no account until the emailed code is entered', async () => {
    const r = await call('POST', '/auth/signup', form());
    assert.equal(r.status, 202);
    assert.equal(r.body.data.phoneVerificationRequired, false);
    // Not signed up yet: login fails.
    assert.equal((await call('POST', '/auth/login', { identifier: 'jean@example.com', password: GOOD })).status, 401);
    // Wrong code.
    assert.equal((await call('POST', '/auth/signup/verify', { email: 'jean@example.com', emailCode: '000000' })).status, 401);
    // Right code creates the account and signs in.
    const ok = await call('POST', '/auth/signup/verify', { email: 'jean@example.com', emailCode: lastCode('jean@example.com') });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.user.phone, '250788123456');
    assert.equal(ok.body.data.user.email, 'jean@example.com');
    assert.equal(ok.body.data.user.passwordHash, undefined);
  });

  it('can then sign in with the email OR the phone number, in any format', async () => {
    assert.equal((await call('POST', '/auth/login', { identifier: 'JEAN@example.com', password: GOOD })).status, 200);
    assert.equal((await call('POST', '/auth/login', { identifier: '0788123456', password: GOOD })).status, 200);
    assert.equal((await call('POST', '/auth/login', { identifier: '+250 788 123 456', password: GOOD })).status, 200);
    assert.equal((await call('POST', '/auth/login', { identifier: 'jean@example.com', password: 'Wrong1!pass' })).status, 401);
    assert.equal((await call('POST', '/auth/login', { identifier: 'nobody@example.com', password: GOOD })).status, 401);
  });

  it('refuses a second account with the same email or phone', async () => {
    assert.equal((await call('POST', '/auth/signup', form())).status, 409);
    assert.equal((await call('POST', '/auth/signup', form({ email: 'other@example.com' }))).status, 409);
    assert.equal((await call('POST', '/auth/signup', form({ phone: '0799000111' }))).status, 409);
  });

  it('a wrong email never becomes an account: the code goes only to that inbox', async () => {
    await call('POST', '/auth/signup', form({ email: 'typo@exmaple.com', phone: '0722000333' }));
    const sentTo = outbox.filter((m) => m.channel === 'email').map((m) => m.to);
    assert.ok(sentTo.includes('typo@exmaple.com'));
    assert.equal((await call('POST', '/auth/signup/verify', { email: 'typo@exmaple.com', emailCode: '123456' })).status, 401);
  });

  it('locks a pending sign-up after 5 wrong codes', async () => {
    await call('POST', '/auth/signup', form({ email: 'brute@example.com', phone: '0733000444' }));
    for (let i = 0; i < 5; i++) {
      assert.equal((await call('POST', '/auth/signup/verify', { email: 'brute@example.com', emailCode: '111111' })).status, 401);
    }
    const right = lastCode('brute@example.com');
    assert.equal((await call('POST', '/auth/signup/verify', { email: 'brute@example.com', emailCode: right })).status, 429);
    assert.equal((await call('POST', '/auth/signup/verify', { email: 'brute@example.com', emailCode: right })).status, 410);
  });

  it('an unknown sign-up cannot be verified', async () => {
    assert.equal((await call('POST', '/auth/signup/verify', { email: 'ghost@example.com', emailCode: '123456' })).status, 410);
  });

  it('resend is rate-limited per sign-up', async () => {
    await call('POST', '/auth/signup', form({ email: 'again@example.com', phone: '0788555666' }));
    assert.equal((await call('POST', '/auth/signup/resend', { email: 'again@example.com' })).status, 429);
  });
});

describe('phone verification when an SMS provider is configured', () => {
  it('also needs the SMS code', async () => {
    process.env.TEST_SMS = '1';
    const outbox = (await import('../services/notify')).testOutbox;
    const codeTo = (to: string, channel: string) =>
      /(\d{6})/.exec([...outbox].reverse().find((m) => m.channel === channel && m.to === to)!.text)![1];
    try {
      const r = await call('POST', '/auth/signup', form({ email: 'sms@example.com', phone: '0788777888' }));
      assert.equal(r.status, 202);
      assert.equal(r.body.data.phoneVerificationRequired, true);
      const email = codeTo('sms@example.com', 'email');
      const sms = codeTo('250788777888', 'sms');
      // The phone code is missing, so the sign-up is refused.
      assert.equal((await call('POST', '/auth/signup/verify', { email: 'sms@example.com', emailCode: email })).status, 401);
      const ok = await call('POST', '/auth/signup/verify', { email: 'sms@example.com', emailCode: email, phoneCode: sms });
      assert.equal(ok.status, 201);
      assert.equal(ok.body.data.user.phoneVerified, true);
    } finally {
      delete process.env.TEST_SMS;
    }
  });
});

// Close the server once every describe block above has finished.
after(() => server.close());
