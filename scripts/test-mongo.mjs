import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import connectToMongo, { getCollection, closeMongo } from '../lib/mongo.js';

async function main() {
  try {
    const db = await connectToMongo();
    console.log('Connected to DB:', db.databaseName);
    const cols = await db.listCollections().toArray();
    console.log('Collections in DB:', cols.map(c => c.name));

    // Try a ping / simple read
    const col = await getCollection('courses');
    const one = await col.findOne({});
    console.log('Sample document from courses:', one);
  } catch (err) {
    console.error('Connection test failed:', err);
    process.exitCode = 1;
  } finally {
    await closeMongo();
  }
}

main();
