import type { Order, PaymentAttempt, PaymentRequest, PaymentResult } from '@duhahe/shared';
import { orders, saveOrder, updateOrderPaymentStatus } from '../data/store';
import { getTransaction, paypackReady, requestCashin, PaypackUnavailableError } from './paypackService';
import {
  applyProviderOutcome,
  beginAttempt,
  bindRef,
  currentAttempt,
  ensureLegacyAttempt,
  findAttempt,
  isTerminal,
  openAttempts,
  roundMoney,
} from './paymentAttempts';

export { roundMoney };

/**
 * Payment gateway layer.
 *
 * Amount discipline: the server NEVER trusts the client-supplied amount. The charge is always the
 * order's stored `total`, computed server-side at checkout.
 *
 * Phone discipline: the charge always goes to `order.customer.phone`.
 *
 * Attempt discipline: every mobile-money request is its own PaymentAttempt (own id, own
 * Idempotency-Key, own provider reference). A new attempt is only ever created once every earlier
 * attempt is provably finished at the provider; "unknown" blocks, it never allows a retry.
 *
 * Outcome discipline: an order only becomes `paid` when Paypack confirms success for the exact amount,
 * and only becomes `failed` when Paypack itself reports `failed`. Elapsed time never decides anything.
 */

function normalizePhone(phone: string): string {
  return String(phone ?? '').replace(/\D/g, '');
}

function failure(message: PaymentResult['message'], status: PaymentResult['status'] = 'failed', attemptId?: string): PaymentResult {
  return { success: false, message, status, attemptId };
}

function gatewayUnavailable(): PaymentResult {
  return failure({
    en: 'Mobile Money is not available right now. Please choose cash on delivery or try again later.',
    kin: 'Kwishyura na Mobile Money ntibiboneka ubu. Hitamo kwishyura mu gihe cyo gutanga cyangwa ugerageze nyuma.',
    fr: 'Le paiement Mobile Money est indisponible pour le moment. Choisissez le paiement à la livraison ou réessayez plus tard.',
  });
}

/** Read through a function so TypeScript does not assume the status is unchanged across an await. */
const isPaid = (order: Order): boolean => order.paymentStatus === 'paid';

const alreadyPaid = (order: Order): PaymentResult => ({
  success: true,
  providerRequestId: order.providerReference,
  attemptId: order.paymentAttempts?.find((a) => a.status === 'paid')?.id,
  message: {
    en: `Order ${order.orderNumber} has already been paid in full.`,
    kin: `Igisubizo ${order.orderNumber} cyishyurwe ku buryo bwuzuye.`,
    fr: `La commande ${order.orderNumber} a déjà été payée intégralement.`,
  },
  status: 'paid',
});

/**
 * One payment action per order at a time (double-click, two tabs, a refresh racing the first
 * request). Combined with the per-attempt Idempotency-Key this prevents a second charge.
 */
const orderLocks = new Map<string, Promise<unknown>>();
async function withOrderLock<T>(orderId: string, fn: () => Promise<T>): Promise<T> {
  const prev = orderLocks.get(orderId) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  orderLocks.set(orderId, tail);
  try {
    return await run;
  } finally {
    if (orderLocks.get(orderId) === tail) orderLocks.delete(orderId);
  }
}

/**
 * Ask the provider about every attempt that could still change the order (open attempts, plus the
 * newest attempt if it failed - a late success on it must be picked up) and apply each answer to ITS
 * OWN attempt. Returns `unavailable` when any lookup could not reach the provider.
 */
/** A failed attempt can still turn out to have succeeded (late event); keep watching it for this long. */
const FAILED_WATCH_MS = 60 * 60 * 1000;
/** ...but look at an older failed attempt at most this often, to stay inside the provider's rate limits. */
const RECHECK_FAILED_MS = Number(process.env.PAYMENT_RECHECK_FAILED_MS ?? 60_000);
const lastChecked = new Map<string, number>();

/** Attempts whose provider state could still change the order (or reveal a duplicate charge). */
function watchedAttempts(order: Order): PaymentAttempt[] {
  const latest = currentAttempt(order);
  const now = Date.now();
  return (order.paymentAttempts ?? []).filter((a) => {
    if (!a.ref) return false;
    if (!isTerminal(a)) return true; // still open at the provider
    if (a.status !== 'failed') return false;
    const settled = Date.parse(a.settledAt ?? a.createdAt);
    if (now - settled > FAILED_WATCH_MS) return false;
    return (a === latest && order.paymentStatus !== 'paid') || now - (lastChecked.get(a.id) ?? 0) >= RECHECK_FAILED_MS;
  });
}

