import { NextResponse } from 'next/server';
import { upsertCourse, upsertTask, connectToMongo } from '../../../lib/mongo';

// Server-side sync endpoint. POST { courses: [], tasks: [] }
export async function POST(request: Request) {
  try {
    const syncKey = process.env.SYNC_KEY;
    const headerKey = request.headers.get('x-sync-key');
    if (syncKey && syncKey.length > 0) {
      if (!headerKey || headerKey !== syncKey) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body = await request.json();
    const courses = Array.isArray(body.courses) ? body.courses : [];
    const tasks = Array.isArray(body.tasks) ? body.tasks : [];

    // Ensure DB connected
    await connectToMongo();

    for (const c of courses) {
      // basic hygiene: ensure updatedAt
      if (!c.updatedAt) c.updatedAt = new Date().toISOString();
      await upsertCourse(c);
    }

    for (const t of tasks) {
      if (!t.updatedAt) t.updatedAt = new Date().toISOString();
      await upsertTask(t);
    }

    return NextResponse.json({ ok: true, coursesUpserted: courses.length, tasksUpserted: tasks.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
