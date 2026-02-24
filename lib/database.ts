import Dexie, { Table } from 'dexie';

export interface Course {
  id?: number;
  title: string;
  building: string;
  room: string;
  day: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // "09:00"
  endTime: string; // "10:30"
  startWeek: number;
  endWeek: number;
  color: string;
  instructor?: string;
  // optional series id to group multiple session records that belong
  // to the same course series (used when a course meets multiple times)
  seriesId?: string;
  // optional scoping
  semesterId?: string;
  major?: string;
}

export interface Task {
  id?: number;
  title: string;
  description: string;
  dueDate: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  courseId?: number;
  createdAt: string;
  // optional scoping
  semesterId?: string;
  major?: string;
}

export interface Exam {
  id?: number;
  // Display name of the exam. If linked to a course, defaults to course title but can be customized.
  title: string;
  // Optional link to a course for context
  courseId?: number;
  // Optional seat number assigned to the student
  seatNumber?: string;
  // Date as YYYY-MM-DD
  date: string;
  // Time as HH:MM (24h)
  time: string;
  // optional scoping
  semesterId?: string;
  major?: string;
}

export interface Semester {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  // majors that belong to this semester and the active major for this semester
  majors?: string[];
  activeMajor?: string;
}

export interface Settings {
  id?: number;
  // list of semesters available to the user
  semesters: Semester[];
  // id of the currently active semester
  activeSemesterId: string;
  // Note: majors are stored inside each Semester now
  theme: 'light' | 'dark' | 'system';
}

export class StudentDatabase extends Dexie {
  courses!: Table<Course>;
  tasks!: Table<Task>;
  exams!: Table<Exam>;
  settings!: Table<Settings>;

  constructor() {
    super('StudentDashboardDB');
    // v1 -> initial
    this.version(1).stores({
      courses: '++id, title, day, startWeek, endWeek, startTime, endTime',
      tasks: '++id, title, dueDate, completed, priority, courseId',
      settings: '++id, theme'
    });

    // v2 -> add semesterId/major fields and indexes so we can scope data
    this.version(2).stores({
      courses: '++id, title, day, semesterId, major, startWeek, endWeek, startTime, endTime',
      tasks: '++id, title, dueDate, completed, priority, courseId, semesterId, major',
      settings: '++id, theme'
    });
    // v3 -> add seriesId index so multi-session series operations (where('seriesId')) are indexed
    // Adding an index does not require manual migration of data; Dexie builds it automatically.
    // We also keep previous indexes (semesterId, major, time fields) to allow filtering/sorting.
    this.version(3).stores({
      courses: '++id, seriesId, title, day, semesterId, major, startWeek, endWeek, startTime, endTime',
      tasks: '++id, title, dueDate, completed, priority, courseId, semesterId, major',
      settings: '++id, theme'
    });
    // v4 -> add exams store, scoped by semester/major, and common indexes for quick filters
    this.version(4).stores({
      courses: '++id, seriesId, title, day, semesterId, major, startWeek, endWeek, startTime, endTime',
      tasks: '++id, title, dueDate, completed, priority, courseId, semesterId, major',
      exams: '++id, title, date, time, courseId, semesterId, major',
      settings: '++id, theme'
    });
    
  // Note: initialization of default settings is performed after
  // creating the DB instance in `getDb` to avoid runtime issues
  // when Dexie's instance event handlers are not available in some
  // bundling/runtime environments.
  }
}

let dbInstance: StudentDatabase | null = null;

export const getDb = (): StudentDatabase => {
  if (typeof window === 'undefined') {
    throw new Error('Database can only be accessed on the client side');
  }
  
  if (!dbInstance) {
    dbInstance = new StudentDatabase();
    // Kick off async initialization (non-blocking).
    (async () => {
      try {
        const settingsCount = await dbInstance!.settings.count();
        if (settingsCount === 0) {
          const today = new Date().toISOString().split('T')[0];
          const defaultSemesterId = 'default-' + Date.now();
          await dbInstance!.settings.add({
            semesters: [{ id: defaultSemesterId, name: 'Default', startDate: today, majors: [], activeMajor: undefined }],
            activeSemesterId: defaultSemesterId,
            theme: 'system'
          } as any);
        }
      } catch (err) {
        // Log but don't rethrow; DB should still be usable.
        // Keep error surface small to avoid crashing render.
        // eslint-disable-next-line no-console
        console.error('Failed to initialize database settings:', err);
      }
    })();
  }
  
  return dbInstance;
};