/**
 * Payment regression tests.
 *
 * The code under test is the real payment service, attempt ledger, Paypack client and webhook router.
 * Only the HTTP boundary to Paypack is replaced by a scriptable fake that mirrors what the real API
 * was observed to do: `transaction:created` (pending) then `transaction:processed` (successful | failed)
 * events, a cancelled prompt failing within seconds, a dismissed prompt staying pending, `find/{ref}`
 * often answering 404, and a brand-new reference for every cash-in (honouring Idempotency-Key). No
 * network access and no real credentials are used; nothing here can charge a phone.
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import type { Order } from '@duhahe/shared';
import { decidePhase, UNRESOLVED_AFTER_MS } from '@duhahe/shared';

// Must be set before the app modules read their config. dotenv never overrides existing variables,
// so a developer's real .env cannot leak into these tests.
process.env.PAYPACK_ENABLED = 'true';
process.env.PAYPACK_CLIENT_ID = 'test-client';
process.env.PAYPACK_CLIENT_SECRET = 'test-secret';
process.env.PAYPACK_WEBHOOK_SIGN_KEY = 'test-webhook-key';
process.env.PAYPACK_BASE_URL = 'https://paypack.test/api';
process.env.DEMO_MODE = 'true';
process.env.PAYMENT_RECHECK_FAILED_MS = '0'; // re-check older failed attempts on every call in tests

const { orders, notifications, updateOrderPaymentStatus } = await import('../data/store');
const { initiatePayment, syncOrderPayment, EARLY_RETRY_MIN_AGE_MS } = await import('../services/paymentService');
const { paypackWebhookRouter } = await import('../routes/paypack');

// ---------------------------------------------------------------------------------------- fake Paypack
type Ev = { event_kind: string; created_at: string; data: Record<string, unknown> };
interface Tx { ref: string; amount: number; events: Ev[]; findMode: 'status' | '404'; findStatus?: string }

const fake = {
  txs: new Map<string, Tx>(),
  idem: new Map<string, string>(),
  cashinCalls: [] as { amount: number; number: string; idem?: string }[],
  seq: 0,
  down: false, // simulate network failure to the provider
  /** Scripted failure of the NEXT cash-in call. */
  failNextCashin: null as null | 'lost-response' | 'http422',
  reset() {
    this.txs.clear();
    this.idem.clear();
    this.cashinCalls = [];
    this.down = false;
    this.failNextCashin = null;
  },
  /** Provider-side outcome for one reference. */
  settle(ref: string, status: 'successful' | 'failed' | 'rejected', amount?: number) {
    const tx = this.txs.get(ref)!;
    tx.events.unshift({
      event_kind: 'transaction:processed',
      created_at: new Date().toISOString(),
      data: { ref, kind: 'CASHIN', status, amount: amount ?? tx.amount, client: '0788000000' },
    });
  },
};

const realFetch = globalThis.fetch;
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  if (url.hostname !== 'paypack.test') return realFetch(input as RequestInfo, init); // local test server
  if (fake.down) throw new TypeError('fetch failed');
  const headers = new Headers(init?.headers);
  const path = url.pathname.replace('/api', '');

  if (path === '/auth/agents/authorize') return json({ access: 'tok', refresh: 'ref', expires: 900 });

  if (path === '/transactions/cashin' && init?.method === 'POST') {
    const body = JSON.parse(String(init.body));
    const idem = headers.get('idempotency-key') ?? undefined;
    fake.cashinCalls.push({ amount: body.amount, number: body.number, idem });
    const scripted = fake.failNextCashin;
    fake.failNextCashin = null;
    if (scripted === 'http422') return json({ message: 'invalid number' }, 422);
    let ref: string;
    if (idem && fake.idem.has(idem)) {
      ref = fake.idem.get(idem)!; // documented: same Idempotency-Key -> original transaction, no new charge
    } else {
      ref = `ref-${++fake.seq}`;
      if (idem) fake.idem.set(idem, ref);
      fake.txs.set(ref, {
        ref,
        amount: body.amount,
        findMode: '404',
        events: [{ event_kind: 'transaction:created', created_at: new Date().toISOString(), data: { ref, kind: 'CASHIN', status: 'pending', amount: body.amount } }],
      });
    }
    if (scripted === 'lost-response') throw new TypeError('fetch failed'); // created at provider, answer never arrived
    return json({ ref, kind: 'CASHIN', status: 'pending', amount: body.amount });
  }

  const find = path.match(/^\/transactions\/find\/(.+)$/);
  if (find) {
    const tx = fake.txs.get(decodeURIComponent(find[1]));
    if (!tx || tx.findMode === '404') return json({ message: 'transaction not found' }, 404);
    return json({ ref: tx.ref, kind: 'CASHIN', amount: tx.amount, status: tx.findStatus });
  }

  if (path === '/events/transactions') {
    const tx = fake.txs.get(url.searchParams.get('ref') ?? '');
    return json({ limit: 20, total: tx?.events.length ?? 0, transactions: tx?.events ?? [] });
  }
  return json({ message: 'not found' }, 404);
}) as typeof fetch;

