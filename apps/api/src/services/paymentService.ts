import type { PaymentMethod, PaymentRequest, PaymentResult } from '@duhahe/shared';
import { config } from '../config';
import { orders, pushNotification, updateOrderPaymentStatus } from '../data/store';

/**
 * Payment gateway layer.
 *
 * Phase 2: replace `stubRequest` with real MTN MoMo / Airtel Money REST calls
 * (see .env.example for required credentials).
 */

function stubRequest(method: PaymentMethod, phone: string, amount: number): PaymentResult {
  // Demo gateway: a valid Rwandan-style phone number always approves, so the
  // whole checkout flow works end-to-end without moving real money.
  const digits = phone.replace(/\D/g, '');
  const success = digits.length >= 9;
  return {
    success,
    providerRequestId: `dm-${crypto.randomUUID().slice(0, 12)}`,
    message: {
      en: success ? 'Demo payment approved. No real money was moved.' : 'Invalid phone number for payment.',
      kin: success ? 'Kwishyura kwa demo kwemejwe. Nta mafaranga nyayo byakoresheje.' : 'Nomero itari iy’ikoreshwa mu kwishyura.',
      fr: success ? 'Paiement de démonstration approuvé. Aucun argent réel n’a été déplacé.' : 'Numéro invalide pour le paiement.',
    },
    status: success ? 'paid' : 'failed',
  };
}

export async function initiatePayment(req: PaymentRequest): Promise<PaymentResult> {
  const order = orders.find((o) => o.id === req.orderId);
  if (!order) {
    return {
      success: false,
      message: { en: 'Order not found', kin: 'Ibwira ntiriboneka', fr: 'Commande introuvable' },
      status: 'failed',
    };
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
  if (req.method === 'mtn_momo' && config.momo.enabled) {
    result = await mtnMomoRequest(req); // real integration in Phase 2
  } else if (req.method === 'airtel_money' && config.airtel.enabled) {
    result = await airtelRequest(req);
  } else {
    result = stubRequest(req.method, req.phone, req.amount);
  }

  updateOrderPaymentStatus(order.id, result.success ? 'paid' : 'failed');
  if (result.success && order.paymentStatus === 'paid') {
    pushNotification({
      phone: order.customer.phone,
      title: 'Payment received',
      body: `Payment of ${order.total} RWF for order ${order.orderNumber} was received.`,
      kind: 'order',
    });
  }
  return result;
}

async function mtnMomoRequest(req: PaymentRequest): Promise<PaymentResult> {
  void req;
  // Phase 2: POST to Collection API v1.0 requesttopay with Ocp-Apim-Subscription-Key
  return stubRequest(req.method, req.phone, req.amount);
}

async function airtelRequest(req: PaymentRequest): Promise<PaymentResult> {
  void req;
  // Phase 2: Airtel Money Rwanda REST API
  return stubRequest(req.method, req.phone, req.amount);
}