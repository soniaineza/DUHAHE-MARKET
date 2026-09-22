import { MongoClient, ServerApiVersion, type Db } from 'mongodb';
import { config } from '../config';

let client: MongoClient | null = null;
let database: Db | null = null;

export class MongoRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MongoRequiredError';
  }
}

function databaseLabel(): string {
  return `MongoDB required but unavailable. Nothing was seeded and the API will not start.\n` +
    `Please check that MONGO_URI/MONGO_DATABASE in apps/api/.env point to a reachable cluster.\n` +
    `If using MongoDB Atlas, add this machine's public IP to the cluster IP Access List.\n` +
    `(Developer-only fallback: set DEMO_MODE=true in apps/api/.env to run a clearly-labelled in-memory demo.)`;
}

export async function connectDatabase(): Promise<Db | null> {
  if (database) return database;
  if (!config.mongo.uri || config.mongo.uri.includes('<') || config.mongo.uri.includes('>')) {
    if (config.demoMode) {
      console.warn('DEMO MODE: MongoDB is not configured; using the in-memory demo store.');
      return null;
    }
    throw new MongoRequiredError('MONGO_URI is not set or still contains placeholders. ' + databaseLabel());
  }

  try {
    client = new MongoClient(config.mongo.uri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      serverSelectionTimeoutMS: 15000,
    });
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    database = client.db(config.mongo.database);
    console.log(`MongoDB connected (${config.mongo.database})`);
    return database;
  } catch (error) {
    await client?.close().catch(() => {});
    client = null;
    const detail = error instanceof Error ? error.message : 'Connection failed';
    if (config.demoMode) {
      console.warn(`DEMO MODE: MongoDB unavailable; using the in-memory demo store. ${detail}`);
      return null;
    }
    throw new MongoRequiredError(`MongoDB connection failed: ${detail}. ${databaseLabel()}`);
  }
}

export function getDatabase(): Db | null {
  return database;
}

export async function closeDatabase(): Promise<void> {
  await client?.close();
  client = null;
  database = null;
}