/**
 * Ask the provider about every attempt that could still change the order and apply each answer to ITS
 * OWN attempt. Returns `unavailable` when any lookup could not reach the provider.
 */
export async function reconcileOrder(order: Order): Promise<{ unavailable: boolean }> {
  let unavailable = false;
  for (const attempt of watchedAttempts(order)) {
    try {
      const tx = await getTransaction(attempt.ref!);
      lastChecked.set(attempt.id, Date.now());
      if (tx) applyProviderOutcome(order, attempt, { status: tx.status, amount: tx.amount });
    } catch (err) {
      if (err instanceof PaypackUnavailableError) unavailable = true;
      else throw err;
    }
  }
  return { unavailable };
}

export async function initiatePayment(req: PaymentRequest): Promise<PaymentResult> {
  const order = orders.find((o) => o.id === req.orderId);
  if (!order) {
    return failure({ en: 'Order not found', kin: 'Ibwira ntiriboneka', fr: 'Commande introuvable' });
  }
  return withOrderLock(order.id, () => initiatePaymentLocked(req));
}

async function initiatePaymentLocked(req: PaymentRequest): Promise<PaymentResult> {
  const order = orders.find((o) => o.id === req.orderId)!;
  ensureLegacyAttempt(order); // orders from before payment attempts existed

  // Never charge twice for an order that is already settled.
  if (order.paymentStatus === 'paid') return alreadyPaid(order);
  if (order.status === 'cancelled') {
    return failure({
      en: 'This order was cancelled and cannot be paid.',
      kin: 'Iyi sisitemu yahagaritswe ntishobora kwishyurwa.',
      fr: 'Cette commande a été annulée et ne peut pas être payée.',
    });
  }

  // The order total is the ONLY amount the server will ever charge.
  const expected = roundMoney(order.total);
  const claimed = Number(req.amount);
  if (!Number.isFinite(claimed) || roundMoney(claimed) !== expected) {
    return failure({
      en: `Payment amount must equal the order total of ${expected} RWF.`,
      kin: `Igiteranyo cyo kwishyura igomba kujya ${expected} RWF.`,
      fr: `Le montant du paiement doit être égal au total de la commande, soit ${expected} RWF.`,
    });
  }

  // The charge always targets the phone that placed the order.
  if (req.phone && normalizePhone(req.phone) !== normalizePhone(order.customer.phone)) {
    return failure({
      en: 'Payment phone number does not match this order.',
      kin: 'Nomero ya telefone yo kwishyura ntihuye n’iyi sisitemu.',
      fr: 'Le numéro de téléphone du paiement ne correspond pas à cette commande.',
    });
  }

  if (req.method === 'cash_on_delivery') {
    updateOrderPaymentStatus(order.id, 'unpaid');
    return {
      success: true,
      message: { en: 'You will pay cash on delivery.', kin: 'Uzishyura iyo baraguhereje.', fr: 'Vous paierez à la livraison.' },
      status: 'unpaid',
    };
  }

  if (!paypackReady() || (req.method !== 'mtn_momo' && req.method !== 'airtel_money')) {
    return gatewayUnavailable();
  }

  // ---- Retry gate: a new attempt only once every earlier one is provably finished. ----
  const { unavailable } = await reconcileOrder(order);
  if (isPaid(order)) return alreadyPaid(order); // an earlier attempt turned out to be successful

  if (unavailable) {
    // Cannot verify the earlier request -> do not risk a second charge.
    return failure(
      {
        en: 'We cannot check your previous payment request right now. Please try again in a moment.',
        kin: 'Ntidushobora kugenzura ubusabe bwo kwishyura bwabanje ubu. Ongera ugerageze nyuma y’akanya.',
        fr: 'Impossible de vérifier votre demande de paiement précédente pour le moment. Réessayez dans un instant.',
      },
      'unpaid',
    );
  }

  const live = openAttempts(order).find((a) => a.ref);
  if (live) {
    // The provider still has a request that may be approved: wait for it, never start another.
    return {
      success: true,
      providerRequestId: live.ref,
      attemptId: live.id,
      message: {
        en: 'Your payment request is still waiting for approval on your phone.',
        kin: 'Ubusabe bwo kwishyura bukitegereje kwemezwa kuri telefone yawe.',
        fr: 'Votre demande de paiement attend toujours votre approbation sur votre téléphone.',
      },
      status: 'unpaid',
    };
  }

  // An attempt we sent but never heard back about is RE-SENT with its own key (so the provider
  // dedupes it); otherwise this is a brand-new attempt with a fresh id and key.
  const attempt = openAttempts(order).find((a) => !a.ref) ?? beginAttempt(order, expected);
  return sendAttempt(order, attempt);
}