// ------------------------------------------------------------------------------------------- helpers
let n = 0;
function makeOrder(total = 5000, phone = '0788000000'): Order {
  const order: Order = {
    id: `ord-test-${++n}`,
    orderNumber: `DH-T${n}`,
    customer: { name: 'Test Customer', phone, district: 'Gasabo' } as Order['customer'],
    items: [],
    subtotal: total - 1000,
    deliveryFee: 1000,
    discount: 0,
    total,
    status: 'pending',
    paymentMethod: 'mtn_momo',
    paymentStatus: 'unpaid',
    createdAt: new Date().toISOString(),
  };
  orders.push(order);
  return order;
}
const pay = (o: Order) => initiatePayment({ method: 'mtn_momo', orderId: o.id, phone: o.customer.phone, amount: o.total });
const paidNotifications = (o: Order) => notifications.filter((x) => x.body.includes(o.orderNumber) && x.title === 'Payment received').length;
const att = (o: Order) => o.paymentAttempts ?? [];
const statuses = (o: Order) => att(o).map((a) => a.status);

// Webhook server -----------------------------------------------------------------------------------
let server: http.Server;
let base = '';
before(async () => {
  const app = express();
  app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '1mb' }));
  app.use('/api/webhooks', paypackWebhookRouter);
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => new Promise<void>((r) => server.close(() => r())));
beforeEach(() => fake.reset());

async function webhook(ref: string, status: string, amount: number, opts: { badSignature?: boolean } = {}) {
  const body = JSON.stringify({ event_id: crypto.randomUUID(), kind: 'transaction:processed', data: { ref, kind: 'CASHIN', status, amount } });
  const sig = crypto.createHmac('sha256', 'test-webhook-key').update(body).digest('base64');
  const res = await fetch(`${base}/api/webhooks/paypack`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-paypack-signature': opts.badSignature ? 'nope' : sig },
    body,
  });
  return { status: res.status, body: (await res.json()) as Record<string, any> };
}

