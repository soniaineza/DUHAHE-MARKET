import { MongoClient, ServerApiVersion, type Db } from 'mongodb';
import { config } from '../config';

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDatabase(): Promise<Db | null> {
  if (database) return database;
  if (!config.mongo.uri || config.mongo.uri.includes('<') || config.mongo.uri.includes('>')) {
    console.warn('MongoDB is not configured; using the in-memory store.');
    return null;
  }

  try {
    client = new MongoClient(config.mongo.uri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
      serverSelectionTimeoutMS: 10000,
    });
    await client.connect();
    await client.db('admin').command({ ping: 1 });
    database = client.db(config.mongo.database);
    console.log(`MongoDB connected (${config.mongo.database})`);
    return database;
  } catch (error) {
    await client?.close().catch(() => {});
    client = null;
    console.warn(`MongoDB unavailable; using the in-memory store. ${error instanceof Error ? error.message : 'Connection failed'}`);
    return null;
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