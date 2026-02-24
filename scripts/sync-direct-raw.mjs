import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import fs from 'fs/promises';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || undefined;

if (!uri) {
  console.error('MONGODB_URI not set in .env.local');
  process.exit(1);
}

async function upsertMany(db, colName, docs) {
  if (!Array.isArray(docs) || docs.length === 0) return 0;
  const col = db.collection(colName);
  let count = 0;
  for (const doc of docs) {
    const id = doc._id || doc.id || doc.clientId;
    if (!id) {
      // generate client id if none
      doc._id = `client-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    } else {
      doc._id = id;
    }
    if (!doc.updatedAt) doc.updatedAt = new Date().toISOString();
    await col.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
    count++;
  }
  return count;
}

async function main() {
  try {
    const raw = await fs.readFile(process.argv[2] || './export.json', 'utf8');
    const payload = JSON.parse(raw);
    const courses = payload.courses || [];
    const tasks = payload.tasks || [];

    const client = new MongoClient(uri, { maxPoolSize: 5 });
    await client.connect();
    const db = dbName ? client.db(dbName) : client.db();
    console.log('Connected to DB:', db.databaseName);

    const cCount = await upsertMany(db, 'courses', courses);
    const tCount = await upsertMany(db, 'tasks', tasks);
    console.log(`Upserted ${cCount} courses and ${tCount} tasks`);
    await client.close();
  } catch (err) {
    console.error('Sync failed:', err);
    process.exitCode = 1;
  }
}

main();
