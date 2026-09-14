import { createApp } from './app';
import { config } from './config';

async function start() {
  const app = await createApp();
  app.listen(config.port, config.host, () => {
    console.log(`🌿 Duhahe API listening on http://${config.host}:${config.port}`);
    console.log(`   Products ready • Admin demo login: ${config.admin.email} / ${config.admin.password}`);
  });
}

start().catch((error) => {
  console.error('Failed to start Duhahe API:', error);
  process.exit(1);
});