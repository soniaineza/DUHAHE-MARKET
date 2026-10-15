/**
 * Smoke test for the Duhahe API (run against a DEMO_MODE instance on :4123).
 * Covers: payment amount enforcement, webhook amount verification, auth,
 * error handling, CORS, headers, admin backup export.
 * Exits non-zero if any check fails.
 */
import crypto from 'node:crypto';

const BASE = process.env.SMOKE_BASE ?? 'http://127.0.0.1:4123/api';
const WEBHOOK_SECRET = process.env.SMOKE_WEBHOOK_SECRET ?? 'smoke-webhook-secret';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL ?? 'admin@duhahe.rw';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD ?? 'SmokeTest-Pass-12345';

let failures = 0;
let passes = 0;

function check(name, cond, detail = '') {
  if (cond) {
    passes += 1;
    console.log(`PASS  ${name}`);
  } else {
    failures += 1;
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function req(path, { method = 'GET', body, headers = {}, rawBody } = {}) {
  const init = { method, headers: { ...headers } };
  if (rawBody !== undefined) {
    init.body = rawBody;
    init.headers['Content-Type'] = init.headers['Content-Type'] ?? 'application/json';
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, init);
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

const h = (sig) => ({ 'x-paypack-signature': sig });
const sign = (payload) => crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('base64');

async function main() {
  // ---- 1. health + baseline headers
  const health = await req('/health');
  check('health returns 200', health.status === 200, `got ${health.status}`);
  check('nosniff header set', health.headers.get('x-content-type-options') === 'nosniff');
  check('X-Powered-By hidden', !health.headers.get('x-powered-by'));

  // ---- 2. create an order
  const products = (await req('/products')).body.data;
  const prod = products.find((p) => p.stockQty >= p.minOrderQty && p.minOrderQty > 0);
  check('catalog loaded', Array.isArray(products) && products.length > 0);
  const qty = prod.minOrderQty;
  const created = await req('/orders', {
    method: 'POST',
    body: {
      items: [{ productId: prod.id, qty }],
      customer: { name: 'Smoke Tester', phone: '0788111222', district: 'Gasabo' },
      paymentMethod: 'mtn_momo',
    },
  });
  check('order created (201)', created.status === 201, JSON.stringify(created.body));
  const order = created.body?.data;
  check('order.total computed by server', Number.isFinite(order?.total) && order.total > 0);
  const orderId = order.id;

  const recent = async () => (await req('/orders/0788111222/recent')).body.data.find((o) => o.id === orderId);
  check('new order starts unpaid', (await recent()).paymentStatus === 'unpaid');

  // ---- 3. wrong amount must be rejected
  const wrong = await req('/payments/stub', {
    method: 'POST',
    body: { method: 'mtn_momo', orderId, phone: '0788111222', amount: order.total + 1 },
  });
  check('underpaying is rejected', wrong.body?.data?.success === false, JSON.stringify(wrong.body));
  check('rejection explains the amount rule', /must equal the order total/.test(wrong.body?.data?.message?.en ?? ''), wrong.body?.data?.message?.en);
  check('underpay attempt leaves order unpaid', (await recent()).paymentStatus === 'unpaid');

  const zero = await req('/payments/stub', {
    method: 'POST',
    body: { method: 'mtn_momo', orderId, phone: '0788111222', amount: 1 },
  });
  check('paying 1 RWF is rejected', zero.body?.data?.success === false);

  // ---- 4. wrong phone must be rejected
  const wrongPhone = await req('/payments/stub', {
    method: 'POST',
    body: { method: 'mtn_momo', orderId, phone: '0788999888', amount: order.total },
  });
  check('mismatched phone is rejected', wrongPhone.body?.data?.success === false);
  check('phone rejection leaves order unpaid', (await recent()).paymentStatus === 'unpaid');

  // ---- 5. correct amount pays the order
  const paid = await req('/payments/stub', {
    method: 'POST',
    body: { method: 'mtn_momo', orderId, phone: '0788111222', amount: order.total },
  });
  check('exact amount is accepted', paid.body?.data?.success === true, JSON.stringify(paid.body));
  const afterPay = await recent();
  check('order marked paid', afterPay.paymentStatus === 'paid', afterPay.paymentStatus);
  const ref = afterPay.providerReference;
  check('provider reference recorded', typeof ref === 'string' && ref.length > 0);

  // ---- 6. paying again must not double-charge
  const again = await req('/payments/stub', {
    method: 'POST',
    body: { method: 'mtn_momo', orderId, phone: '0788111222', amount: order.total },
  });
  check('double pay returns already-paid', again.body?.data?.success === true && /already been paid/.test(again.body?.data?.message?.en ?? ''), again.body?.data?.message?.en);
  check('double pay keeps same reference', again.body?.data?.providerRequestId === ref);

  // ---- 7. webhook: bad signature rejected
  const eventPayload = JSON.stringify({ data: { kind: 'CASHIN', ref, status: 'successful', amount: afterPay.total } });
  const noSig = await req('/webhooks/paypack', { method: 'POST', rawBody: eventPayload });
  check('webhook without signature → 401', noSig.status === 401, `got ${noSig.status}`);
  const badSig = await req('/webhooks/paypack', { method: 'POST', rawBody: eventPayload, headers: h('bm90LXRoZS1yaWdodC1zaWduYXR1cmU=' ) });
  check('webhook with wrong signature → 401', badSig.status === 401, `got ${badSig.status}`);

  // ---- 8. webhook: amount mismatch must NOT mark paid
  const adminLogin = await req('/admin/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  check('admin login works', adminLogin.status === 200 && !!adminLogin.body?.data?.token, JSON.stringify(adminLogin.body));
  const token = adminLogin.body?.data?.token;
  const auth = { Authorization: `Bearer ${token}` };

  // Put the paid order back to unpaid (keeps providerReference) to simulate an unsettled cashin.
  const unpay = await req(`/admin/orders/${orderId}/payment`, { method: 'PATCH', body: { paymentStatus: 'unpaid' }, headers: auth });
  check('admin can reset payment status', unpay.status === 200);

  const wrongAmountEvent = JSON.stringify({ data: { kind: 'CASHIN', ref, status: 'successful', amount: afterPay.total - 500 } });
  const mismatch = await req('/webhooks/paypack', { method: 'POST', rawBody: wrongAmountEvent, headers: h(sign(wrongAmountEvent)) });
  check('webhook flags amount mismatch', mismatch.body?.amountMismatch === true, JSON.stringify(mismatch.body));
  check('mismatch does NOT mark paid', (await recent()).paymentStatus === 'unpaid');

  const goodAmountEvent = JSON.stringify({ data: { kind: 'CASHIN', ref, status: 'successful', amount: afterPay.total } });
  const good = await req('/webhooks/paypack', { method: 'POST', rawBody: goodAmountEvent, headers: h(sign(goodAmountEvent)) });
  check('webhook accepts matching amount', good.body?.received === true && good.body?.matched === true, JSON.stringify(good.body));
  check('matching webhook marks paid', (await recent()).paymentStatus === 'paid');

  const dup = await req('/webhooks/paypack', { method: 'POST', rawBody: goodAmountEvent, headers: h(sign(goodAmountEvent)) });
  check('webhook delivery is idempotent', dup.body?.duplicate === true, JSON.stringify(dup.body));

  // ---- 9. body limits and JSON errors
  const badJson = await req('/orders/calculate', { method: 'POST', rawBody: '{"items": [oops' });
  check('malformed JSON → 400', badJson.status === 400, `got ${badJson.status}`);
  const big = await req('/orders', { method: 'POST', rawBody: `{"items":[],"note":"${'x'.repeat(150000)}"}` });
  check('oversized body → 413', big.status === 413, `got ${big.status}`);

  // ---- 10. CORS
  const evil = await fetch(`${BASE}/products`, { headers: { Origin: 'https://evil.example' } });
  check('unknown origin blocked by CORS', !evil.headers.get('access-control-allow-origin'));
  const local = await fetch(`${BASE}/products`, { headers: { Origin: 'http://localhost:5173' } });
  check('configured origin allowed by CORS', local.headers.get('access-control-allow-origin') === 'http://localhost:5173');

  // ---- 11. auth hardening
  const badLogin = await req('/admin/auth/login', { method: 'POST', body: { email: ADMIN_EMAIL, password: 'wrong-password' } });
  check('wrong admin password → 401', badLogin.status === 401, `got ${badLogin.status}`);

  // ---- 12. admin backup export
  const exp = await req('/admin/export', { headers: auth });
  check('admin export works with JWT', exp.status === 200 && exp.body?.data?.counts?.products > 0, `got ${exp.status}`);
  const expNoAuth = await req('/admin/export');
  check('admin export requires auth', expNoAuth.status === 401, `got ${expNoAuth.status}`);

  // ---- 13. webhook HEAD reachability ping
  const head = await fetch(`${BASE}/webhooks/paypack`, { method: 'HEAD' });
  check('webhook HEAD ping → 200', head.status === 200, `got ${head.status}`);

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err);
  process.exit(1);
});