// =====================================================================================================
describe('REGRESSION: cancel one payment, try again - the new attempt must be isolated from the old one', () => {
  it('exact sequence: A1 cancelled -> A2 retry -> delayed A1 events -> A2 succeeds -> replays -> paid exactly once', async () => {
    // 1. order A
    const o = makeOrder(5000);

    // 2. payment attempt A1
    const r1 = await pay(o);
    assert.equal(r1.success, true);
    const A1 = att(o)[0];
    assert.ok(A1.id && A1.ref && A1.idempotencyKey);
    assert.equal(r1.attemptId, A1.id);
    assert.equal(fake.cashinCalls[0].idem, A1.idempotencyKey);

    // 3. A1 is cancelled on the phone (Paypack reports failed)
    fake.settle(A1.ref!, 'failed');
    const afterCancel = await syncOrderPayment(o.id, A1.id);
    assert.equal(afterCancel?.status, 'failed');
    assert.equal(o.paymentStatus, 'failed');
    assert.equal(A1.status, 'failed');

    // 4. retry -> attempt A2
    const r2 = await pay(o);
    assert.equal(r2.success, true);
    const A2 = att(o)[1];

    // 5. A2 is a distinct attempt: own id, own provider reference, own idempotency key
    assert.equal(att(o).length, 2);
    assert.notEqual(A2.id, A1.id);
    assert.notEqual(A2.ref, A1.ref);
    assert.notEqual(A2.idempotencyKey, A1.idempotencyKey);
    assert.equal(r2.attemptId, A2.id);
    assert.equal(r2.providerRequestId, A2.ref);

    // 6. the provider received a genuinely NEW request (new key, new transaction), not a replay of A1
    assert.equal(fake.cashinCalls.length, 2);
    assert.equal(fake.cashinCalls[1].idem, A2.idempotencyKey);
    assert.notEqual(fake.cashinCalls[1].idem, fake.cashinCalls[0].idem);
    assert.equal(fake.txs.size, 2);

    console.log('      A1 id=%s ref=%s key=%s…  ->  failed', A1.id, A1.ref, A1.idempotencyKey.slice(0, 8));
    console.log('      A2 id=%s ref=%s key=%s…  ->  new provider transaction', A2.id, A2.ref, A2.idempotencyKey.slice(0, 8));

    // 7. a delayed cancellation for A1 arrives (twice, as webhooks are retried)
    for (let i = 0; i < 2; i++) {
      const late = await webhook(A1.ref!, 'failed', 5000);
      assert.equal(late.body.attemptId, A1.id);
      assert.equal(late.body.effect, 'noop');
    }

    // 8. A2 is still pending: not failed, not paid, and polling A2 does not show A1's result
    assert.equal(A2.status, 'pending');
    assert.equal(o.paymentStatus, 'unpaid');
    const pollA2 = await syncOrderPayment(o.id, A2.id);
    assert.equal(pollA2?.attemptId, A2.id);
    assert.equal(pollA2?.status, 'unpaid');
    assert.equal(pollA2?.providerStatus, 'pending');
    assert.equal(decidePhase(pollA2!, 5_000).phase, 'waiting');
    // ...and a poll pinned to A1 still reports A1's own outcome, never A2's
    assert.equal((await syncOrderPayment(o.id, A1.id))?.status, 'failed');

    // 9. A2 succeeds
    fake.settle(A2.ref!, 'successful');
    const success = await webhook(A2.ref!, 'successful', 5000);
    assert.equal(success.body.effect, 'paid');
    assert.equal(success.body.attemptId, A2.id);

    // 10. order A is paid exactly once
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.providerReference, A2.ref);
    assert.deepEqual(statuses(o), ['failed', 'paid']);
    assert.equal(paidNotifications(o), 1);

    // 11-12. replay every event (A1 failed, A2 success, polls): nothing changes, nothing is fulfilled or charged again
    assert.equal((await webhook(A1.ref!, 'failed', 5000)).body.effect, 'noop');
    assert.equal((await webhook(A2.ref!, 'successful', 5000)).body.effect, 'noop');
    assert.equal((await webhook(A2.ref!, 'successful', 5000)).body.effect, 'noop');
    assert.equal((await syncOrderPayment(o.id, A2.id))?.status, 'paid');
    assert.equal(o.paymentStatus, 'paid');
    assert.deepEqual(statuses(o), ['failed', 'paid']);
    assert.equal(paidNotifications(o), 1);
    assert.equal((o.paymentIssues ?? []).length, 0);
    assert.equal(fake.cashinCalls.length, 2, 'no additional charge was ever requested');
    assert.equal((await pay(o)).status, 'paid');
    assert.equal(fake.cashinCalls.length, 2);
  });

  it('a delayed SUCCESS for A1 after A2 has started: order settles once, A2 becomes a flagged duplicate', async () => {
    const o = makeOrder(5000);
    await pay(o);
    const A1 = att(o)[0];
    fake.settle(A1.ref!, 'failed'); // provider says A1 failed...
    await syncOrderPayment(o.id, A1.id);
    await pay(o); // ...customer retries
    const A2 = att(o)[1];
    assert.equal(A2.status, 'pending');

    // ...but A1 then turns out to have succeeded (late success)
    const late = await webhook(A1.ref!, 'successful', 5000);
    assert.equal(late.body.effect, 'paid');
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.providerReference, A1.ref, 'the attempt that actually paid is on record');
    assert.equal(A1.status, 'paid');
    assert.equal(A2.status, 'pending', 'A2 is untouched by an event about A1');
    assert.equal(paidNotifications(o), 1);

    // the page still watching A2 is told the order is paid (it is) - and is not left hanging
    assert.equal((await syncOrderPayment(o.id, A2.id))?.status, 'paid');

    // A2 is later approved on the phone too: that money is a SECOND charge. It must be flagged, never fulfilled again.
    const second = await webhook(A2.ref!, 'successful', 5000);
    assert.equal(second.body.effect, 'duplicate_charge');
    assert.equal(A2.status, 'duplicate');
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(paidNotifications(o), 1, 'no second fulfilment / notification');
    assert.equal((o.paymentIssues ?? []).length, 1);
    assert.equal(o.paymentIssues![0].kind, 'duplicate_charge');
    assert.equal(o.paymentIssues![0].attemptId, A2.id);
    // replays do not pile up more issues
    await webhook(A2.ref!, 'successful', 5000);
    assert.equal((o.paymentIssues ?? []).length, 1);
  });

  it('the status poll also discovers the duplicate when no webhook ever arrives', async () => {
    const o = makeOrder(5000);
    await pay(o);
    const A1 = att(o)[0];
    fake.settle(A1.ref!, 'failed');
    await syncOrderPayment(o.id, A1.id);
    await pay(o);
    const A2 = att(o)[1];
    fake.settle(A1.ref!, 'successful'); // late success on A1
    fake.settle(A2.ref!, 'successful'); // and A2 approved as well
    await syncOrderPayment(o.id, A2.id);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(paidNotifications(o), 1);
    assert.deepEqual(statuses(o).sort(), ['duplicate', 'paid']);
    assert.equal((o.paymentIssues ?? []).length, 1);
  });
});

