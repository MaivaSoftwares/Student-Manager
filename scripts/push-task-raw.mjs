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
    const tasks = db.collection('tasks');
    const now = new Date().toISOString();
    const doc = {
      _id: 'task-sample-1',
      title: 'Sample Task',
      description: 'This is a sample task inserted from desktop.',
      dueDate: new Date().toISOString().split('T')[0],
      completed: false,
      updatedAt: now,
      ownerId: 'local-user',
      clientId: 'client-task-1'
    };
    await tasks.updateOne({ _id: doc._id }, { $set: doc }, { upsert: true });
    console.log('Sample task upserted');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

main();
