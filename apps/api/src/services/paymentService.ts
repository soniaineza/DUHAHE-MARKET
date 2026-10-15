import type { PaymentMethod, PaymentRequest, PaymentResult } from '@duhahe/shared';
import { config } from '../config';
import { orders, pushNotification, updateOrderPaymentStatus } from '../data/store';
import { paypackReady, requestCashin } from './paypackService';

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

function stubRequest(method: PaymentMethod, phone: string, amount: number): PaymentResult {
  // Demo gateway: a valid Rwandan-style phone number always approves, so the
  // whole checkout flow works end-to-end without moving real money.
  const digits = phone.replace(/\D/g, '');
  const success = digits.length >= 9;
  return {
    success,
    providerRequestId: `dm-${crypto.randomUUID().slice(0, 12)}`,
    message: {
      en: success ? `Demo payment of ${amount} RWF approved. No real money was moved.` : 'Invalid phone number for payment.',
      kin: success ? `Kwishyura kwa demo kwa ${amount} RWF kwemejwe. Nta mafaranga nyayo byakoresheje.` : 'Nomero itari iy’ikoreshwa mu kwishyura.',
      fr: success ? `Paiement de démonstration de ${amount} RWF approuvé. Aucun argent réel n’a été déplacé.` : 'Numéro invalide pour le paiement.',
    },
    status: success ? 'paid' : 'failed',
  };
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
      message: { en: 'You will pay cash on delivery.', kin: 'Uzishyura iyo baraguhereje.', fr: 'Vous paierez à la livraison.' },
      status: 'unpaid',
    };
  }

  let result: PaymentResult;
  if (paypackReady() && (req.method === 'mtn_momo' || req.method === 'airtel_money')) {
    result = await paypackCashin(order.id, expected); // real mobile-money money movement via Paypack
  } else if (req.method === 'mtn_momo' && config.momo.enabled) {
    result = await mtnMomoRequest(order.customer.phone, expected); // direct MTN collection (Phase 2)
  } else if (req.method === 'airtel_money' && config.airtel.enabled) {
    result = await airtelRequest(order.customer.phone, expected); // Phase 2
  } else {
    result = stubRequest(req.method, order.customer.phone, expected);
  }

  if (result.status === 'failed') {
    // Hard failure recorded; Paypack flows that stay asynchronous settle via
    // the webhook (which re-verifies the amount against order.total).
    updateOrderPaymentStatus(order.id, 'failed', result.providerRequestId);
  } else if (result.status === 'paid') {
    // Synchronous gateway (demo stub / Phase 2 direct APIs) approved the exact
    // order total above, so the order is settled now.
    updateOrderPaymentStatus(order.id, 'paid', result.providerRequestId);
    pushNotification({
      phone: order.customer.phone,
      title: 'Payment received',
      body: `Payment of ${order.total} RWF for order ${order.orderNumber} was received.`,
      kind: 'order',
    });
  }
  return result;
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

async function mtnMomoRequest(phone: string, amount: number): Promise<PaymentResult> {
  // Phase 2: POST to Collection API v1.0 requesttopay with Ocp-Apim-Subscription-Key
  return stubRequest('mtn_momo', phone, amount);
}

async function airtelRequest(phone: string, amount: number): Promise<PaymentResult> {
  // Phase 2: Airtel Money Rwanda REST API
  return stubRequest('airtel_money', phone, amount);
}
