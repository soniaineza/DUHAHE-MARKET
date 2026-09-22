import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { CustomerUser } from '../data/store';

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
  if (email.toLowerCase() !== config.admin.email.toLowerCase()) return null;
  if (password !== config.admin.password) return null;
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