import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const envCandidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'apps/api/.env')];
const envFile = envCandidates.find((candidate) => fs.existsSync(candidate));
dotenv.config(envFile ? { path: envFile } : undefined);

/** Clean common paste mistakes from dashboard/env-file values (quotes, stray spaces). */
function cleanEnvValue(value: string | undefined): string {
  return (value ?? '').trim().replace(/^["']+|["']+$/g, '');
}

/**
 * Brevo shows API keys either as `xkeysib-...` or wrapped as base64 of {"api_key":"xkeysib-..."}. The API only
 * accepts the inner key, so accept both forms here and the wrong paste can never break email.
 */
export function unwrapApiKey(raw: string): string {
  const value = (raw ?? '').trim();
  if (!value.startsWith('eyJ')) return value;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as { api_key?: unknown };
    return typeof parsed.api_key === 'string' ? parsed.api_key.trim() : value;
  } catch {
    return value;
  }
}

/** Origins that must always work, regardless of what the host's CORS_ORIGINS says. */
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'https://duhaherwandamarket.store',
  'https://www.duhaherwandamarket.store',
  'https://admin.duhaherwandamarket.store',
  'https://duhahe-admin.vercel.app',
];

function parseCorsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_CORS_ORIGINS, ...fromEnv]));
}

/**
 * Optional store-review account (Apple App Review / Google Play). Created at startup ONLY when both variables
 * are set. It is a normal customer account with no extra privileges, and its orders are forced to cash on
 * delivery so a reviewer can never trigger a real mobile-money charge.
 */
const reviewerPhone = (process.env.REVIEWER_PHONE ?? '').replace(/\D/g, '');
const reviewerPassword = process.env.REVIEWER_PASSWORD ?? '';

export const config = {
  reviewer: reviewerPhone.length >= 9 && reviewerPassword.length >= 8 ? { phone: reviewerPhone, password: reviewerPassword } : null,
  /**
   * Verification-code delivery. Email uses any SMTP account (a Gmail address with an "app password" works).
   * SMS uses Africa's Talking. Without email settings, new sign-ups are refused in production.
   */
  notify: {
    /**
     * Email over HTTPS through Brevo's API. Preferred on hosts that block outgoing SMTP ports (Render's free plan
     * blocks 25/465/587). EMAIL_FROM must be a sender address verified in the Brevo dashboard.
     */
    brevo: {
      apiKey: unwrapApiKey(cleanEnvValue(process.env.BREVO_API_KEY)),
      from: cleanEnvValue(process.env.EMAIL_FROM),
      fromName: cleanEnvValue(process.env.EMAIL_FROM_NAME) || 'Duhahe Rwanda Market',
      baseUrl: (process.env.BREVO_BASE_URL ?? 'https://api.brevo.com').replace(/\/+$/, ''),
    },
    smtp: {
      host: cleanEnvValue(process.env.SMTP_HOST),
      port: Number(process.env.SMTP_PORT ?? 465),
      /** TLS from the first byte (port 465). Set SMTP_SECURE=false for STARTTLS ports such as 587. */
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : Number(process.env.SMTP_PORT ?? 465) === 465,
      user: cleanEnvValue(process.env.SMTP_USER),
      pass: cleanEnvValue(process.env.SMTP_PASS),
      from: cleanEnvValue(process.env.SMTP_FROM) || cleanEnvValue(process.env.SMTP_USER),
    },
    sms: {
      username: cleanEnvValue(process.env.AT_USERNAME),
      apiKey: cleanEnvValue(process.env.AT_API_KEY),
      senderId: cleanEnvValue(process.env.AT_SENDER_ID),
      baseUrl: process.env.AT_BASE_URL ?? 'https://api.africastalking.com',
    },
  },
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isProduction: (process.env.NODE_ENV ?? '').toLowerCase() === 'production',
  corsOrigins: parseCorsOrigins(),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  /**
   * DEMO_MODE=false (default, owner/production config):
   *   MongoDB is REQUIRED. If it cannot be reached the API refuses to start -
   *   no silent fallback to the in-memory demo store.
   * DEMO_MODE=true (explicit, dev only):
   *   Allows clearly-labelled offline/demo runs on the in-memory store.
   */
  demoMode: process.env.DEMO_MODE === 'true',
  mongo: {
    // Accept MONGO_URI (preferred) with MONGO_URL as a common misspelling fallback.
    // Uses || (not ??) so an empty-string MONGO_URI also falls back to MONGO_URL.
    uri: cleanEnvValue(process.env.MONGO_URI) || cleanEnvValue(process.env.MONGO_URL),
    database: process.env.MONGO_DATABASE ?? 'duhahe_market',
  },
  admin: {
    email: cleanEnvValue(process.env.ADMIN_EMAIL) || 'admin@duhahe.rw',
    password: cleanEnvValue(process.env.ADMIN_PASSWORD) || 'admin123',
    name: cleanEnvValue(process.env.ADMIN_NAME) || 'Esperance Mukabaranga',
  },
  momo: {
    enabled: process.env.MTN_MOMO_ENABLED === 'true',
    baseUrl: process.env.MTN_MOMO_BASE_URL ?? 'https://sandbox.momodeveloper.mtn.com',
    apiUser: process.env.MTN_MOMO_API_USER ?? '',
    apiKey: process.env.MTN_MOMO_API_KEY ?? '',
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY ?? '',
    payeePhone: process.env.MTN_MOMO_PAYEE_PHONE ?? '250799659605',
    payeeCode: process.env.MTN_MOMO_PAYEE_CODE ?? '99958',
  },
  paypack: {
    enabled: process.env.PAYPACK_ENABLED === 'true',
    baseUrl: process.env.PAYPACK_BASE_URL ?? 'https://payments.paypack.rw/api',
    clientId: cleanEnvValue(process.env.PAYPACK_CLIENT_ID),
    clientSecret: cleanEnvValue(process.env.PAYPACK_CLIENT_SECRET),
    /** HMAC key shown on the webhook card in the Paypack dashboard. */
    webhookSecret: cleanEnvValue(process.env.PAYPACK_WEBHOOK_SIGN_KEY),
    /** Must match the webhook mode configured on the dashboard. */
    webhookMode: process.env.PAYPACK_WEBHOOK_MODE === 'production' ? 'production' : 'development',
    /** Public HTTPS URL of this API, used to build the webhook URL to register. */
    publicUrl: (process.env.PUBLIC_URL ?? '').replace(/\/+$/, ''),
  },
  airtel: {
    enabled: process.env.AIRTEL_MONEY_ENABLED === 'true',
    baseUrl: process.env.AIRTEL_BASE_URL ?? 'https://www.airtel.co.rw',
    clientId: process.env.AIRTEL_CLIENT_ID ?? '',
    clientSecret: process.env.AIRTEL_CLIENT_SECRET ?? '',
  },
} as const;