async function sendAttempt(order: Order, attempt: PaymentAttempt): Promise<PaymentResult> {
  try {
    const { ref } = await requestCashin({
      amount: attempt.amount, // always the server-computed order total
      phone: order.customer.phone,
      idempotencyKey: attempt.idempotencyKey,
    });
    if (!ref) throw new Error('Paypack did not return a transaction reference');
    // Asynchronous: the order stays unpaid until the webhook (or the status poll) confirms THIS
    // attempt's reference with the exact amount.
    bindRef(order, attempt, ref);
    return {
      success: true,
      providerRequestId: ref,
      attemptId: attempt.id,
      message: {
        en: 'Payment request sent. Confirm it on your phone with your PIN.',
        kin: 'Ibisobanuro byo kwishyura byoherejwe. Emeza kuri telefone yawe ukoresheje PIN.',
        fr: 'Demande de paiement envoyée. Confirmez-la sur votre téléphone avec votre code PIN.',
      },
      status: 'unpaid',
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Payment request failed';
    const http = (err as { status?: number })?.status;
    if (typeof http === 'number' && http >= 400 && http < 500) {
      // The provider answered and refused the request: definitively no prompt exists.
      attempt.status = 'failed';
      attempt.settledAt = new Date().toISOString();
      updateOrderPaymentStatus(order.id, 'failed');
      saveOrder(order);
    }
    // Otherwise (network error / 5xx) the request MAY exist at the provider. The attempt stays
    // `initiated`, so a retry re-sends it with the SAME Idempotency-Key instead of creating a new charge.
    return failure({ en: reason, kin: reason, fr: reason }, 'failed', attempt.id);
  }
}

export interface PaymentSyncResult {
  status: Order['paymentStatus'];
  attemptId?: string;
  providerStatus?: 'pending' | 'successful' | 'failed';
  providerReference?: string;
  requestedAt?: string;
  amount?: number;
  amountMismatch?: boolean;
  /** Provider could not be reached on this check; the true state is unknown (never treated as failed). */
  unavailable?: boolean;
}

/**
 * The answer the payment page polls. It is about ONE attempt (the one the page asked about, else the
 * newest): the order is `paid` if any attempt settled it, otherwise the status is that attempt's own,
 * so a result for attempt A can never show up as the result of attempt B.
 */
export async function syncOrderPayment(orderId: string, attemptId?: string): Promise<PaymentSyncResult | null> {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return null;
  ensureLegacyAttempt(order);

  let unavailable = false;
  if (paypackReady()) ({ unavailable } = await reconcileOrder(order));

  const attempt = findAttempt(order, attemptId) ?? currentAttempt(order);
  const base: PaymentSyncResult = {
    status: order.paymentStatus,
    attemptId: attempt?.id,
    providerReference: attempt?.ref ?? order.providerReference,
    requestedAt: attempt?.createdAt,
    ...(unavailable ? { unavailable: true } : {}),
  };
  if (!attempt) return base;
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') return base;

  switch (attempt.status) {
    case 'failed':
      return { ...base, status: 'failed', providerStatus: 'failed' };
    case 'mismatch':
      return { ...base, status: 'unpaid', providerStatus: 'successful', amountMismatch: true, amount: attempt.providerAmount };
    case 'paid':
    case 'duplicate':
      return { ...base, status: 'paid', providerStatus: 'successful' };
    default:
      // pending / initiated: this attempt is still open. Report it as such, whatever older attempts did.
      return { ...base, status: 'unpaid', providerStatus: 'pending' };
  }
}

/** Orders with an attempt still open (or recently failed) - what the background reconciler re-checks. */
export function ordersWithOpenAttempts(maxAgeMs = FAILED_WATCH_MS): Order[] {
  const cutoff = Date.now() - maxAgeMs;
  orders.forEach((o) => ensureLegacyAttempt(o, false));
  return orders.filter((o) => (o.paymentAttempts ?? []).some((a) => a.ref && (!isTerminal(a) || a.status === 'failed') && Date.parse(a.settledAt ?? a.createdAt) > cutoff));
}

let reconcilerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Safety net for when no webhook arrives: periodically re-check every attempt that is still open, so a
 * late success on an earlier attempt (and the duplicate charge it implies) is recorded even after the
 * customer has left the payment page.
 */
export function startPaymentReconciler(intervalMs = 120_000): void {
  if (reconcilerTimer || !paypackReady()) return;
  reconcilerTimer = setInterval(async () => {
    for (const order of ordersWithOpenAttempts()) {
      try {
        await withOrderLock(order.id, () => reconcileOrder(order));
      } catch (err) {
        console.error('[payments] reconcile failed:', err instanceof Error ? err.message : err);
      }
    }
  }, intervalMs);
  reconcilerTimer.unref?.();
}
