import type { Order, PaymentRequest, PaymentResult } from '@duhahe/shared';
import { orders, pushNotification, updateOrderPaymentStatus } from '../data/store';
import { getTransaction, paypackReady, requestCashin } from './paypackService';

/**
 * Payment gateway layer.
 *
 * Amount discipline (important): the server NEVER trusts the client-supplied
 * amount. The charge is always the order's stored `total`, which is computed
 * server-side from the catalog at checkout. If the client claims a different
 * amount, the payment is rejected and the order is left untouched — so a user
 * can only ever pay exactly what the order says they owe.
 *
 * Phone discipline: the charge always goes to `order.customer.phone`; a
 * mismatching phone in the request is rejected (prevents pushing payment
 * prompts to arbitrary numbers).
 *
 * Phase 2: replace `stubRequest` with real MTN MoMo / Airtel Money REST calls
 * (see .env.example for required credentials).
 */

/** Round money to 2 decimal places for exact comparisons. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizePhone(phone: string): string {
  return String(phone ?? '').replace(/\D/g, '');
}

function failure(message: PaymentResult['message'], status: PaymentResult['status'] = 'failed'): PaymentResult {
  return { success: false, message, status };
}

function gatewayUnavailable(): PaymentResult {
  return failure({
    en: 'Mobile Money is not available right now. Please choose cash on delivery or try again later.',
    kin: 'Kwishyura na Mobile Money ntibiboneka ubu. Hitamo kwishyura mu gihe cyo gutanga cyangwa ugerageze nyuma.',
    fr: 'Le paiement Mobile Money est indisponible pour le moment. Choisissez le paiement A� la livraison ou rAcessayez plus tard.',
  });
}

/** A provider amount only settles an order when it is present and exact. */
function amountSettlesOrder(orderTotal: number, reported: unknown): boolean {
  const value = Number(reported);
  if (!Number.isFinite(value) || value <= 0) return false;
  return roundMoney(value) === roundMoney(orderTotal);
}

function notifyPaid(order: Order): void {
  pushNotification({
    phone: order.customer.phone,
    title: 'Payment received',
    body: `Payment of ${order.total} RWF for order ${order.orderNumber} was received.`,
    kind: 'order',
  });
}

export async function initiatePayment(req: PaymentRequest): Promise<PaymentResult> {
  const order = orders.find((o) => o.id === req.orderId);
  if (!order) {
    return failure({ en: 'Order not found', kin: 'Ibwira ntiriboneka', fr: 'Commande introuvable' });
  }

  // Idempotency: never charge twice for an order that is already settled.
  if (order.paymentStatus === 'paid') {
    return {
      success: true,
      providerRequestId: order.providerReference,
      message: {
        en: `Order ${order.orderNumber} has already been paid in full.`,
        kin: `Igisubizo ${order.orderNumber} cyishyurwe ku buryo bwuzuye.`,
        fr: `La commande ${order.orderNumber} a déjà été payée intégralement.`,
      },
      status: 'paid',
    };
  }
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
      message: { en: 'You will pay cash on delivery.', kin: 'Uzishyura iyo baraguhereje.', fr: 'Vous paierez A� la livraison.' },
      status: 'unpaid',
    };
  }

  // Idempotency for mobile money: an existing request must be resolved before
  // we ever send a second prompt. This is what prevents a customer who retries
  // from being charged twice, and it also picks up a payment that was approved
  // after the app stopped polling.
  if (paypackReady() && order.providerReference) {
    const existing = await getTransaction(order.providerReference);
    if (existing?.status === 'successful') {
      if (amountSettlesOrder(order.total, existing.amount)) {
        updateOrderPaymentStatus(order.id, 'paid', order.providerReference);
        notifyPaid(order);
        return {
          success: true,
          providerRequestId: order.providerReference,
          message: {
            en: `Order ${order.orderNumber} has already been paid in full.`,
            kin: `Igisubizo ${order.orderNumber} cyishyurwe ku buryo bwuzuye.`,
            fr: `La commande ${order.orderNumber} a dAcjA� ActAc payAce intAcgralement.`,
          },
          status: 'paid',
        };
      }
      return failure({
        en: 'A payment was received for a different amount. Please contact support before paying again.',
        kin: 'Amafaranga yishyuwe atandukanye n’igiteranyo cy’iyi sisitemu. Vugana n’ubufasha mbere yo kongera kwishyura.',
        fr: 'Un paiement a été reçu pour un montant différent. Contactez le support avant de payer à nouveau.',
      });
    }
    if (existing?.status === 'pending') {
      return {
        success: true,
        providerRequestId: order.providerReference,
        message: {
          en: 'Your payment request is still waiting for approval on your phone.',
          kin: 'Ubusabe bwo kwishyura bukitegereje kwemezwa kuri telefone yawe.',
          fr: 'Votre demande de paiement attend toujours votre approbation sur votre téléphone.',
        },
        status: 'unpaid',
      };
    }
    // `failed` (or unknown because the request expired) — a fresh prompt is allowed.
  }

  let result: PaymentResult;
  if (paypackReady() && (req.method === 'mtn_momo' || req.method === 'airtel_money')) {
    result = await paypackCashin(order.id, expected); // real mobile-money money movement via Paypack
  } else {
    result = gatewayUnavailable();
  }

  if (result.status === 'failed') {
    // Hard failure recorded; Paypack flows that stay asynchronous settle via
    // the webhook (which re-verifies the amount against order.total).
    updateOrderPaymentStatus(order.id, 'failed', result.providerRequestId);
  } else if (result.status === 'paid') {
    // Synchronous gateway approval of the exact order total above, so the
    // order is settled now.
    updateOrderPaymentStatus(order.id, 'paid', result.providerRequestId);
    notifyPaid(order);
  }
  return result;
}