describe('transaction identity: an event only ever affects the attempt that owns its reference', () => {
  it('two different orders with the SAME phone and amount never share results', async () => {
    const a = makeOrder(5000, '0788000000');
    const b = makeOrder(5000, '0788000000');
    await pay(a);
    await pay(b);
    assert.notEqual(att(a)[0].ref, att(b)[0].ref);
    fake.settle(att(a)[0].ref!, 'successful');
    await webhook(att(a)[0].ref!, 'successful', 5000);
    assert.equal(a.paymentStatus, 'paid');
    assert.equal(b.paymentStatus, 'unpaid', 'order B must not be settled by order A\'s payment');
    assert.equal(att(b)[0].status, 'pending');
  });

  it('an unknown reference matches nothing', async () => {
    const o = makeOrder();
    await pay(o);
    const res = await webhook('ref-does-not-exist', 'successful', 5000);
    assert.equal(res.body.matched, false);
    assert.equal(o.paymentStatus, 'unpaid');
  });

  it('a failed event for an OLD attempt never marks the order failed while a newer attempt is live', async () => {
    const o = makeOrder();
    await pay(o);
    const A1 = att(o)[0];
    // provider reports A1 failed only AFTER we already started A2? (reorder) -> simulate by retrying then replaying
    fake.settle(A1.ref!, 'failed');
    await syncOrderPayment(o.id, A1.id);
    await pay(o);
    assert.equal(o.paymentStatus, 'unpaid');
    await webhook(A1.ref!, 'failed', 5000);
    assert.equal(o.paymentStatus, 'unpaid');
    assert.equal(att(o)[1].status, 'pending');
  });

  it('a stale or duplicate "failed" can never walk a paid order back', async () => {
    const o = makeOrder();
    await pay(o);
    const ref = att(o)[0].ref!;
    await webhook(ref, 'successful', 5000);
    await webhook(ref, 'failed', 5000);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(att(o)[0].status, 'paid');
  });

  it('forged webhooks are rejected and wrong amounts never settle the order', async () => {
    const o = makeOrder();
    await pay(o);
    const ref = att(o)[0].ref!;
    assert.equal((await webhook(ref, 'successful', 5000, { badSignature: true })).status, 401);
    assert.equal(o.paymentStatus, 'unpaid');
    const wrong = await webhook(ref, 'successful', 10);
    assert.equal(wrong.body.effect, 'amount_mismatch');
    assert.equal(o.paymentStatus, 'unpaid');
    assert.equal(att(o)[0].status, 'mismatch');
    assert.equal(o.paymentIssues?.[0].kind, 'amount_mismatch');
  });

  it('an admin marking the order paid by hand turns a later MoMo success into a flagged duplicate', async () => {
    const o = makeOrder();
    await pay(o);
    updateOrderPaymentStatus(o.id, 'paid');
    const res = await webhook(att(o)[0].ref!, 'successful', 5000);
    assert.equal(res.body.effect, 'duplicate_charge');
    assert.equal(paidNotifications(o), 0);
  });
});

