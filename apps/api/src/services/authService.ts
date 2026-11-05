import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { CustomerUser } from '../data/store';

/** Constant-time string compare (hash first so length differences leak nothing). */
function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

/** Hash a customer password with scrypt. Format: `<saltHex>:<hashHex>`. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/** Verify a password against a stored `salt:hash` value in constant time. */
export function verifyPassword(password: string, stored: string | undefined): boolean {
  if (!stored) return false;
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export interface AdminTokenPayload {
  sub: string;
  email: string;
  name: string;
  role: 'admin';
}

export interface CustomerTokenPayload {
  sub: string;
  phone: string;
  name: string;
  role: 'customer';
}

const JWT_ISSUER = 'duhahe-api';
const VERIFY_OPTS: jwt.VerifyOptions = { algorithms: ['HS256'], issuer: JWT_ISSUER };
/** Admin sessions are short-lived; the admin UI also signs out after inactivity. */
const ADMIN_TOKEN_TTL = '2h';

/**
 * Server-side revocation list (token id -> expiry ms). Logging out revokes the
 * token so a copied/cached token cannot be replayed afterwards.
 */
const revoked = new Map<string, number>();

export function revokeToken(token: string): void {
  const decoded = jwt.decode(token) as { jti?: string; exp?: number } | null;
  if (!decoded?.jti) return;
  const now = Date.now();
  for (const [id, exp] of revoked) if (exp < now) revoked.delete(id);
  revoked.set(decoded.jti, (decoded.exp ?? 0) * 1000 || now + 24 * 3600 * 1000);
}

function isRevoked(payload: { jti?: string }): boolean {
  return !!payload.jti && revoked.has(payload.jti);
}

export function verifyAdminCredentials(email: string, password: string): { token: string; admin: AdminTokenPayload } | null {
  // Both comparisons are constant-time so response timing cannot be used to
  // guess the admin email or password byte by byte.
  if (!safeEqual(email.toLowerCase(), config.admin.email.toLowerCase())) return null;
  if (!safeEqual(password, config.admin.password)) return null;
  const payload: AdminTokenPayload = {
    sub: 'admin-1',
    email: config.admin.email,
    name: config.admin.name,
    role: 'admin',
  };
  const token = jwt.sign(payload, config.jwtSecret, { algorithm: 'HS256', issuer: JWT_ISSUER, jwtid: crypto.randomUUID(), expiresIn: ADMIN_TOKEN_TTL });
  return { token, admin: payload };
}

export function verifyToken(token: string): AdminTokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, VERIFY_OPTS) as AdminTokenPayload & { jti?: string };
    if (isRevoked(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function signCustomerToken(user: CustomerUser): string {
  return jwt.sign(
    { sub: user.id, phone: user.phone, name: user.name, role: 'customer' as const },
    config.jwtSecret,
    { algorithm: 'HS256', issuer: JWT_ISSUER, jwtid: crypto.randomUUID(), expiresIn: '30d' }
  );
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    const payload = jwt.verify(token, config.jwtSecret, VERIFY_OPTS) as CustomerTokenPayload & { jti?: string };
    if (payload.role !== 'customer' || isRevoked(payload)) return null;
    return payload;
  } catch {
    return null;
  }
}