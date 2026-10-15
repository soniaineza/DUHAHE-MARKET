/**
 * Durability test against an ephemeral, local-only MongoDB (mongodb-memory-server).
 *
 * Verifies the data-loss fixes end to end:
 *  1. writes reach MongoDB (upsert sync, no delete-all window);
 *  2. data survives a HARD CRASH (taskkill /F — no graceful flush) + reboot;
 *  3. restart reloads everything from MongoDB;
 *  4. deletes propagate ($nin cleanup after upserts);
 *  5. DEMO_MODE pointed at a real database NEVER overwrites it.
 *
 * Runs on a scratch DB on 127.0.0.1 — it never touches any remote database.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn, spawnSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { MongoClient } from 'mongodb';

const API_PORT = 4124;
const MONGO_PORT = 27011;
const MONGO_DB = 'duhahe_smoke';
const URI = `mongodb://127.0.0.1:${MONGO_PORT}/${MONGO_DB}`;
const BASE = `http://127.0.0.1:${API_PORT}/api`;
const PHONE = '0788000111';
const SKU = 'DUR-TEST-01';

let failures = 0;
function check(name, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : ` — ${detail}`}`);
  if (!cond) failures += 1;
}

const baseEnv = {
  ...process.env,
  MONGO_URI: URI,
  MONGO_URL: '',
  MONGO_DATABASE: MONGO_DB,
  NODE_ENV: 'development',
  DEMO_MODE: 'false',
  PORT: String(API_PORT),
  JWT_SECRET: 'durability-test-secret-0123456789abcdef',
  ADMIN_EMAIL: 'admin@duhahe.rw',
  ADMIN_PASSWORD: 'Durability-Test-Pass-1',
  PAYPACK_ENABLED: 'false',
  MTN_MOMO_ENABLED: 'false',
  AIRTEL_MONEY_ENABLED: 'false',
  CORS_ORIGINS: 'http://localhost:5173',
};

let api = null;

function startApi(extraEnv = {}) {
  api = spawn('npx', ['tsx', 'apps/api/src/server.ts'], {
    cwd: process.cwd(),
    env: { ...baseEnv, ...extraEnv },
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout.on('data', (d) => process.stdout.write(`[api] ${d}`));
  api.stderr.on('data', (d) => process.stderr.write(`[api:err] ${d}`));
  api.on('exit', () => {
    api = null;
  });
}

async function waitHealth(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return true;
    } catch {
      /* not up yet */
    }
    await sleep(400);
  }
  return false;
}

function killApiHard() {
  if (!api) return;
  spawnSync('taskkill', ['/PID', String(api.pid), '/F', '/T']);
  api = null;
  return sleep(700);
}

async function apiReq(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body: parsed };
}

