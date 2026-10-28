import { Router } from 'express';
import { config } from '../config';
import { getTransaction, paypackReady, verifySignature } from '../services/paypackService';
import { applyProviderOutcome, findByRef } from '../services/paymentAttempts';

/**
 * Paypack webhooks.
 *
 * Register this URL on the Paypack dashboard (Application -> Configure -> Webhooks):
 *   URL   : <PUBLIC_URL>/api/webhooks/paypack
 *   Mode  : must equal PAYPACK_WEBHOOK_MODE (development | production)
 *   Status: Active
 *
 * Every request carries `x-paypack-signature`, an HMAC-SHA256 of the RAW body keyed with the webhook
 * secret shown on the webhook card.
 *
 * An event is matched to a payment ATTEMPT by its provider reference and changes only that attempt
 * (see services/paymentAttempts.ts). Events for an old attempt can never alter a newer one.
 */

export const paypackWebhookRouter = Router();

/**
 * Paypack pings the webhook URL with HEAD before delivering the payload; the ping must answer 2xx or
 * the payload is never sent (docs: Webhooks). No body arrives on HEAD, so there is nothing to
 * authenticate - it is a reachability check only.
 */
paypackWebhookRouter.head('/paypack', (_req, res) => {
  res.status(200).end();
});

paypackWebhookRouter.post('/paypack', async (req, res) => {
  // Signature must be checked against the exact bytes Paypack signed.
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body ?? {}));
  if (!verifySignature(raw, req.header('x-paypack-signature'))) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  let event: any;
  try {
    event = JSON.parse(raw.toString('utf8') || '{}');
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }
  const data = event?.data ?? event;
  const kind: string = data?.kind ?? '';
  const ref = String(data?.ref ?? '');
  const status = String(data?.status ?? event?.status ?? '').toLowerCase();

  // Ignore non-payment events and anything we cannot match to an attempt.
  if (!ref || !['CASHIN', 'CASHOUT'].includes(kind) || !status) {
    res.json({ received: true });
    return;
  }

  const found = findByRef(ref);
  if (!found) {
    res.json({ received: true, matched: false });
    return;
  }

  const outcome =
    status === 'successful' || status === 'success' ? 'successful' : status === 'failed' ? 'failed' : 'pending';
  const effect = applyProviderOutcome(found.order, found.attempt, { status: outcome, amount: data?.amount ?? event?.amount });

  res.json({
    received: true,
    matched: true,
    attemptId: found.attempt.id,
    effect,
    ...(effect === 'noop' ? { duplicate: true } : {}),
    ...(effect === 'amount_mismatch' ? { amountMismatch: true, expected: found.order.total } : {}),
  });
});

/**
 * Manual reconciliation of one provider reference (kept for operators / older clients). Applies the
 * provider's current answer to the attempt that owns the reference, through the same code path.
 */
paypackWebhookRouter.post('/paypack/:ref/sync', async (req, res) => {
  if (!paypackReady()) {
    res.status(503).json({ error: 'Paypack is not configured' });
    return;
  }
  const found = findByRef(req.params.ref);
  if (!found) {
    res.status(404).json({ error: 'No payment attempt uses this reference' });
    return;
  }
  let tx: Awaited<ReturnType<typeof getTransaction>>;
  try {
    tx = await getTransaction(found.attempt.ref!);
  } catch {
    res.status(503).json({ error: 'Paypack is unreachable; the payment state is unknown', data: { ref: found.attempt.ref, unavailable: true } });
    return;
  }
  if (!tx) {
    res.json({ data: { ref: found.attempt.ref, attemptId: found.attempt.id, attemptStatus: found.attempt.status } });
    return;
  }
  const effect = applyProviderOutcome(found.order, found.attempt, { status: tx.status, amount: tx.amount });
  res.json({ data: { ref: found.attempt.ref, attemptId: found.attempt.id, attemptStatus: found.attempt.status, effect, status: tx.status } });
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
