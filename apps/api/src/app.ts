import express from 'express';
import cors from 'cors';
import { config } from './config';
import { adminRouter } from './routes/admin';
import { customerRouter } from './routes/customer';
import { publicRouter } from './routes/public';
import { paypackWebhookRouter } from './routes/paypack';
import { errorHandler, notFound, requestLogger } from './middleware/errorHandler';
import { apiRateLimit, authRateLimit } from './middleware/rateLimit';
import { securityHeaders } from './middleware/security';
import { seedOrders } from './data/seed';
import { initializeStore, persistStore } from './data/store';

function originAllowed(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin) return callback(null, true); // native apps / curl send no Origin
  if (config.corsOrigins.includes(origin)) return callback(null, true);
  // Trust any *.vercel.app origin (preview deployments) OUTSIDE production
  // only. In production, readable responses are limited to the explicit
  // CORS_ORIGINS allow-list — an attacker-controlled Vercel site must not be
  // able to read this API from a victim's browser.
  if (!config.isProduction) {
    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith('.vercel.app')) return callback(null, true);
    } catch {
      // malformed origin — reject
    }
  }
  callback(null, false);
}

export async function createApp() {
  await initializeStore();
  if (config.demoMode) {
    seedOrders();
  }
  await persistStore();
  const app = express();
  app.set('trust proxy', 1); // Render/Vercel sit in front of the app; use X-Forwarded-For for req.ip
  app.disable('x-powered-by'); // do not advertise the framework
  app.use(securityHeaders);
  app.use(cors({ origin: originAllowed }));

  // Paypack signs the raw request body, so it must be parsed BEFORE express.json().
  app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '1mb' }));

  app.use(requestLogger);
  // Baseline flood protection for every endpoint (webhooks/health excluded).
  app.use(apiRateLimit);
  // Explicit, conservative body limit (the webhook raw parser has its own).
  app.use(express.json({ limit: '100kb' }));

  // Brute-force protection on auth endpoints (admin login + customer OTP flows)
  app.use('/api/admin/auth', authRateLimit);
  app.use('/api/auth', authRateLimit);

  app.use('/api/webhooks', paypackWebhookRouter);
  app.use('/api', publicRouter);
  app.use('/api', customerRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}