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

async function request(method: 'GET' | 'POST', path: string, body: unknown, token?: string): Promise<any> {
  const res = await fetch(`${config.paypack.baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Webhook-Mode': config.paypack.webhookMode,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
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
export async function requestCashin(input: { amount: number; phone: string }): Promise<{ ref: string }> {
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
};

/** Fallback poll used when a webhook is missed. */
export async function getTransaction(ref: string): Promise<PaypackTransaction | null> {
  const token = await accessToken();
  try {
    const data = await request('GET', '/events/transactions?ref=' + encodeURIComponent(ref), {}, token);
    const rows = Array.isArray(data?.transactions) ? data.transactions : [];
    const processed = rows.find((t: any) => t?.data?.status) ?? rows[rows.length - 1];
    const d = processed?.data ?? {};
    if (!d.status) return null;
    return {
      ref: String(d.ref ?? ref),
      kind: d.kind,
      status: d.status,
      amount: Number(d.amount ?? 0),
      client: String(d.client ?? ''),
    };
  } catch {
    return null;
  }
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