import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

const envCandidates = [path.resolve(process.cwd(), '.env'), path.resolve(process.cwd(), 'apps/api/.env')];
const envFile = envCandidates.find((candidate) => fs.existsSync(candidate));
dotenv.config(envFile ? { path: envFile } : undefined);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: process.env.HOST ?? '0.0.0.0',
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  mongo: {
    uri: process.env.MONGO_URI ?? '',
    database: process.env.MONGO_DATABASE ?? 'duhahe_market',
  },
  admin: {
    email: process.env.ADMIN_EMAIL ?? 'admin@duhahe.rw',
    password: process.env.ADMIN_PASSWORD ?? 'admin123',
    name: process.env.ADMIN_NAME ?? 'Esperance Mukabaranga',
  },
  momo: {
    enabled: process.env.MTN_MOMO_ENABLED === 'true',
    baseUrl: process.env.MTN_MOMO_BASE_URL ?? 'https://sandbox.momodeveloper.mtn.com',
    apiUser: process.env.MTN_MOMO_API_USER ?? '',
    apiKey: process.env.MTN_MOMO_API_KEY ?? '',
    subscriptionKey: process.env.MTN_MOMO_SUBSCRIPTION_KEY ?? '',
    payeePhone: process.env.MTN_MOMO_PAYEE_PHONE ?? '250788000000',
  },
  airtel: {
    enabled: process.env.AIRTEL_MONEY_ENABLED === 'true',
    baseUrl: process.env.AIRTEL_BASE_URL ?? 'https://www.airtel.co.rw',
    clientId: process.env.AIRTEL_CLIENT_ID ?? '',
    clientSecret: process.env.AIRTEL_CLIENT_SECRET ?? '',
  },
} as const;

export const DELIVERY_FEE_KIGALI = 1000;
export const DELIVERY_FEE_PROVINCE = 2500;
export const KIGALI_DISTRICTS = ['Kicukiro', 'Gasabo', 'Nyarugenge'];