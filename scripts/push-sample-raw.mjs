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
    const courses = db.collection('courses');
    const now = new Date().toISOString();
    const doc = {
      _id: 'course-sample-1',
      title: 'Sample Course',
      day: 1,
      startTime: '09:00',
      endTime: '10:30',
      startWeek: 1,
      endWeek: 16,
      updatedAt: now,
      ownerId: 'local-user',
      clientId: 'client-sample-1'
    };
    await courses.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
    console.log('Sample course upserted');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
