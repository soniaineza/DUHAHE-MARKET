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
import { findUserByPhone, initializeStore, persistStore, upsertUser } from './data/store';
import { hashPassword, verifyPassword } from './services/authService';

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
  if (config.reviewer) {
    const existing = findUserByPhone(config.reviewer.phone);
    if (!existing) {
      upsertUser({
        id: 'usr-reviewer',
        name: 'Store Reviewer',
        phone: config.reviewer.phone,
        role: 'customer',
        createdAt: new Date().toISOString(),
        passwordHash: hashPassword(config.reviewer.password),
        reviewerManaged: true,
      });
      console.log('Store-review account created.');
    } else if (existing.reviewerManaged || existing.id === 'usr-reviewer' || existing.name === 'Store Reviewer') {
      if (!verifyPassword(config.reviewer.password, existing.passwordHash)) {
        upsertUser({
          ...existing,
          passwordHash: hashPassword(config.reviewer.password),
          passwordChangedAt: Date.now(),
          reviewerManaged: true,
        });
        console.log('Store-review account password repaired from configuration.');
      }
    } else {
      console.warn(
        'REVIEWER_PHONE belongs to an existing customer account; refusing to take it over. Change REVIEWER_PHONE or verify that account manually.'
      );
    }
  }
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