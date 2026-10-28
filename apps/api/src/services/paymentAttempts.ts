import crypto from 'node:crypto';
import type { Order, PaymentAttempt, PaymentAttemptStatus } from '@duhahe/shared';
import { orders, pushNotification, saveOrder, updateOrderPaymentStatus } from '../data/store';

/**
 * Payment attempts.
 *
 * Every mobile-money request for an order is its own PaymentAttempt: its own id, its own
 * Idempotency-Key and its own provider reference. A provider event is matched to an attempt by that
 * reference ONLY (never by order id, phone, amount or "the latest attempt"), and it can only ever
 * change that one attempt. `applyProviderOutcome` is the single place where an outcome reaches an order,
 * so the webhook, the status poll and the retry gate cannot disagree.
 */

const TERMINAL: ReadonlySet<PaymentAttemptStatus> = new Set(['paid', 'failed', 'duplicate', 'mismatch']);
export const isTerminal = (a: PaymentAttempt) => TERMINAL.has(a.status);

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** A provider amount only settles an order when it is present and exact. */
export function amountSettles(expected: number, reported: unknown): boolean {
  const value = Number(reported);
  if (!Number.isFinite(value) || value <= 0) return false;
  return roundMoney(value) === roundMoney(expected);
}

/**
 * Upgrade path for orders created before payment attempts existed. Those orders carry a single
 * `providerReference` and an order-level `paymentStatus` and no attempt records, so without this a
 * webhook or status poll for their reference would match nothing (and a payment could be dropped).
 * This derives one attempt from that legacy data. It is idempotent, needs no database migration (orders
 * are stored as whole documents) and runs lazily wherever an order or a reference is looked up.
 */
export function ensureLegacyAttempt(order: Order, persist = true): void {
  if (order.paymentAttempts?.length || !order.providerReference) return;
  const settled = order.paymentStatus === 'paid' || order.paymentStatus === 'refunded';
  const status: PaymentAttemptStatus = settled ? 'paid' : order.paymentStatus === 'failed' ? 'failed' : 'pending';
  order.paymentAttempts = [
    {
      id: `legacy-${order.providerReference.replace(/[^a-zA-Z0-9]/g, '').slice(0, 12)}`,
      ref: order.providerReference,
      idempotencyKey: 'legacy', // never re-sent: it already has a provider reference
      amount: roundMoney(order.total),
      phone: order.customer.phone,
      status,
      createdAt: order.createdAt,
      ...(status === 'pending' ? {} : { settledAt: order.createdAt }),
    },
  ];
  if (persist) saveOrder(order);
}

export function currentAttempt(order: Order): PaymentAttempt | undefined {
  const list = order.paymentAttempts;
  return list && list.length ? list[list.length - 1] : undefined;
}

export function findAttempt(order: Order, attemptId?: string): PaymentAttempt | undefined {
  return attemptId ? order.paymentAttempts?.find((a) => a.id === attemptId) : undefined;
}

/** The order + attempt a provider reference belongs to, or null if no attempt ever used it. */
export function findByRef(ref: string): { order: Order; attempt: PaymentAttempt } | null {
  if (!ref) return null;
  for (const order of orders) {
    ensureLegacyAttempt(order, false); // in memory only: avoids a mass write the first time a webhook arrives
    const attempt = order.paymentAttempts?.find((a) => a.ref === ref);
    if (attempt) return { order, attempt };
  }
  return null;
}

/** Attempts still waiting for a provider answer (or never confirmed to exist). */
export function openAttempts(order: Order): PaymentAttempt[] {
  return (order.paymentAttempts ?? []).filter((a) => !isTerminal(a));
}