describe('the transaction-reuse mechanisms: when may a request be re-sent, and when must it NOT be', () => {
  it('while A1 is still pending (e.g. prompt dismissed, not cancelled) a retry is refused - no second prompt', async () => {
    const o = makeOrder();
    await pay(o);
    const A1 = att(o)[0];
    const again = await pay(o);
    assert.equal(again.success, true);
    assert.equal(again.attemptId, A1.id, 'the retry resumes A1, it does not start A2');
    assert.equal(att(o).length, 1);
    assert.equal(fake.cashinCalls.length, 1, 'a second prompt must not be sent while the first may still be approved');
  });

  it('when A1 cannot be verified (provider unreachable) a retry is refused instead of risking a second charge', async () => {
    const o = makeOrder();
    await pay(o);
    fake.down = true;
    const r = await pay(o);
    assert.equal(r.success, false);
    assert.equal(att(o).length, 1);
    assert.equal(fake.cashinCalls.length, 1);
  });

  it('a request whose answer was LOST is re-sent as the SAME attempt with the SAME key, creating exactly one transaction', async () => {
    const o = makeOrder();
    fake.failNextCashin = 'lost-response';
    const first = await pay(o);
    assert.equal(first.success, false);
    assert.equal(att(o).length, 1);
    assert.equal(att(o)[0].status, 'initiated');
    assert.equal(fake.txs.size, 1, 'the provider did create it');

    const retry = await pay(o);
    assert.equal(retry.success, true);
    assert.equal(att(o).length, 1, 'no new attempt: the unsent one was re-sent');
    assert.equal(fake.cashinCalls.length, 2);
    assert.equal(fake.cashinCalls[0].idem, fake.cashinCalls[1].idem);
    assert.equal(fake.txs.size, 1, 'still exactly one provider transaction -> exactly one possible charge');
    assert.equal(att(o)[0].ref, 'ref-' + fake.seq);
    assert.equal(att(o)[0].status, 'pending');
  });

  it('a request the provider REFUSED (HTTP 4xx) is a failed attempt; the retry is a brand-new attempt with a new key', async () => {
    const o = makeOrder();
    fake.failNextCashin = 'http422';
    const first = await pay(o);
    assert.equal(first.success, false);
    assert.equal(att(o)[0].status, 'failed');
    assert.equal(fake.txs.size, 0);
    const retry = await pay(o);
    assert.equal(retry.success, true);
    assert.equal(att(o).length, 2);
    assert.notEqual(att(o)[0].idempotencyKey, att(o)[1].idempotencyKey);
    assert.equal(fake.txs.size, 1);
  });

  it('after a CONFIRMED failure: new reference + new Idempotency-Key on the SAME order (no duplicate order)', async () => {
    const o = makeOrder();
    const before = orders.length;
    await pay(o);
    fake.settle(att(o)[0].ref!, 'failed');
    await syncOrderPayment(o.id);
    await pay(o);
    assert.equal(att(o).length, 2);
    assert.equal(orders.length, before);
    assert.equal(o.paymentStatus, 'unpaid');
  });

  it('double-clicking Try again sends exactly one new request', async () => {
    const o = makeOrder();
    await pay(o);
    fake.settle(att(o)[0].ref!, 'failed');
    await syncOrderPayment(o.id);
    const calls = fake.cashinCalls.length;
    await Promise.all([pay(o), pay(o), pay(o)]);
    assert.equal(fake.cashinCalls.length, calls + 1);
    assert.equal(att(o).length, 2);
  });

  it('a paid order is never prompted again', async () => {
    const o = makeOrder();
    await pay(o);
    fake.settle(att(o)[0].ref!, 'successful');
    await syncOrderPayment(o.id);
    const r = await pay(o);
    assert.equal(r.status, 'paid');
    assert.equal(fake.cashinCalls.length, 1);
  });

  it('refuses a mismatched amount or phone before any request is sent', async () => {
    const o = makeOrder();
    assert.equal((await initiatePayment({ method: 'mtn_momo', orderId: o.id, phone: o.customer.phone, amount: 1 })).success, false);
    assert.equal((await initiatePayment({ method: 'mtn_momo', orderId: o.id, phone: '0799999999', amount: o.total })).success, false);
    assert.equal(fake.cashinCalls.length, 0);
    assert.equal(att(o).length, 0);
  });
});

