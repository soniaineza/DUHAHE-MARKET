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

export function login(email: string, password: string): { token: string; admin: AdminTokenPayload } | null {
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
  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '12h' });
  return { token, admin: payload };
}

export function verifyToken(token: string): AdminTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as AdminTokenPayload;
  } catch {
    return null;
  }
}

export function signCustomerToken(user: CustomerUser): string {
  return jwt.sign(
    { sub: user.id, phone: user.phone, name: user.name, role: 'customer' as const },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

export function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    return jwt.verify(token, config.jwtSecret) as CustomerTokenPayload;
  } catch {
    return null;
  }
}