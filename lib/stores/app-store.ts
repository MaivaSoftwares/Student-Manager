import { create } from 'zustand';
import { Course, Task, Settings, Exam, getDb } from '@/lib/database';
import { addWeeks, startOfWeek, differenceInWeeks } from 'date-fns';

interface AppState {
  courses: Course[];
  tasks: Task[];
  exams: Exam[];
  settings: Settings | null;
  loading: boolean;
  currentWeek: number;
  
  // Actions
  loadData: () => Promise<void>;
  
  // Course actions
  addCourse: (course: Omit<Course, 'id'>) => Promise<void>;
  updateCourse: (id: number, course: Partial<Course>) => Promise<void>;
  deleteCourse: (id: number) => Promise<void>;
  // Replace all courses belonging to a seriesId with a new set (used for multi-session edits)
  replaceSeries: (seriesId: string, courses: Array<Omit<Course, 'id'>>) => Promise<void>;
  
  // Task actions
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Promise<void>;
  updateTask: (id: number, task: Partial<Task>) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  
  // Exam actions
  addExam: (exam: Omit<Exam, 'id'>) => Promise<void>;
  updateExam: (id: number, exam: Partial<Exam>) => Promise<void>;
  deleteExam: (id: number) => Promise<void>;
  
  // Settings actions
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  addSemester: (semester: {id: string; name: string; startDate: string}) => Promise<void>;
  selectSemester: (id: string) => Promise<void>;
  addMajor: (major: string) => Promise<void>;
  selectMajor: (major?: string) => Promise<void>;
  removeMajor: (major: string, deleteData?: boolean) => Promise<void>;
  deleteSemester: (semesterId: string, deleteData?: boolean) => Promise<void>;
  // Clear entire database
  clearDatabase: () => Promise<void>;
  
  // Utility functions
  getCurrentWeek: () => number;
  getCoursesForDay: (day: number) => Course[];
  getTodaysCourses: () => Course[];
  getUpcomingTasks: () => Task[];
  getOverdueTasks: () => Task[];
  getUpcomingExams: () => Exam[];
}