describe('status outcomes', () => {
  it('approve: unpaid while pending, paid once Paypack confirms the exact amount', async () => {
    const o = makeOrder();
    await pay(o);
    let s = await syncOrderPayment(o.id, att(o)[0].id);
    assert.equal(s?.providerStatus, 'pending');
    assert.equal(decidePhase(s!, 5_000).phase, 'waiting');
    fake.settle(att(o)[0].ref!, 'successful');
    s = await syncOrderPayment(o.id, att(o)[0].id);
    assert.equal(s?.status, 'paid');
    assert.equal(decidePhase(s!, 9_000).phase, 'success');
    assert.equal(paidNotifications(o), 1);
  });

  for (const status of ['failed', 'rejected'] as const) {
    it(`customer cancels/rejects (provider "${status}") -> cancelled, order unpaid-failed, polling stops`, async () => {
      const o = makeOrder();
      await pay(o);
      fake.settle(att(o)[0].ref!, status);
      const s = await syncOrderPayment(o.id, att(o)[0].id);
      assert.equal(s?.status, 'failed');
      const d = decidePhase(s!, 3_000);
      assert.deepEqual([d.phase, d.stopPolling], ['cancelled', true]);
      assert.equal(paidNotifications(o), 0);
    });
  }

  it('never approved: stays pending, never "failed" by the clock; UI says unresolved after the long window', async () => {
    const o = makeOrder();
    await pay(o);
    const s = await syncOrderPayment(o.id, att(o)[0].id);
    assert.equal(s?.providerStatus, 'pending');
    assert.equal(o.paymentStatus, 'unpaid');
    const pending = { status: 'unpaid' as const, providerStatus: 'pending' as const };
    assert.equal(decidePhase(pending, UNRESOLVED_AFTER_MS - 1).phase, 'waiting');
    assert.equal(decidePhase(pending, UNRESOLVED_AFTER_MS).phase, 'unresolved');
  });

  it('a final failure reported ~12 minutes later (dismissed prompt) is still picked up', async () => {
    const o = makeOrder();
    await pay(o);
    fake.settle(att(o)[0].ref!, 'failed');
    const s = await syncOrderPayment(o.id, att(o)[0].id);
    assert.equal(decidePhase(s!, 12 * 60 * 1000).phase, 'cancelled');
  });

  it('provider unreachable while waiting: "unavailable", order untouched, UI keeps waiting, recovers later', async () => {
    const o = makeOrder();
    await pay(o);
    fake.down = true;
    const s = await syncOrderPayment(o.id, att(o)[0].id);
    assert.equal(s?.unavailable, true);
    assert.equal(o.paymentStatus, 'unpaid');
    const d = decidePhase(s!, 30_000);
    assert.deepEqual([d.phase, d.degraded, d.stopPolling], ['waiting', true, false]);
    fake.down = false;
    fake.settle(att(o)[0].ref!, 'successful');
    assert.equal((await syncOrderPayment(o.id, att(o)[0].id))?.status, 'paid');
  });

  it('failed then late success on the same attempt -> paid (provider is authoritative)', async () => {
    const o = makeOrder();
    await pay(o);
    fake.settle(att(o)[0].ref!, 'failed');
    await syncOrderPayment(o.id);
    assert.equal(o.paymentStatus, 'failed');
    fake.settle(att(o)[0].ref!, 'successful');
    await syncOrderPayment(o.id);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(paidNotifications(o), 1);
  });

  it('same webhook delivered many times applies once', async () => {
    const o = makeOrder();
    await pay(o);
    const ref = att(o)[0].ref!;
    const a = await webhook(ref, 'successful', 5000);
    const b = await webhook(ref, 'successful', 5000);
    assert.equal(a.body.effect, 'paid');
    assert.equal(b.body.duplicate, true);
    assert.equal(paidNotifications(o), 1);
  });

  it('refresh while pending resumes the same request instead of charging again', async () => {
    const o = makeOrder();
    await pay(o);
    const ref = att(o)[0].ref;
    const resumed = await pay(o);
    assert.equal(resumed.providerRequestId, ref);
    assert.equal(fake.cashinCalls.length, 1);
    fake.settle(ref!, 'successful');
    assert.equal((await syncOrderPayment(o.id))?.status, 'paid');
  });

  it('provider sources disagree: a stale "pending" never hides a final answer', async () => {
    const o = makeOrder();
    await pay(o);
    const tx = fake.txs.get(att(o)[0].ref!)!;
    tx.findMode = 'status';
    tx.findStatus = 'pending';
    fake.settle(tx.ref, 'failed');
    assert.equal((await syncOrderPayment(o.id))?.status, 'failed');

    const o2 = makeOrder();
    await pay(o2);
    const tx2 = fake.txs.get(att(o2)[0].ref!)!;
    tx2.findMode = 'status';
    tx2.findStatus = 'successful';
    assert.equal((await syncOrderPayment(o2.id))?.status, 'paid');
  });

  it('cash on delivery is untouched', async () => {
    const o = makeOrder();
    const r = await initiatePayment({ method: 'cash_on_delivery', orderId: o.id, phone: o.customer.phone, amount: o.total });
    assert.equal(r.success, true);
    assert.equal(fake.cashinCalls.length, 0);
    assert.equal(att(o).length, 0);
  });
});

