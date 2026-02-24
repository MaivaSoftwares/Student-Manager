/**
 * Server-side MongoDB Atlas helper.
 * This module is intended for server-side use (Node.js). It uses the
 * MONGODB_URI environment variable. Do not import this file in client bundles.
 */
import { MongoClient, Db, Collection, Document } from 'mongodb';

let client: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToMongo(): Promise<Db> {
  if (cachedDb) return cachedDb;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not configured');
  client = new MongoClient(uri, { maxPoolSize: 10 });
  await client.connect();
  // default DB from URI or 'studydash'
  const dbName = process.env.MONGODB_DB || client.db().databaseName || 'studydash';
  cachedDb = client.db(dbName);
  return cachedDb;
}

export function getMongoClient(): MongoClient | null {
  return client;
}

export async function getCollection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  const db = await connectToMongo();
  return db.collection<T>(name);
}

// Upsert helpers
export async function upsertCourse(course: any) {
  const col = await getCollection('courses');
  const filter = { _id: course._id || course.id || course.clientId };
  const doc = {
    ...course,
    updatedAt: new Date(course.updatedAt || Date.now()).toISOString(),
  };
  await col.updateOne(filter, { $set: doc, $setOnInsert: { createdAt: doc.createdAt || new Date().toISOString() } }, { upsert: true });
}

export async function upsertTask(task: any) {
  const col = await getCollection('tasks');
  const filter = { _id: task._id || task.id || task.clientId };
  const doc = {
    ...task,
    updatedAt: new Date(task.updatedAt || Date.now()).toISOString(),
  };
  await col.updateOne(filter, { $set: doc, $setOnInsert: { createdAt: doc.createdAt || new Date().toISOString() } }, { upsert: true });
}

export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    cachedDb = null;
  }
}

export default connectToMongo;
