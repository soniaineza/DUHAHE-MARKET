import type { PaymentStatus } from './types';

/** What the payment page is showing. */
export type PaymentPhase = 'sending' | 'waiting' | 'success' | 'cancelled' | 'unresolved' | 'error';

/** Response of GET /payments/status/:orderId (the backend is the only source of truth). */
export interface PaymentSyncResponse {
  /**
   * `paid` when the order is settled (by any attempt). Otherwise it describes the attempt that was
   * asked about: `failed` when THAT attempt failed, `unpaid` while it is pending/unknown.
   */
  status: PaymentStatus;
  /** The attempt this answer is about. The client ignores answers for any other attempt. */
  attemptId?: string;
  providerStatus?: 'pending' | 'successful' | 'failed';
  providerReference?: string;
  requestedAt?: string;
  /** The backend could not reach the provider on this check; the real state is unknown. */
  unavailable?: boolean;
  amountMismatch?: boolean;
}

/**
 * Paypack reports a prompt that is cancelled on the phone within seconds, but a prompt that is
 * merely dismissed or ignored only fails after the mobile network times it out (~12 minutes
 * observed, occasionally up to an hour). We keep waiting for the provider's answer for this long
 * before telling the customer we cannot confirm - we never turn a timer into a "failed" verdict.
 */
export const UNRESOLVED_AFTER_MS = 15 * 60 * 1000;

export interface PhaseDecision {
  phase: PaymentPhase;
  /** Stop polling: the outcome is final or needs a manual re-check. */
  stopPolling: boolean;
  /** The last check could not reach the provider; show a quiet "still trying" hint. */
  degraded: boolean;
}

/**
 * Map one backend status response to the next UI phase.
 *  - success  only when the backend says `paid` (it verified the amount with the provider)
 *  - cancelled only when the backend recorded the provider's final `failed`
 *  - anything else keeps waiting; after UNRESOLVED_AFTER_MS it becomes "unresolved", never "failed"
 */
export function decidePhase(res: PaymentSyncResponse, waitedMs: number): PhaseDecision {
  if (res.status === 'paid') return { phase: 'success', stopPolling: true, degraded: false };
  if (res.status === 'refunded') return { phase: 'success', stopPolling: true, degraded: false };
  if (res.status === 'failed') return { phase: 'cancelled', stopPolling: true, degraded: false };
  if (res.amountMismatch) return { phase: 'unresolved', stopPolling: true, degraded: false };
  if (waitedMs >= UNRESOLVED_AFTER_MS) {
    return { phase: 'unresolved', stopPolling: true, degraded: !!res.unavailable };
  }
  return { phase: 'waiting', stopPolling: false, degraded: !!res.unavailable };
}

/** Poll quickly at first (a phone-side cancel is reported in seconds), then ease off. */
export function pollDelayMs(waitedMs: number): number {
  if (waitedMs < 2 * 60 * 1000) return 2500;
  if (waitedMs < 5 * 60 * 1000) return 5000;
  return 10000;
}