// =====================================================================================================
describe('UPGRADE: orders created BEFORE payment attempts existed (no attempt records, one providerReference)', () => {
  /** An order exactly as the previous release stored it. */
  function legacyOrder(paymentStatus: Order['paymentStatus'], ref: string | undefined, total = 5000): Order {
    const o = makeOrder(total);
    o.paymentStatus = paymentStatus;
    if (ref) o.providerReference = ref;
    assert.equal(o.paymentAttempts, undefined);
    return o;
  }

  it('a pending legacy order is still settled by its provider webhook (the payment is not dropped)', async () => {
    const o = legacyOrder('unpaid', 'legacy-ref-1');
    const res = await webhook('legacy-ref-1', 'successful', 5000);
    assert.equal(res.body.matched, true);
    assert.equal(res.body.effect, 'paid');
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(att(o).length, 1);
    assert.match(att(o)[0].id, /^legacy-/);
    assert.equal(paidNotifications(o), 1);
    assert.equal((await webhook('legacy-ref-1', 'successful', 5000)).body.duplicate, true); // replays stay idempotent
  });

  it('a legacy order that the old code marked failed can be retried as a brand-new attempt', async () => {
    const o = legacyOrder('failed', 'legacy-ref-2');
    fake.txs.set('legacy-ref-2', { ref: 'legacy-ref-2', amount: 5000, findMode: '404', events: [] });
    fake.settle('legacy-ref-2', 'failed');
    const r = await pay(o);
    assert.equal(r.success, true);
    assert.equal(att(o).length, 2);
    assert.equal(att(o)[0].status, 'failed');
    assert.notEqual(att(o)[1].ref, 'legacy-ref-2');
    assert.equal(fake.cashinCalls.length, 1);
  });

  it('a legacy order still pending at the provider blocks a retry (no second prompt), then resolves normally', async () => {
    const o = legacyOrder('unpaid', 'legacy-ref-3');
    fake.txs.set('legacy-ref-3', {
      ref: 'legacy-ref-3',
      amount: 5000,
      findMode: '404',
      events: [{ event_kind: 'transaction:created', created_at: new Date().toISOString(), data: { ref: 'legacy-ref-3', kind: 'CASHIN', status: 'pending', amount: 5000 } }],
    });
    const r = await pay(o);
    assert.equal(r.success, true);
    assert.equal(r.providerRequestId, 'legacy-ref-3');
    assert.equal(fake.cashinCalls.length, 0, 'no new prompt while the old one may still be approved');
    fake.settle('legacy-ref-3', 'successful');
    assert.equal((await syncOrderPayment(o.id))?.status, 'paid');
  });

  it('an already-paid legacy order stays paid and a replayed old event changes nothing', async () => {
    const o = legacyOrder('paid', 'legacy-ref-4');
    assert.equal((await webhook('legacy-ref-4', 'successful', 5000)).body.duplicate, true);
    assert.equal((await webhook('legacy-ref-4', 'failed', 5000)).body.effect, 'noop');
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(paidNotifications(o), 0, 'no fulfilment notification for money that was already recorded');
    assert.equal((await pay(o)).status, 'paid');
    assert.equal(fake.cashinCalls.length, 0);
  });

  it('orders with no payment history at all (cash on delivery, never started) are untouched', async () => {
    const o = legacyOrder('unpaid', undefined);
    assert.equal(att(o).length, 0);
    const res = await webhook('some-unrelated-ref', 'successful', 5000);
    assert.equal(res.body.matched, false);
    assert.equal(att(o).length, 0, 'the upgrade must not invent attempts for orders without a reference');
  });

  it('the upgrade is idempotent: running it repeatedly never duplicates the attempt', async () => {
    const o = legacyOrder('unpaid', 'legacy-ref-5');
    await webhook('legacy-ref-5', 'failed', 5000);
    await webhook('legacy-ref-5', 'failed', 5000);
    await syncOrderPayment(o.id);
    await syncOrderPayment(o.id);
    assert.equal(att(o).length, 1);
  });
});

