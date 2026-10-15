import express, { Router } from 'express';
import { config } from '../config';
import { orders, pushNotification, updateOrderPaymentStatus } from '../data/store';
import { getTransaction, paypackReady, requestCashin, verifySignature } from '../services/paypackService';
import { roundMoney } from '../services/paymentService';

/**
 * Paypack webhooks.
 *
 * Register this URL on the Paypack dashboard (Application -> Configure -> Webhooks):
 *   URL   : <PUBLIC_URL>/api/webhooks/paypack
 *   Mode  : must equal PAYPACK_WEBHOOK_MODE (development | production)
 *   Status: Active
 *
 * Every request carries `x-paypack-signature`, an HMAC-SHA256 of the RAW body
 * keyed with the webhook secret shown on the webhook card.
 */

export const paypackWebhookRouter = Router();

function findOrderByRef(ref: string) {
  return orders.find((o) => o.providerReference === ref);
}

/**
 * An order is only settled when the reported amount equals the order total the
 * server itself computed at checkout. Returns true when the event amount is
 * present, numeric, and does NOT match — i.e. money moved for the wrong amount.
 * A missing/zero amount means the provider did not report one; the ref match
 * alone is trusted in that case (we requested exactly order.total).
 */
function amountMismatch(orderTotal: number, reported: unknown): boolean {
  const value = Number(reported);
  if (!Number.isFinite(value) || value <= 0) return false;
  return roundMoney(value) !== roundMoney(orderTotal);
}

/**
 * Paypack pings the webhook URL with HEAD before delivering the payload; the
 * ping must answer 2xx or the payload is never sent (docs: Webhooks). No body
 * arrives on HEAD, so there is nothing to authenticate — it is a reachability
 * check only.
 */
paypackWebhookRouter.head('/paypack', (req, res) => {
  res.status(200).end();
});

paypackWebhookRouter.post('/paypack', async (req, res) => {
  // Signature must be checked against the exact bytes Paypack signed.
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  if (!verifySignature(raw, req.header('x-paypack-signature'))) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const event = JSON.parse(raw.toString('utf8') || '{}');
  const data = event?.data ?? event;
  const kind: string = data?.kind ?? '';
  const ref = String(data?.ref ?? '');
  const status = String(data?.status ?? event?.status ?? '');

  // Ignore non-payment events and anything we cannot match to an order.
  if (!ref || !['CASHIN', 'CASHOUT'].includes(kind) || !status) {
    res.json({ received: true });
    return;
  }

  const order = findOrderByRef(ref);
  if (!order) {
    res.json({ received: true, matched: false });
    return;
  }
  // Wrong amount of money moved → never mark the order paid; flag it loudly.
  if (status === 'successful' && amountMismatch(order.total, data?.amount ?? event?.amount)) {
    console.warn(
      `[paypack] AMOUNT MISMATCH for ref=${ref} order=${order.orderNumber}: ` +
        `event reported ${data?.amount ?? event?.amount} RWF but the order total is ${order.total} RWF — not marking paid.`
    );
    res.json({ received: true, matched: true, amountMismatch: true, expected: order.total });
    return;
  }
  // Idempotency: Paypack may retry a delivery; never double-apply.
  if (order.paymentStatus === 'paid' && status === 'successful') {
    res.json({ received: true, matched: true, duplicate: true });
    return;
  }

  const paymentStatus = status === 'successful' ? 'paid' : status === 'failed' ? 'failed' : order.paymentStatus;
  updateOrderPaymentStatus(order.id, paymentStatus, ref);

  if (paymentStatus === 'paid') {
    pushNotification({
      phone: order.customer.phone,
      title: 'Payment received',
      body: `Payment of ${order.total} RWF for order ${order.orderNumber} was received.`,
      kind: 'order',
    });
  }

  res.json({ received: true, matched: true });
});

/**
 * Fallback reconciliation: the mobile app polls this after starting a Paypack
 * cashin in case the webhook is delayed or the device went offline.
 */
paypackWebhookRouter.post('/paypack/:ref/sync', async (req, res) => {
  if (!paypackReady()) {
    res.status(503).json({ error: 'Paypack is not configured' });
    return;
  }
  const ref = req.params.ref;
  const order = findOrderByRef(ref);
  if (!order) {
    res.status(404).json({ error: 'Order not found for reference' });
    return;
  }
  const tx = await getTransaction(ref);
  if (!tx) {
    res.json({ data: { ref, status: order.paymentStatus } });
    return;
  }
  if (tx.status === 'successful' && order.paymentStatus !== 'paid') {
    // Same rule as the webhook: paid only if the money matches the order total.
    if (amountMismatch(order.total, tx.amount)) {
      console.warn(
        `[paypack] AMOUNT MISMATCH on sync ref=${ref} order=${order.orderNumber}: ` +
          `received ${tx.amount} RWF but the order total is ${order.total} RWF — not marking paid.`
      );
      res.json({ data: { ref, status: order.paymentStatus, amount: tx.amount, amountMismatch: true, expected: order.total } });
      return;
    }
    updateOrderPaymentStatus(order.id, 'paid', ref);
    pushNotification({
      phone: order.customer.phone,
      title: 'Payment received',
      body: `Payment of ${order.total} RWF for order ${order.orderNumber} was received.`,
      kind: 'order',
    });
  } else if (tx.status === 'failed' && order.paymentStatus === 'unpaid') {
    updateOrderPaymentStatus(order.id, 'failed', ref);
  }
  res.json({ data: { ref, status: tx.status, amount: tx.amount } });
});

/** Tells the frontend where to send users and what the webhook URL is. */
paypackWebhookRouter.get('/paypack/config', (_req, res) => {
  res.json({
    data: {
      enabled: paypackReady(),
      webhookMode: config.paypack.webhookMode,
      webhookUrl: config.paypack.publicUrl ? `${config.paypack.publicUrl}/api/webhooks/paypack` : null,
    },
  });
});