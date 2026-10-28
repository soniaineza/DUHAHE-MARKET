import { createApp } from './app';
import { assertRuntimeConfig, config } from './config';
import { closeDatabase } from './data/database';
import { flushStore } from './data/store';
import { startPaymentReconciler } from './services/paymentService';

async function start() {
  // Fail fast on unsafe production config (default secrets, DEMO_MODE, …)
  // BEFORE binding the port, so a bad deploy can never serve traffic.
  assertRuntimeConfig();

  const app = await createApp();
  startPaymentReconciler(); // re-checks open payment attempts even if no webhook ever arrives
  const server = app.listen(config.port, config.host, () => {
    console.log(`🌿 Duhahe API listening on http://${config.host}:${config.port}`);
    // Never log secrets: the admin password lives only in ADMIN_PASSWORD.
    console.log(`   Admin login: ${config.admin.email} (password from the ADMIN_PASSWORD env var)`);
  });

  // Graceful shutdown (Render sends SIGTERM on deploy/restart): flush pending
  // writes to MongoDB and close the connection so no data is left in memory.
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received — flushing data and closing connections…`);
    server.close();
    const forceExit = setTimeout(() => {
      console.error('Shutdown timed out — exiting.');
      process.exit(1);
    }, 8000);
    forceExit.unref();
    try {
      await flushStore();
      await closeDatabase();
      clearTimeout(forceExit);
      console.log('Shutdown complete.');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((error) => {
  console.error('Failed to start Duhahe API:', error);
  process.exit(1);
});