// =====================================================================================================
describe('EARLY RETRY: "I cancelled it on my phone, retry now" (before the provider has answered)', () => {
  const earlyRetry = (o: Order, attemptId: string) =>
    initiatePayment({ method: 'mtn_momo', orderId: o.id, phone: o.customer.phone, amount: o.total, supersedeAttemptId: attemptId });
  /** Make the outstanding request look old enough for an early retry. */
  const age = (o: Order, ms = EARLY_RETRY_MIN_AGE_MS + 5_000) => {
    for (const a of att(o)) a.createdAt = new Date(Date.now() - ms).toISOString();
  };

  it('is refused when the provider has not answered and the request is too recent (no new request is sent)', async () => {
    const o = makeOrder();
    await pay(o);
    const A1 = att(o)[0];
    const r = await earlyRetry(o, A1.id);
    assert.equal(r.success, false);
    assert.equal(att(o).length, 1);
    assert.equal(A1.supersededAt, undefined);
    assert.equal(fake.cashinCalls.length, 1);
  });

  it('after the minimum wait it starts a NEW attempt (own id, key, reference) and keeps A1 tracked, not assumed cancelled', async () => {
    const o = makeOrder();
    await pay(o);
    const A1 = att(o)[0];
    age(o);
    const r = await earlyRetry(o, A1.id);
    assert.equal(r.success, true);
    assert.equal(att(o).length, 2);
    const A2 = att(o)[1];
    assert.notEqual(A2.id, A1.id);
    assert.notEqual(A2.ref, A1.ref);
    assert.notEqual(A2.idempotencyKey, A1.idempotencyKey);
    assert.equal(r.attemptId, A2.id);
    assert.equal(fake.cashinCalls.length, 2);
    assert.equal(fake.txs.size, 2);
    assert.ok(A1.supersededAt, 'A1 is marked as replaced by the customer');
    assert.equal(A1.status, 'pending', 'but it is NOT assumed cancelled: the provider has not said so');
    assert.equal(o.paymentStatus, 'unpaid');
  });

  it('asks the PROVIDER first: if the old request already succeeded, nothing new is sent and the order is paid', async () => {
    const o = makeOrder();
    await pay(o);
    const A1 = att(o)[0];
    age(o);
    fake.settle(A1.ref!, 'successful');
    const r = await earlyRetry(o, A1.id);
    assert.equal(r.status, 'paid');
    assert.equal(att(o).length, 1);
    assert.equal(fake.cashinCalls.length, 1);
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(paidNotifications(o), 1);
  });

  it('asks the PROVIDER first: if the old request is already confirmed failed, it is a normal retry', async () => {
    const o = makeOrder();
    await pay(o);
    const A1 = att(o)[0];
    fake.settle(A1.ref!, 'failed');
    const r = await earlyRetry(o, A1.id);
    assert.equal(r.success, true);
    assert.equal(att(o).length, 2);
    assert.equal(A1.status, 'failed');
    assert.equal(A1.supersededAt, undefined, 'a confirmed failure is not an "early" retry');
  });

  it('is refused when the provider cannot be reached (cannot rule out that it succeeded)', async () => {
    const o = makeOrder();
    await pay(o);
    age(o);
    fake.down = true;
    const r = await earlyRetry(o, att(o)[0].id);
    assert.equal(r.success, false);
    assert.equal(att(o).length, 1);
    assert.equal(fake.cashinCalls.length, 1);
  });

  it('is limited to ONE early retry per order', async () => {
    const o = makeOrder();
    await pay(o);
    age(o);
    await earlyRetry(o, att(o)[0].id);
    age(o);
    const second = await earlyRetry(o, att(o)[1].id);
    assert.equal(second.success, false);
    assert.equal(att(o).length, 2);
    assert.equal(fake.cashinCalls.length, 2);
  });

  it('ignores a confirmation about a stale attempt id (starts nothing)', async () => {
    const o = makeOrder();
    await pay(o);
    age(o);
    const r = await earlyRetry(o, 'pay-not-the-live-attempt');
    assert.equal(r.success, true);
    assert.equal(r.attemptId, att(o)[0].id);
    assert.equal(att(o).length, 1);
    assert.equal(fake.cashinCalls.length, 1);
  });

  it('without the confirmation the old strict rule still blocks a second request', async () => {
    const o = makeOrder();
    await pay(o);
    age(o);
    await pay(o);
    assert.equal(att(o).length, 1);
    assert.equal(fake.cashinCalls.length, 1);
  });

  it('replaced A1 approved first: paid once through A1; A2 approved later is a flagged duplicate', async () => {
    const o = makeOrder();
    await pay(o);
    age(o);
    await earlyRetry(o, att(o)[0].id);
    const [A1, A2] = att(o);
    const first = await webhook(A1.ref!, 'successful', 5000);
    assert.equal(first.body.effect, 'paid');
    assert.equal(o.paymentStatus, 'paid');
    assert.equal(o.providerReference, A1.ref);
    const second = await webhook(A2.ref!, 'successful', 5000);
    assert.equal(second.body.effect, 'duplicate_charge');
    assert.equal(paidNotifications(o), 1);
    assert.equal(o.paymentIssues?.length, 1);
    assert.equal(o.paymentIssues![0].attemptId, A2.id);
  });

  it('A2 approved first: paid once through A2; a later approval of the replaced A1 is a flagged duplicate that says so', async () => {
    const o = makeOrder();
    await pay(o);
    age(o);
    await earlyRetry(o, att(o)[0].id);
    const [A1, A2] = att(o);
    assert.equal((await webhook(A2.ref!, 'successful', 5000)).body.effect, 'paid');
    const late = await webhook(A1.ref!, 'successful', 5000);
    assert.equal(late.body.effect, 'duplicate_charge');
    assert.equal(A1.status, 'duplicate');
    assert.match(o.paymentIssues![0].note, /replaced this request/);
    assert.equal(paidNotifications(o), 1);
    assert.equal(o.paymentStatus, 'paid');
  });

  it('when the replaced A1 finally fails it changes nothing: A2 stays pending and the order is not marked failed', async () => {
    const o = makeOrder();
    await pay(o);
    age(o);
    await earlyRetry(o, att(o)[0].id);
    const [A1, A2] = att(o);
    fake.settle(A1.ref!, 'failed');
    const poll = await syncOrderPayment(o.id, A2.id);
    assert.equal(A1.status, 'failed');
    assert.equal(A2.status, 'pending');
    assert.equal(o.paymentStatus, 'unpaid');
    assert.equal(poll?.status, 'unpaid');
    assert.equal(poll?.providerStatus, 'pending');
  });

  it('polling discovers an approved A1 even with no webhook, and tells the page the order is paid', async () => {
    const o = makeOrder();
    await pay(o);
    age(o);
    await earlyRetry(o, att(o)[0].id);
    const [A1, A2] = att(o);
    fake.settle(A1.ref!, 'successful');
    const poll = await syncOrderPayment(o.id, A2.id);
    assert.equal(poll?.status, 'paid');
    assert.equal(o.paymentStatus, 'paid');
  });
});
