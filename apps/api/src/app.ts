import express from 'express';
import cors from 'cors';
import { config } from './config';
import { adminRouter } from './routes/admin';
import { customerRouter } from './routes/customer';
import { publicRouter } from './routes/public';
import { errorHandler, notFound, requestLogger } from './middleware/errorHandler';
import { seedOrders } from './data/seed';
import { initializeStore, persistStore } from './data/store';

export async function createApp() {
  await initializeStore();
  seedOrders();
  await persistStore();
  const app = express();
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json());
  app.use(requestLogger);

  app.use('/api', publicRouter);
  app.use('/api', customerRouter);
  app.use('/api/admin', adminRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}