export interface PaymentSyncResult {
  status: Order['paymentStatus'];
  providerStatus?: 'pending' | 'successful' | 'failed';
  providerReference?: string;
  amount?: number;
  amountMismatch?: boolean;
}

/**
 * Actively reconcile one order with Paypack. The mobile app calls this while
 * waiting on the phone prompt, so approval AND cancellation are both detected
 * even when the webhook is delayed or not configured.
 *
 * Money is only ever counted when Paypack reports `successful` AND the amount
 * equals the server-computed order total.
 */
export async function syncOrderPayment(orderId: string): Promise<PaymentSyncResult | null> {
  const order = orders.find((o) => o.id === orderId);
  if (!order) return null;

  const ref = order.providerReference;
  if (!ref || !paypackReady() || order.paymentStatus === 'paid' || order.paymentStatus === 'refunded') {
    return { status: order.paymentStatus, providerReference: ref };
  }

  const tx = await getTransaction(ref);
  if (!tx) return { status: order.paymentStatus, providerReference: ref };

  if (tx.status === 'successful') {
    if (!amountSettlesOrder(order.total, tx.amount)) {
      console.warn(
        `[paypack] AMOUNT MISMATCH on sync ref=${ref} order=${order.orderNumber}: ` +
          `received ${tx.amount} RWF but the order total is ${order.total} RWF - not marking paid.`,
      );
      return {
        status: order.paymentStatus,
        providerStatus: tx.status,
        providerReference: ref,
        amount: tx.amount,
        amountMismatch: true,
      };
    }
    updateOrderPaymentStatus(order.id, 'paid', ref);
    notifyPaid(order);
    return { status: 'paid', providerStatus: tx.status, providerReference: ref, amount: tx.amount };
  }

  if (tx.status === 'failed') {
    updateOrderPaymentStatus(order.id, 'failed', ref);
  }

  return {
    status: order.paymentStatus,
    providerStatus: tx.status,
    providerReference: ref,
    amount: tx.amount,
  };
}

async function paypackCashin(orderId: string, amount: number): Promise<PaymentResult> {
  const order = orders.find((o) => o.id === orderId)!;
  try {
    const { ref } = await requestCashin({
      amount, // always the server-computed order total
      phone: order.customer.phone,
    });
    // Paypack is asynchronous: the order stays unpaid until the webhook (or the
    // /api/webhooks/paypack/:ref/sync poll) confirms the transaction AND its
    // amount matches order.total.
    updateOrderPaymentStatus(order.id, 'unpaid', ref);
    return {
      success: true,
      providerRequestId: ref,
      message: {
        en: 'Payment request sent. Confirm it on your phone with your PIN.',
        kin: 'Ibisobanuro byo kwishyura byoherejwe. Emeza kuri telefone yawe ukoresheje PIN.',
        fr: 'Demande de paiement envoyée. Confirmez-la sur votre téléphone avec votre code PIN.',
      },
      status: 'unpaid',
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Payment request failed';
    updateOrderPaymentStatus(order.id, 'failed');
    return failure({ en: reason, kin: reason, fr: reason });
  }
}

/** Paypack cashin settles asynchronously: the transform to local phone format happens in paypackService. */