/** Fresh id and Idempotency-Key. The key is derived from the attempt id, so it is unique per attempt. */
export function beginAttempt(order: Order, amount: number): PaymentAttempt {
  const id = `pay-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const attempt: PaymentAttempt = {
    id,
    idempotencyKey: crypto.createHash('sha256').update(`${order.id}:${id}`).digest('hex').slice(0, 32),
    amount: roundMoney(amount),
    phone: order.customer.phone,
    status: 'initiated',
    createdAt: new Date().toISOString(),
  };
  (order.paymentAttempts ??= []).push(attempt);
  saveOrder(order);
  return attempt;
}

/** The provider has created the request: bind its reference to this attempt. */
export function bindRef(order: Order, attempt: PaymentAttempt, ref: string): void {
  attempt.ref = ref;
  if (attempt.status === 'initiated') attempt.status = 'pending';
  // A new live attempt supersedes an earlier failed one at the order level.
  if (order.paymentStatus !== 'paid') updateOrderPaymentStatus(order.id, 'unpaid', ref);
  saveOrder(order);
}

export type OutcomeEffect =
  | 'paid' //              this attempt settled the order (fulfil once)
  | 'failed' //            this attempt failed
  | 'pending' //           nothing final yet
  | 'duplicate_charge' //  provider took money but the order was already paid -> needs a refund
  | 'amount_mismatch' //   provider took a different amount -> order NOT paid, needs a human
  | 'noop'; //             already applied (replayed / duplicate event)

export interface ProviderOutcome {
  status: 'pending' | 'successful' | 'failed';
  amount?: number;
}

function notifyPaid(order: Order): void {
  pushNotification({
    phone: order.customer.phone,
    title: 'Payment received',
    body: `Payment of ${order.total} RWF for order ${order.orderNumber} was received.`,
    kind: 'order',
  });
}

function addIssue(order: Order, issue: NonNullable<Order['paymentIssues']>[number]): void {
  const list = (order.paymentIssues ??= []);
  if (!list.some((i) => i.attemptId === issue.attemptId && i.kind === issue.kind)) list.push(issue);
}

/**
 * Apply one provider outcome to exactly one attempt (and, through it, to the order).
 * Idempotent: replaying the same event changes nothing and fulfils nothing twice.
 */
export function applyProviderOutcome(order: Order, attempt: PaymentAttempt, outcome: ProviderOutcome): OutcomeEffect {
  const now = new Date().toISOString();

  if (outcome.status === 'pending') {
    if (attempt.status === 'initiated' && attempt.ref) attempt.status = 'pending';
    return 'pending';
  }

  if (outcome.status === 'failed') {
    // Never downgrade an attempt that already holds money (paid / duplicate / mismatch) or is already failed.
    if (attempt.status !== 'pending' && attempt.status !== 'initiated') return 'noop';
    attempt.status = 'failed';
    attempt.settledAt = now;
    // Only the attempt that is currently live may mark the ORDER failed. A late "failed" for an
    // earlier attempt must not touch a newer attempt that is still pending, and never a paid order.
    if (order.paymentStatus !== 'paid' && currentAttempt(order)?.id === attempt.id) {
      updateOrderPaymentStatus(order.id, 'failed');
    }
    saveOrder(order);
    return 'failed';
  }

  // outcome.status === 'successful'
  if (attempt.status === 'paid' || attempt.status === 'duplicate' || attempt.status === 'mismatch') return 'noop';

  if (!amountSettles(attempt.amount, outcome.amount) || !amountSettles(order.total, outcome.amount)) {
    attempt.status = 'mismatch';
    attempt.providerAmount = Number(outcome.amount);
    attempt.settledAt = now;
    addIssue(order, {
      at: now,
      kind: 'amount_mismatch',
      attemptId: attempt.id,
      ref: attempt.ref,
      amount: Number(outcome.amount) || 0,
      note: `Provider reported ${outcome.amount} RWF for attempt ${attempt.id}; the order total is ${order.total} RWF. Not marked paid.`,
    });
    console.warn(`[payments] AMOUNT MISMATCH order=${order.orderNumber} attempt=${attempt.id}: reported ${outcome.amount}, expected ${order.total}`);
    saveOrder(order);
    return 'amount_mismatch';
  }

  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') {
    // Another attempt (or an admin) already settled this order: this money is a second charge.
    attempt.status = 'duplicate';
    attempt.settledAt = now;
    addIssue(order, {
      at: now,
      kind: 'duplicate_charge',
      attemptId: attempt.id,
      ref: attempt.ref,
      amount: attempt.amount,
      note:
        `Customer was charged ${attempt.amount} RWF by attempt ${attempt.id} after the order was already paid` +
        `${attempt.supersededAt ? ' (the customer had replaced this request with a new one)' : ''}. Refund required. The order is NOT fulfilled again.`,
    });
    console.warn(`[payments] DUPLICATE CHARGE order=${order.orderNumber} attempt=${attempt.id} - refund required`);
    saveOrder(order);
    return 'duplicate_charge';
  }

  attempt.status = 'paid';
  attempt.settledAt = now;
  updateOrderPaymentStatus(order.id, 'paid', attempt.ref);
  notifyPaid(order);
  saveOrder(order);
  return 'paid';
}
