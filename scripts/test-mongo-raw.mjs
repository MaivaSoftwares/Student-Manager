import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: '.env.local' });

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || undefined;

if (!uri) {
  console.error('MONGODB_URI not set in .env.local');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri, { maxPoolSize: 5 });
  try {
    await client.connect();
    const db = dbName ? client.db(dbName) : client.db();
    console.log('Connected to DB:', db.databaseName);
    const cols = await db.listCollections().toArray();
    console.log('Collections:', cols.map(c => c.name));
    const col = db.collection('courses');
    const one = await col.findOne({});
    console.log('Sample document from courses:', one);
  } catch (err) {
    console.error('Connection test failed:', err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