export const useAppStore = create<AppState>((set, get) => ({
  courses: [],
  tasks: [],
  exams: [],
  settings: null,
  loading: false,
  currentWeek: 1,

  loadData: async () => {
    set({ loading: true });
    try {
  const db = getDb();
  let settings = await db.settings.toCollection().first();

  // Migration: older schema stored majors at top-level in settings. If present,
  // move them into the active semester so majors are per-semester.
  if (settings) {
    const s0: any = settings;
    if (s0.majors && Array.isArray(s0.majors) && s0.majors.length) {
      const legacyMajors = s0.majors as string[];
      const sems = s0.semesters || [];
      const activeIndex = sems.findIndex((s:any) => s.id === s0.activeSemesterId);
      if (activeIndex !== -1) {
        const active = { ...sems[activeIndex] } as any;
        active.majors = Array.from(new Set([...(active.majors || []), ...legacyMajors]));
        sems[activeIndex] = active;
        // remove legacy field
        const cleaned: any = { ...s0 };
        delete cleaned.majors;
        cleaned.semesters = sems;
        settings = cleaned;
        await db.settings.update(s0.id!, cleaned);
      }
    }
  }

  // scope load to active semester/major when available
  const semesterId = settings?.activeSemesterId;
  // Load all courses/tasks for the active semester (do not auto-scope by major here).
  let coursesPromise: Promise<any[]>;
  let tasksPromise: Promise<any[]>;
  let examsPromise: Promise<any[]>;

  if (semesterId) {
    coursesPromise = db.courses.where('semesterId').equals(semesterId).toArray();
    tasksPromise = db.tasks.where('semesterId').equals(semesterId).toArray();
    examsPromise = db.exams.where('semesterId').equals(semesterId).toArray();
  } else {
    coursesPromise = db.courses.toCollection().toArray();
    tasksPromise = db.tasks.toCollection().toArray();
    examsPromise = db.exams.toCollection().toArray();
  }

  let [courses, tasks, exams] = await Promise.all([coursesPromise, tasksPromise, examsPromise]);

  // If we have an active semester and there are unscoped records (from older installs),
  // migrate them to the active semester automatically so users don't lose data.
      const activeSemesterId = settings?.activeSemesterId;
      if (activeSemesterId) {
        const unscopedCourses = await db.courses.filter((c: any) => !c.semesterId).toArray();
        if (unscopedCourses.length) {
          await Promise.all(unscopedCourses.map((c: any) => db.courses.update(c.id, { semesterId: activeSemesterId })));
          courses = await db.courses.where('semesterId').equals(activeSemesterId).toArray();
        }

        const unscopedTasks = await db.tasks.filter((t: any) => !t.semesterId).toArray();
        if (unscopedTasks.length) {
          await Promise.all(unscopedTasks.map((t: any) => db.tasks.update(t.id, { semesterId: activeSemesterId })));
          tasks = await db.tasks.where('semesterId').equals(activeSemesterId).toArray();
        }
        const unscopedExams = await db.exams.filter((e: any) => !e.semesterId).toArray();
        if (unscopedExams.length) {
          await Promise.all(unscopedExams.map((e: any) => db.exams.update(e.id, { semesterId: activeSemesterId })));
          exams = await db.exams.where('semesterId').equals(activeSemesterId).toArray();
        }
      }
      
      const currentWeek = settings ? get().getCurrentWeek() : 1;
      
      set({ 
        courses, 
        tasks, 
        exams,
        settings: settings || null,
        currentWeek,
        loading: false 
      });
    } catch (error) {
      console.error('Failed to load data:', error);
      set({ loading: false });
    }
  },

  addCourse: async (course) => {
  const db = getDb();
    // attach active semester/major if available
  const settings = await db.settings.toCollection().first();
  const activeSemester = settings?.semesters?.find((s:any) => s.id === settings.activeSemesterId);
  const withScope = { ...course, semesterId: settings?.activeSemesterId, major: activeSemester?.activeMajor } as any;
    const id = await db.courses.add(withScope);
    const newCourse = { ...course, id };
    set(state => ({ courses: [...state.courses, newCourse] }));
  },

  updateCourse: async (id, updates) => {
  const db = getDb();
    await db.courses.update(id, updates);
    set(state => ({
      courses: state.courses.map(course => 
        course.id === id ? { ...course, ...updates } : course
      )
    }));
  },

  replaceSeries: async (seriesId, newCourses) => {
  const db = getDb();
    // delete existing courses with this seriesId within the current semester scope
    await db.courses.where('seriesId').equals(seriesId).delete();
    // attach semester/major scope similar to addCourse and insert new rows
    const settings = await db.settings.toCollection().first();
    const activeSemester = settings?.semesters?.find((s:any) => s.id === settings.activeSemesterId);
    const withScope = newCourses.map(c => ({ ...c, semesterId: settings?.activeSemesterId, major: activeSemester?.activeMajor } as any));
    const addPromises = withScope.map(c => db.courses.add(c));
    await Promise.all(addPromises);
    // reload scoped data into the store
    await get().loadData();
  },

  deleteCourse: async (id) => {
  const db = getDb();
    await db.courses.delete(id);
    set(state => ({
      courses: state.courses.filter(course => course.id !== id)
    }));
  },

  addTask: async (task) => {
    const taskWithCreatedAt = {
      ...task,
      createdAt: new Date().toISOString()
    };
  const db = getDb();
  const settings = await db.settings.toCollection().first();
  const activeSemester = settings?.semesters?.find((s:any) => s.id === settings.activeSemesterId);
  const withScope = { ...taskWithCreatedAt, semesterId: settings?.activeSemesterId, major: activeSemester?.activeMajor } as any;
    const id = await db.tasks.add(withScope);
    const newTask = { ...taskWithCreatedAt, id };
    set(state => ({ tasks: [...state.tasks, newTask] }));
  },

  // Exams
  addExam: async (exam) => {
    const db = getDb();
    const settings = await db.settings.toCollection().first();
    const activeSemester = settings?.semesters?.find((s:any) => s.id === settings.activeSemesterId);
    const withScope = { ...exam, semesterId: settings?.activeSemesterId, major: activeSemester?.activeMajor } as any;
    const id = await db.exams.add(withScope);
    const newExam = { ...exam, id } as any;
    set(state => ({ exams: [...state.exams, newExam] }));
  },
  updateExam: async (id, updates) => {
    const db = getDb();
    await db.exams.update(id, updates);
    set(state => ({ exams: state.exams.map(e => e.id === id ? { ...e, ...updates } : e) }));
  },
  deleteExam: async (id) => {
    const db = getDb();
    await db.exams.delete(id);
    set(state => ({ exams: state.exams.filter(e => e.id !== id) }));
  },

  addSemester: async (semester) => {
    const db = getDb();
    let s = await db.settings.toCollection().first();
    // allow caller to provide initial majors and activeMajor for the new semester
    const newSem = { ...semester, majors: (semester as any).majors || [], activeMajor: (semester as any).activeMajor } as any;
    if (!s) {
      // no settings yet: create one with this semester as the active semester
      const settingsPayload: any = { semesters: [newSem], activeSemesterId: newSem.id };
      try {
        await db.settings.add(settingsPayload);
      } catch (err) {
        console.error('Failed to create initial settings', err);
      }
    } else {
      const existingSemesters = s.semesters || [];
      const updated = { ...s, semesters: [...existingSemesters, newSem] } as any;
      // if there was no active semester before, make this the active one
      if (!s.activeSemesterId) updated.activeSemesterId = newSem.id;
      await db.settings.update(s.id!, updated);
    }
    // if the new semester has an activeMajor and the settings had no activeMajor for semesters,
    // ensure the semester entry includes it (already set above via newSem.activeMajor)
    await get().loadData();
  },

  selectSemester: async (id) => {
    const db = getDb();
    const s = await db.settings.toCollection().first();
    if (!s) return;
    const updated = { ...s, activeSemesterId: id } as any;
    await db.settings.update(s.id!, updated);
    await get().loadData();
  },

  // majors are stored in the active semester
  addMajor: async (major) => {
    const db = getDb();
    const s = await db.settings.toCollection().first();
    if (!s) return;
    const sems = s.semesters || [];
    const activeIndex = sems.findIndex((ss:any) => ss.id === s.activeSemesterId);
    if (activeIndex === -1) return;
    const active = { ...sems[activeIndex] } as any;
    active.majors = Array.from(new Set([...(active.majors || []), major]));
    sems[activeIndex] = active;
    const updated = { ...s, semesters: sems } as any;
    await db.settings.update(s.id!, updated);
    await get().loadData();
  },

  // remove a major; optionally delete data scoped to that major (within the semester scope)
  removeMajor: async (major: string, deleteData: boolean = false) => {
    const db = getDb();
    const s = await db.settings.toCollection().first();
    if (!s) return;
    const sems = s.semesters || [];
    const activeIndex = sems.findIndex((ss:any) => ss.id === s.activeSemesterId);
    if (activeIndex === -1) return;
    const active = { ...sems[activeIndex] } as any;
    active.majors = (active.majors || []).filter((m: string) => m !== major);
    if (active.activeMajor === major) active.activeMajor = undefined;
    sems[activeIndex] = active;
    const updated = { ...s, semesters: sems } as any;
    await db.settings.update(s.id!, updated);

    if (deleteData) {
      // delete courses and tasks scoped to this major for this semester only
      await db.courses.where({ semesterId: s.activeSemesterId, major }).delete();
      await db.tasks.where({ semesterId: s.activeSemesterId, major }).delete();
    }

    await get().loadData();
  },

  selectMajor: async (major) => {
    const db = getDb();
    const s = await db.settings.toCollection().first();
    if (!s) return;
    const sems = s.semesters || [];
    const activeIndex = sems.findIndex((ss:any) => ss.id === s.activeSemesterId);
    if (activeIndex === -1) return;
    const active = { ...sems[activeIndex] } as any;
    active.activeMajor = major;
    sems[activeIndex] = active;
    const updated = { ...s, semesters: sems } as any;
    await db.settings.update(s.id!, updated);
    await get().loadData();
  },

  // delete a semester and optionally its associated data (courses/tasks)
  deleteSemester: async (semesterId: string, deleteData: boolean = false) => {
    const db = getDb();
    const s = await db.settings.toCollection().first();
    if (!s) return;
    const updatedSemesters = (s.semesters || []).filter((sem: any) => sem.id !== semesterId);
    const updated: any = { ...s, semesters: updatedSemesters };
    if (s.activeSemesterId === semesterId) {
      updated.activeSemesterId = updatedSemesters.length ? updatedSemesters[0].id : undefined;
    }
    await db.settings.update(s.id!, updated);

    if (deleteData) {
      await db.courses.where('semesterId').equals(semesterId).delete();
      await db.tasks.where('semesterId').equals(semesterId).delete();
    }

    await get().loadData();
  },

  updateTask: async (id, updates) => {
  const db = getDb();
    await db.tasks.update(id, updates);
    set(state => ({
      tasks: state.tasks.map(task => 
        task.id === id ? { ...task, ...updates } : task
      )
    }));
  },

  deleteTask: async (id) => {
  const db = getDb();
    await db.tasks.delete(id);
    set(state => ({
      tasks: state.tasks.filter(task => task.id !== id)
    }));
  },

  toggleTask: async (id) => {
    const task = get().tasks.find(t => t.id === id);
    if (task) {
      await get().updateTask(id, { completed: !task.completed });
    }
  },

  updateSettings: async (updates) => {
    const { settings } = get();
    const db = getDb();
    if (settings?.id) {
      await db.settings.update(settings.id, updates);
    } else {
      await db.settings.add({ ...updates } as Settings);
    }
    await get().loadData();
  },

  // Clear entire database
  clearDatabase: async () => {
    const db = getDb();
    await Promise.all([
      db.courses.clear(),
      db.tasks.clear(),
      db.settings.clear()
    ]);
    set({ courses: [], tasks: [], settings: null });
  },

  getCurrentWeek: () => {
    const { settings } = get();
    if (!settings) return 1;

    const activeSemester = settings.semesters?.find(s => s.id === settings.activeSemesterId);
    if (!activeSemester || !activeSemester.startDate) return 1;

    const semesterStart = new Date(activeSemester.startDate);
    // Use Sunday as the start of the week so weeks run Sunday -> Saturday
    const weekStart = startOfWeek(semesterStart, { weekStartsOn: 0 });
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });

    return Math.max(1, differenceInWeeks(currentWeekStart, weekStart) + 1);
  },

  getCoursesForDay: (day) => {
    const { courses, currentWeek } = get();
    const parseTime = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map((x) => Number(x));
      return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    };
    return courses.filter(course => 
      course.day === day && 
      course.startWeek <= currentWeek && 
      course.endWeek >= currentWeek
    ).sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  },

  getTodaysCourses: () => {
    const today = new Date().getDay();
    return get().getCoursesForDay(today);
  },

  getUpcomingTasks: () => {
    const { tasks } = get();
    const now = new Date();
    return tasks.filter(task => 
      !task.completed && new Date(task.dueDate) >= now
    ).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  },

  getOverdueTasks: () => {
    const { tasks } = get();
    const now = new Date();
    return tasks.filter(task => 
      !task.completed && new Date(task.dueDate) < now
    ).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
  },
  getUpcomingExams: () => {
    const { exams } = get();
    const now = new Date();
    return exams
      .slice()
      .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime())
      .filter(e => new Date(`${e.date}T${e.time || '00:00'}`) >= now);
  },
}));