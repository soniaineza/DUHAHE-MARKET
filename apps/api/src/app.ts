import express from 'express';
import cors from 'cors';
import { config } from './config';
import { adminRouter } from './routes/admin';
import { customerRouter } from './routes/customer';
import { publicRouter } from './routes/public';
import { errorHandler, notFound, requestLogger } from './middleware/errorHandler';
import { authRateLimit } from './middleware/rateLimit';
import { seedOrders } from './data/seed';
import { initializeStore, persistStore } from './data/store';

function originAllowed(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
  if (!origin) return callback(null, true);
  if (config.corsOrigins.includes(origin)) return callback(null, true);
  try {
    const hostname = new URL(origin).hostname;
    if (hostname.endsWith('.vercel.app')) return callback(null, true);
  } catch {
    // malformed origin — reject
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
  app.use(cors({ origin: originAllowed }));
  app.use(express.json());
  app.use(requestLogger);

  // Brute-force protection on auth endpoints (admin login + customer OTP flows)
  app.use('/api/admin/auth', authRateLimit);
  app.use('/api/auth', authRateLimit);

  app.use('/api', publicRouter);
  app.use('/api', customerRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}