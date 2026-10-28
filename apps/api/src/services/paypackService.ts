import crypto from 'node:crypto';
import { config } from '../config';

/**
 * Paypack (payments.paypack.rw) REST client.
 * Auth: POST /auth/agents/authorize with client_id + client_secret -> JWT.
 * Tokens last ~15 minutes; refresh_token is kept for reuse.
 */

type Token = { access: string; refresh: string; expiresAt: number };

let cachedToken: Token | null = null;
let inFlight: Promise<Token> | null = null;

/** The provider could not be reached or answered with an error, so the real payment state is unknown. */
export class PaypackUnavailableError extends Error {
  constructor(message = 'Paypack is unavailable') {
    super(message);
    this.name = 'PaypackUnavailableError';
  }
}

async function request(method: 'GET' | 'POST', path: string, body: unknown, token?: string, extraHeaders: Record<string, string> = {}): Promise<any> {
  const res = await fetch(`${config.paypack.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Webhook-Mode': config.paypack.webhookMode,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...extraHeaders,
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const message = data?.message ?? data?.error ?? `Paypack request failed (${res.status})`;
    const err = new Error(typeof message === 'string' ? message : JSON.stringify(message)) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

async function authorize(): Promise<Token> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const data = await request('POST', '/auth/agents/authorize', {
      client_id: config.paypack.clientId,
      client_secret: config.paypack.clientSecret,
    });
    const expiresIn = Number(data.expires_in ?? 900);
    cachedToken = {
      access: data.access,
      refresh: data.refresh,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    return cachedToken;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

async function accessToken(): Promise<string> {
  return (await authorize()).access;
}

/** Invalidate the cached token (called after a 401 so the next call re-authenticates). */
export function clearPaypackToken(): void {
  cachedToken = null;
}

export function paypackReady(): boolean {
  return config.paypack.enabled && Boolean(config.paypack.clientId) && Boolean(config.paypack.clientSecret);
}

/**
 * Start a mobile-money cashin (customer pays us).
 * Body per docs: { amount, number } — `number` is the customer's phone in
 * local Rwandan format (07XXXXXXXX). Returns the Paypack transaction
 * reference used to match the webhook.
 */
export async function requestCashin(input: { amount: number; phone: string; idempotencyKey?: string }): Promise<{ ref: string }> {
  const token = await accessToken();
  try {
    const data = await request(
      'POST',
      '/transactions/cashin',
      {
        amount: input.amount,
        number: toLocalPhone(input.phone),
      },
      token,
      // Same key => Paypack answers with the original transaction instead of charging twice.
      input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {},
    );
    return { ref: String(data.ref ?? '') };
  } catch (err) {
    if (err instanceof Error && /\b401\b|unauthor|token/i.test(err.message)) clearPaypackToken();
    throw err;
  }
}

/** Paypack expects local Rwandan format 07XXXXXXXX (docs examples). */
export function toLocalPhone(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.startsWith('250')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  return `0${digits}`;
}

export type PaypackTransaction = {
  ref: string;
  kind: 'CASHIN' | 'CASHOUT';
  status: 'pending' | 'successful' | 'failed';
  amount: number;
  client: string;
  processedAt?: string;
};

/** Providers report a handful of spellings; fold them onto our three states. */
function normalizeStatus(raw: unknown): PaypackTransaction['status'] | null {
  const status = String(raw ?? '').toLowerCase();
  if (status === 'successful' || status === 'successfull' || status === 'success') return 'successful';
  if (status === 'failed' || status === 'cancelled' || status === 'canceled' || status === 'rejected') return 'failed';
  if (status === 'pending' || status === 'processing') return 'pending';
  return null;
}

const RANK: Record<PaypackTransaction['status'], number> = { pending: 0, failed: 1, successful: 2 };

function toTransaction(d: any, ref: string, status: PaypackTransaction['status']): PaypackTransaction {
  return {
    ref: String(d?.ref ?? ref),
    kind: d?.kind === 'CASHOUT' ? 'CASHOUT' : 'CASHIN',
    status,
    amount: Number(d?.amount ?? 0),
    client: String(d?.client ?? ''),
    processedAt: d?.processed_at ? String(d.processed_at) : undefined,
  };
}

/**
 * Look up the live state of one transaction.
 *
 * Paypack documents two read paths and neither is complete on its own:
 *  - GET /transactions/find/{ref}      (404 for many real transactions, status often absent)
 *  - GET /events/transactions?ref=...  (`transaction:created` = pending, `transaction:processed` = final)
 * We ask both and keep the most final answer: successful > failed > pending. A stale `pending`
 * from one path can therefore never hide a final status reported by the other.
 *
 * Returns null when the provider answered but knows nothing about this ref (state unknown), and
 * throws PaypackUnavailableError when no path could be reached (state unknown, retry later).
 */
export async function getTransaction(ref: string): Promise<PaypackTransaction | null> {
  if (!ref) return null;
  let token: string;
  try {
    token = await accessToken();
  } catch (err) {
    throw new PaypackUnavailableError(err instanceof Error ? err.message : undefined);
  }

  let best: PaypackTransaction | null = null;
  let answered = false;
  const consider = (tx: PaypackTransaction | null) => {
    if (tx && (!best || RANK[tx.status] > RANK[best.status])) best = tx;
  };

  try {
    const data = await request('GET', `/transactions/find/${encodeURIComponent(ref)}`, {}, token);
    answered = true;
    const status = normalizeStatus(data?.status);
    if (status) consider(toTransaction(data, ref, status));
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 404) answered = true; // reachable, just no record on this path
    else if (status === 401) clearPaypackToken();
  }

  try {
    const data = await request('GET', `/events/transactions?ref=${encodeURIComponent(ref)}`, {}, token);
    answered = true;
    const rows = Array.isArray(data?.transactions) ? data.transactions : [];
    for (const row of rows) {
      const d = row?.data ?? row ?? {};
      const status = normalizeStatus(d.status);
      if (status) consider(toTransaction(d, ref, status));
    }
  } catch (err) {
    if ((err as { status?: number })?.status === 401) clearPaypackToken();
  }

  if (!answered) throw new PaypackUnavailableError();
  return best;
}

/**
 * Verify a webhook: HMAC-SHA256 of the RAW request body keyed with the webhook
 * secret, compared (timing-safe) against the x-paypack-signature header.
 *
 * Per Paypack docs the header is the HMAC digest as a BASE64 string; hex is
 * also accepted as a tolerant fallback for older webhook revisions.
 */
export function verifySignature(rawBody: Buffer | string, signature: string | undefined): boolean {
  if (!config.paypack.webhookSecret) return false;
  if (!signature) return false;
  const body = typeof rawBody === 'string' ? Buffer.from(rawBody, 'utf8') : rawBody;
  const provided = Buffer.from(signature.trim(), 'utf8');
  const candidates = [
    crypto.createHmac('sha256', config.paypack.webhookSecret).update(body).digest('base64'),
    crypto.createHmac('sha256', config.paypack.webhookSecret).update(body).digest('hex'),
  ];
  return candidates.some((expected) => {
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (provided.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(provided, expectedBuf);
  });
}