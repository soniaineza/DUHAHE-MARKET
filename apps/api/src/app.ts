import express from 'express';
import cors from 'cors';
import { config } from './config';
import { adminRouter } from './routes/admin';
import { customerRouter } from './routes/customer';
import { publicRouter } from './routes/public';
import { errorHandler, notFound, requestLogger } from './middleware/errorHandler';
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
  app.use(cors({ origin: originAllowed }));
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api', publicRouter);
  app.use('/api', customerRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}