/** Secrets that must never reach production (development defaults / obvious placeholders). */
const INSECURE_VALUES = new Set([
  'dev-secret-change-me',
  'change-me',
  'changeme',
  'secret',
  'password',
  'admin123',
  'jwt-secret',
  'supersecret',
]);

/**
 * Refuse to start with a configuration that would be unsafe (or silently lose
 * data) in production. Called by the server before anything else runs.
 * Throws with actionable guidance so the fix is an env-var edit, not a redeploy
 * of code.
 */
export function assertRuntimeConfig(): void {
  if (!config.isProduction) return;
  const problems: string[] = [];

  if (config.demoMode) {
    problems.push(
      'DEMO_MODE=true is set: demo mode runs on in-memory data and DISABLES database persistence — every restart would lose data. Unset it.'
    );
  }

  const jwt = (config.jwtSecret ?? '').trim();
  if (!jwt || INSECURE_VALUES.has(jwt.toLowerCase()) || jwt.toLowerCase().includes('change-me')) {
    problems.push('JWT_SECRET is missing or still a development default — set a long random value (32+ chars) on the host.');
  } else if (jwt.length < 16) {
    problems.push(`JWT_SECRET is only ${jwt.length} characters long — use at least 16 (ideally 32+) random characters.`);
  } else if (jwt.length < 32) {
    console.warn(`WARNING: JWT_SECRET is ${jwt.length} chars; 32+ random characters is recommended.`);
  }

  const adminPassword = (config.admin.password ?? '').trim();
  if (!adminPassword || INSECURE_VALUES.has(adminPassword.toLowerCase()) || adminPassword.length < 8) {
    problems.push(
      'ADMIN_PASSWORD is missing, a known default (e.g. admin123), or shorter than 8 characters — set a strong password on the host.'
    );
  }

  const brevoReady = !!(config.notify.brevo.apiKey && config.notify.brevo.from);
  const smtpReady = !!(config.notify.smtp.host && config.notify.smtp.user && config.notify.smtp.pass);
  if (!brevoReady && !smtpReady) {
    console.warn(
      'WARNING: email is not configured (set BREVO_API_KEY + EMAIL_FROM, or SMTP_HOST / SMTP_USER / SMTP_PASS). New customers cannot sign up until it is, because verification codes cannot be sent.'
    );
  } else {
    console.log(`Email delivery: ${brevoReady ? 'Brevo API (HTTPS)' : 'SMTP ' + config.notify.smtp.host + ':' + config.notify.smtp.port}`);
  }

  if (problems.length) {
    throw new Error(`Refusing to start in production — insecure configuration:\n - ${problems.join('\n - ')}`);
  }
}

export const DELIVERY_FEE_KIGALI = 1000;
export const DELIVERY_FEE_PROVINCE = 2500;
export const KIGALI_DISTRICTS = ['Kicukiro', 'Gasabo', 'Nyarugenge'];