async function main() {
  console.log('Starting ephemeral MongoDB (downloads a mongod binary on first use)…');
  const mem = await MongoMemoryServer.create({ instance: { port: MONGO_PORT } });
  console.log('mongod up at', mem.getUri());

  const mc = new MongoClient(URI);
  await mc.connect();
  const db = mc.db(MONGO_DB);

  let token = '';
  let orderId = '';
  let productId = '';

  try {
    // ---------- Phase 1: normal operation, then HARD CRASH ----------
    console.log('\n--- phase 1: writes reach MongoDB, survive a hard crash ---');
    startApi();
    check('API boots with DEMO_MODE=false against Mongo', await waitHealth());

    const login = await apiReq('/admin/auth/login', { method: 'POST', body: { email: baseEnv.ADMIN_EMAIL, password: baseEnv.ADMIN_PASSWORD } });
    token = login.body?.data?.token ?? '';
    check('admin login', !!token);

    const prod = await apiReq('/admin/inventory', {
      method: 'POST',
      token,
      body: {
        sku: SKU,
        category: 'staples',
        name: { en: 'Durability Bean', kin: 'Durability Bean', fr: 'Durability Bean' },
        description: { en: 'd', kin: 'd', fr: 'd' },
        price: 500,
        unit: 'kg',
        stockQty: 10,
        minOrderQty: 1,
        step: 1,
      },
    });
    productId = prod.body?.data?.id ?? '';
    check('product created', prod.status === 201 && !!productId, JSON.stringify(prod.body));

    const order = await apiReq('/orders', {
      method: 'POST',
      body: {
        items: [{ productId, qty: 2 }],
        customer: { name: 'Durability Test', phone: PHONE, district: 'Gasabo' },
        paymentMethod: 'cash_on_delivery',
      },
    });
    orderId = order.body?.data?.id ?? '';
    check('order created', order.status === 201 && !!orderId, JSON.stringify(order.body));

    await sleep(1600); // > debounce window → sync must have run

    const mongoOrder1 = await db.collection('orders').findOne({ id: orderId });
    check('order persisted to MongoDB', !!mongoOrder1);
    const mongoProd1 = await db.collection('products').findOne({ id: productId });
    check('product persisted to MongoDB', !!mongoProd1);
    const orderCount = await db.collection('orders').countDocuments();
    check('no demo/seed rows written to the real DB (exactly 1 order)', orderCount === 1, `count=${orderCount}`);

    await killApiHard(); // SIGKILL-equivalent: no graceful flush runs
    const mongoOrder2 = await db.collection('orders').findOne({ id: orderId });
    check('order still in MongoDB after hard crash', !!mongoOrder2);
    const mongoProd2 = await db.collection('products').findOne({ id: productId });
    check('product still in MongoDB after hard crash', !!mongoProd2);

    // ---------- Phase 2: reboot reloads from Mongo; deletes propagate ----------
    console.log('\n--- phase 2: reboot reloads data; deletes propagate ---');
    startApi();
    check('API reboots', await waitHealth());

    const recent = await apiReq(`/orders/${PHONE}/recent`);
    const reloaded = (recent.body?.data ?? []).find((o) => o.id === orderId);
    check('order reloaded from MongoDB after restart', !!reloaded, JSON.stringify(recent.body)?.slice(0, 200));
    const products = await apiReq('/products?search=Durability');
    check('product reloaded from MongoDB after restart', (products.body?.data ?? []).some((p) => p.id === productId));

    const login2 = await apiReq('/admin/auth/login', { method: 'POST', body: { email: baseEnv.ADMIN_EMAIL, password: baseEnv.ADMIN_PASSWORD } });
    token = login2.body?.data?.token ?? '';
    const del = await apiReq(`/admin/inventory/${productId}`, { method: 'DELETE', token });
    check('product deleted via admin', del.status === 200, JSON.stringify(del.body));
    await sleep(1600);
    const mongoProdGone = await db.collection('products').findOne({ id: productId });
    check('deleted product removed from MongoDB ($nin cleanup)', !mongoProdGone);
    const mongoOrder3 = await db.collection('orders').findOne({ id: orderId });
    check('unrelated order untouched by the delete sync', !!mongoOrder3);
    killApiHard();
    await sleep(300);

    // ---------- Phase 3: DEMO_MODE must never write to a real database ----------
    console.log('\n--- phase 3: DEMO_MODE against a real DB is read-only ---');
    startApi({ DEMO_MODE: 'true' });
    check('API boots in demo mode', await waitHealth());
    await sleep(1600);
    const countAfterDemo = await db.collection('orders').countDocuments();
    check('demo mode did not overwrite DB orders', countAfterDemo === 1, `count=${countAfterDemo}`);
    const prodCount = await db.collection('products').countDocuments();
    // 163 catalog items + 1 custom test product − 1 deleted = 163
    check('demo mode did not touch DB products', prodCount === 163, `count=${prodCount} (expected 163)`);
    killApiHard();
  } finally {
    await mc.close().catch(() => {});
    await mem.stop().catch(() => {});
  }

  console.log(`\n${failures === 0 ? 'ALL DURABILITY CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('DURABILITY TEST CRASHED:', err);
  process.exit(1);
});
