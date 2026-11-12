/**
 * Email over HTTPS (Brevo API): the sign-up route calls the provider's HTTP endpoint with the API key, the
 * verified sender and the typed recipient, and the code in that message completes the sign-up. A provider
 * error (e.g. unverified sender) refuses the sign-up and creates nothing.
 */
process.env.DEMO_MODE = 'true';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';

interface Captured {
  headers: http.IncomingHttpHeaders;
  body: any;
}

describe('verification emails over the Brevo HTTPS API', () => {
  let brevo: http.Server;
  let api: http.Server;
  let base = '';
  const calls: Captured[] = [];
  let brevoStatus = 201;
  const realEnv = process.env.NODE_ENV;

  before(async () => {
    brevo = http
      .createServer((req, res) => {
        let raw = '';
        req.on('data', (c) => (raw += c));
        req.on('end', () => {
          calls.push({ headers: req.headers, body: JSON.parse(raw || '{}') });
          res.statusCode = brevoStatus;
          res.setHeader('content-type', 'application/json');
          res.end(brevoStatus === 201 ? '{"messageId":"<abc@brevo>"}' : '{"code":"unauthorized","message":"Sender is not valid"}');
        });
      })
      .listen(0);
    process.env.NODE_ENV = 'development'; // the real delivery path must run (not the test outbox)
    const { config } = await import('../config');
    Object.assign(config.notify.brevo, {
      apiKey: 'xkeysib-test-key',
      from: 'shop@duhahe.test',
      fromName: 'Duhahe Rwanda Market',
      baseUrl: `http://127.0.0.1:${(brevo.address() as AddressInfo).port}`,
    });
    const { createApp } = await import('../app');
    api = http.createServer(await createApp()).listen(0);
    base = `http://127.0.0.1:${(api.address() as AddressInfo).port}/api`;
  });

  after(() => {
    process.env.NODE_ENV = realEnv;
    api.close();
    brevo.close();
  });

  const GOOD = 'Str0ng!Pass';
  const signup = (email: string, phone: string) =>
    fetch(`${base}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Aline U', email, phone, password: GOOD, confirmPassword: GOOD }),
    });

  it('sends the code to the typed address through the API and completes the sign-up', async () => {
    const res = await signup('Aline.U@Example.com', '0788333444');
    assert.equal(res.status, 202);
    assert.equal(calls.length, 1);
    const { headers, body } = calls[0];
    assert.equal(headers['api-key'], 'xkeysib-test-key');
    assert.deepEqual(body.sender, { email: 'shop@duhahe.test', name: 'Duhahe Rwanda Market' });
    assert.deepEqual(body.to, [{ email: 'aline.u@example.com' }]);
    const code = /verification code is (\d{6})/.exec(body.textContent)?.[1];
    assert.ok(code);

    const verify = await fetch(`${base}/auth/signup/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'aline.u@example.com', emailCode: code }),
    });
    assert.equal(verify.status, 201);
  });

  it('a provider error refuses the sign-up and keeps nothing', async () => {
    brevoStatus = 401;
    const res = await signup('rejected@example.com', '0788333555');
    assert.equal(res.status, 502);
    const v = await fetch(`${base}/auth/signup/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rejected@example.com', emailCode: '123456' }),
    });
    assert.equal(v.status, 410);
  });
});

describe('Brevo API key paste formats', () => {
  it('accepts both the plain key and the base64-wrapped key', async () => {
    const { unwrapApiKey } = await import('../config');
    const plain = 'xkeysib-abc123-XyZ';
    const wrapped = Buffer.from(JSON.stringify({ api_key: plain })).toString('base64');
    assert.equal(unwrapApiKey(plain), plain);
    assert.equal(unwrapApiKey(wrapped), plain);
    assert.equal(unwrapApiKey(`  ${wrapped}  `), plain);
    assert.equal(unwrapApiKey(''), '');
    assert.equal(unwrapApiKey('eyJnotbase64json'), 'eyJnotbase64json');
  });
});
