/** Shared sign-up rules, so the app and the API always agree. */

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  digit: boolean;
  symbol: boolean;
}

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    symbol: /[^A-Za-z0-9\s]/.test(password),
  };
}

/** 8+ characters with an uppercase letter, a lowercase letter, a number and a symbol. */
export function isStrongPassword(password: string): boolean {
  return Object.values(checkPassword(password)).every(Boolean);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isValidEmail(value: unknown): boolean {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_RE.test(email);
}

/**
 * Canonical Rwandan mobile number: 250 + 9 digits (e.g. 250788123456). Accepts 0788123456, 788123456,
 * 250788123456 and +250 788 123 456. Returns null when it is not a valid Rwandan mobile number
 * (MTN 078/079, Airtel 072/073).
 */
export function canonicalRwandaPhone(value: unknown): string | null {
  const digits = String(value ?? '').replace(/\D/g, '');
  let national: string;
  if (digits.length === 12 && digits.startsWith('250')) national = digits.slice(3);
  else if (digits.length === 10 && digits.startsWith('0')) national = digits.slice(1);
  else if (digits.length === 9) national = digits;
  else return null;
  return /^7[2389]\d{7}$/.test(national) ? `250${national}` : null;
}
