"use client";

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Calendar, MapPin, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Form, FormItem, FormLabel, FormControl, FormDescription, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAppStore } from '@/lib/stores/app-store';
import { Course } from '@/lib/database';

const DAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

const COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', 
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

export default function Timetable() {
  const { courses, currentWeek, loadData, deleteCourse, addCourse, updateCourse, settings, replaceSeries } = useAppStore();
  const [guardOpen, setGuardOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number>(currentWeek);
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Array<any>>([]);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [addModeOpen, setAddModeOpen] = useState(false);
  const [mode, setMode] = useState<'basic' | 'advanced' | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [warnAcknowledged, setWarnAcknowledged] = useState(false);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    // initialize selected week to the store's currentWeek when data loads
    setSelectedWeek(currentWeek);
  }, [currentWeek]);

  const getCoursesForDay = (day: number) => {
    const activeSemester = settings?.semesters?.find(s => s.id === settings.activeSemesterId);
    const activeMajor = activeSemester?.activeMajor || '';
    const parseTime = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map(x => Number(x));
      return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    };
    return courses.filter(course => {
      const inWeek = course.day === day && course.startWeek <= selectedWeek && course.endWeek >= selectedWeek;
      if (!inWeek) return false;
      if (!activeMajor) return true; // no major selected globally -> show all
      if (activeMajor === '__unspecified') return !course.major;
      return course.major === activeMajor;
    }).sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
  };

  const handleDeleteCourse = async (courseId: number) => {
    setConfirmTarget(courseId);
    setConfirmOpen(true);
  };

  const ensureSemesterMajorBeforeAdd = () => {
    const activeSemester = settings?.semesters?.find(s => s.id === settings.activeSemesterId);
    const hasSemester = !!activeSemester;
    const hasMajor = !!(activeSemester && activeSemester.activeMajor);
    if (!hasSemester || !hasMajor) {
      setGuardOpen(true);
      return false;
    }
    return true;
  };

  const CourseCard = ({ course }: { course: Course }) => (
    <Card className="relative">
      <div 
        className="absolute top-0 left-0 w-1 h-full rounded-l-lg"
        style={{ backgroundColor: course.color }}
      />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-lg">{course.title}</h3>
            {course.instructor && (
              <p className="text-sm text-muted-foreground">{course.instructor}</p>
            )}
          </div>
            <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { 
              // When editing, group sessions by seriesId if present; otherwise only preload this record.
              let preloaded: Array<any> = [];
              if (course.seriesId) {
                const matching = courses.filter(c => c.seriesId === course.seriesId);
                preloaded = matching.map(m => ({
                  instructor: m.instructor || '',
                  day: m.day,
                  startTime: m.startTime,
                  endTime: m.endTime,
                  building: m.building,
                  room: m.room,
                  startWeek: m.startWeek,
                  endWeek: m.endWeek,
                }));
              } else {
                preloaded = [{
                  instructor: course.instructor || '',
                  day: course.day,
                  startTime: course.startTime,
                  endTime: course.endTime,
                  building: course.building,
                  room: course.room,
                  startWeek: course.startWeek,
                  endWeek: course.endWeek,
                }];
              }
              setEditingCourse(course);
              setMode('advanced');
              setSessions(preloaded);
              setExpandedSession(0);
              setIsAddingCourse(true); }}>
              <Edit className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
              onClick={() => handleDeleteCourse(course.id!)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3 w-3" />
          {course.startTime} - {course.endTime}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {course.building} {course.room}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-3 w-3" />
          <span>Weeks {course.startWeek} - {course.endWeek}</span>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Timetable</h1>
            <p className="text-muted-foreground">
              Week {currentWeek} • {settings?.semesters?.find(s => s.id === settings.activeSemesterId)?.name || 'No semester'}
              {settings?.semesters?.find(s => s.id === settings.activeSemesterId)?.activeMajor ? ` • ${settings?.semesters?.find(s => s.id === settings.activeSemesterId)?.activeMajor}` : ''}
            </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Week</label>
            <Input type="number" min={1} value={selectedWeek} onChange={(e) => setSelectedWeek(Number(e.target.value || 1))} className="w-24" />
          </div>
          {/* Semester and major are controlled in Settings; timetable respects global selection */}

          {/* Mode selector dialog (Basic / Advanced) */}
          <Dialog open={addModeOpen} onOpenChange={setAddModeOpen}>
            <Button onClick={() => { if (ensureSemesterMajorBeforeAdd()) setAddModeOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Course
            </Button>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add course</DialogTitle>
                <DialogDescription>Choose a mode</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => { setMode('basic'); setAddModeOpen(false); setIsAddingCourse(true); }} className="flex-1">Basic</Button>
                <Button onClick={() => { setMode('advanced'); setAddModeOpen(false); setIsAddingCourse(true); }} className="flex-1">Advanced</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Main add/edit dialog - mode controls which UI is shown */}
          <Dialog open={isAddingCourse} onOpenChange={(open) => { if (!open) { setMode(null); setSessions([]); setExpandedSession(null); } setIsAddingCourse(open); }}>
          
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCourse ? 'Edit Course' : 'Add Course'}</DialogTitle>
              <DialogDescription>Fill in course details</DialogDescription>
            </DialogHeader>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement & any;
              const title = form.title.value;
              const color = COLORS[0];
              try {

              // Build a normalized list of sessions to validate first
              const toValidate: Array<{ day: number; startTime: string; endTime: string; startWeek: number; endWeek: number; building?: string; room?: string; instructor?: string; }>=
                (mode === 'advanced' ? (sessions.length ? sessions : []) : []) as any;
              if (mode === 'basic') {
                toValidate.push({
                  day: Number(form.day?.value ?? selectedDay),
                  startTime: form.startTime?.value ?? '',
                  endTime: form.endTime?.value ?? '',
                  startWeek: Number(form.startWeek?.value) || 1,
                  endWeek: Number(form.endWeek?.value) || 16,
                  building: form.building?.value ?? '',
                  room: form.room?.value ?? '',
                });
              }

              const parseTimeToMinutes = (t: string): number | null => {
                if (!t || typeof t !== 'string') return null;
                const m = t.match(/^\s*(\d{1,2}):(\d{2})\s*$/);
                if (!m) return null;
                const h = Number(m[1]);
                const min = Number(m[2]);
                if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
                return h * 60 + min;
              };
              const timeOverlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => Math.max(aStart, bStart) < Math.min(aEnd, bEnd);
              const weekOverlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => Math.max(aStart, bStart) <= Math.min(aEnd, bEnd);

              const nextErrors: string[] = [];
              const nextWarnings: string[] = [];

              // Per-session validations
              toValidate.forEach((s, idx) => {
                const start = parseTimeToMinutes(s.startTime);
                const end = parseTimeToMinutes(s.endTime);
                if (start === null || end === null) {
                  nextErrors.push(`Session ${idx + 1}: Provide valid start and end times (HH:MM).`);
                } else if (start >= end) {
                  nextErrors.push(`Session ${idx + 1}: Start time must be earlier than end time.`);
                }
                const sw = Number(s.startWeek);
                const ew = Number(s.endWeek);
                if (!Number.isFinite(sw) || !Number.isFinite(ew)) {
                  nextErrors.push(`Session ${idx + 1}: Start and end weeks are required.`);
                } else if (sw < 1) {
                  nextErrors.push(`Session ${idx + 1}: Start week must be at least 1.`);
                } else if (sw > ew) {
                  nextErrors.push(`Session ${idx + 1}: Start week cannot be after end week.`);
                }
              });

              // Intra-new-sessions overlap warnings
              for (let i = 0; i < toValidate.length; i++) {
                for (let j = i + 1; j < toValidate.length; j++) {
                  const a = toValidate[i];
                  const b = toValidate[j];
                  const aStart = parseTimeToMinutes(a.startTime);
                  const aEnd = parseTimeToMinutes(a.endTime);
                  const bStart = parseTimeToMinutes(b.startTime);
                  const bEnd = parseTimeToMinutes(b.endTime);
                  if (a.day === b.day && aStart !== null && aEnd !== null && bStart !== null && bEnd !== null) {
                    if (timeOverlaps(aStart, aEnd, bStart, bEnd) && weekOverlaps(a.startWeek, a.endWeek, b.startWeek, b.endWeek)) {
                      nextWarnings.push(`Session ${i + 1} overlaps with session ${j + 1} on ${DAYS[a.day]}.`);
                    }
                  }
                }
              }

              // Overlap warnings with existing courses (exclude the one(s) being edited)
              const activeSem = settings?.semesters?.find(s => s.id === settings.activeSemesterId);
              const activeMajor = activeSem?.activeMajor;
              const withinMajor = (c: any) => {
                if (activeMajor === undefined || activeMajor === null) return true; // no major filter selected
                if (activeMajor === '__unspecified') return !c.major; // only unassigned majors
                return c.major === activeMajor;
              };
              // If editing a single-row course (no seriesId) in advanced mode, the user might be consolidating
              // multiple same-title rows into a new series. During this edit session, exclude other same-title
              // rows from overlap checks to avoid false positives that would be resolved on save.
              const isImplicitSeriesConsolidation = !!editingCourse && !editingCourse.seriesId && mode === 'advanced';
              const sameTitleIds = isImplicitSeriesConsolidation
                ? new Set(courses.filter(c => c.title === editingCourse!.title && c.semesterId === editingCourse!.semesterId).map(c => c.id))
                : null;
              const existing = courses.filter(c => {
                // Keep only records in the current major scope
                if (!withinMajor(c)) return false;
                // Exclude the course/series being edited
                if (editingCourse?.seriesId) return c.seriesId !== editingCourse.seriesId;
                if (editingCourse?.id) return c.id !== editingCourse.id;
                // Exclude other same-title rows during implicit consolidation
                if (sameTitleIds && c.id && sameTitleIds.has(c.id)) return false;
                return true;
              });
              toValidate.forEach((s, idx) => {
                const sStart = parseTimeToMinutes(s.startTime);
                const sEnd = parseTimeToMinutes(s.endTime);
                if (sStart === null || sEnd === null) return;
                existing.forEach(c => {
                  if (c.day !== s.day) return;
                  const cStart = parseTimeToMinutes(c.startTime);
                  const cEnd = parseTimeToMinutes(c.endTime);
                  if (cStart === null || cEnd === null) return;
                  if (timeOverlaps(sStart, sEnd, cStart, cEnd) && weekOverlaps(s.startWeek, s.endWeek, c.startWeek, c.endWeek)) {
                    nextWarnings.push(`Session ${idx + 1} overlaps with existing course "${c.title}" on ${DAYS[c.day]}.`);
                  }
                });
              });

              if (nextErrors.length > 0) {
                setErrors(nextErrors);
                setWarnings(nextWarnings);
                setWarnAcknowledged(false);
                return;
              }
              if (nextWarnings.length > 0) {
                // Show warnings but do not block save; allow user to proceed in one submit.
                setWarnings(nextWarnings);
                setErrors([]);
                setWarnAcknowledged(true);
                // continue to save
              }

              // If editing an existing course, preserve seriesId if present and update/replace
              if (editingCourse) {
                // For simplicity, editing updates only the single record being edited.
                // Prefer values from the preloaded session state (sessions[0]) if present,
                // otherwise fall back to named form inputs (basic mode).
                const s = sessions[0] || {} as any;
                const updates: any = {
                  title,
                  instructor: s.instructor ?? form.instructor?.value ?? editingCourse.instructor ?? '',
                  building: s.building ?? form.building?.value ?? '',
                  room: s.room ?? form.room?.value ?? '',
                  day: Number(s.day ?? (form.day?.value ?? selectedDay)),
                  startTime: s.startTime ?? form.startTime?.value ?? '',
                  endTime: s.endTime ?? form.endTime?.value ?? '',
                  startWeek: Number(s.startWeek ?? form.startWeek?.value) || 1,
                  endWeek: Number(s.endWeek ?? form.endWeek?.value) || 16,
                };
                // Build toCreate from current sessions when in advanced mode; otherwise single session
                const toCreate = mode === 'advanced'
                  ? (sessions.length ? sessions : [updates])
                  : [updates];

                // If this course belongs to a series, replace the entire series with new sessions
                if (editingCourse.seriesId) {
                  // Build new course rows from current sessions state (or the single session)
                  const newRows = toCreate.map((sess: any) => ({
                    title,
                    color: editingCourse.color || COLORS[0],
                    instructor: sess.instructor || '',
                    building: sess.building || '',
                    room: sess.room || '',
                    day: Number(sess.day),
                    startTime: sess.startTime || '',
                    endTime: sess.endTime || '',
                    startWeek: Number(sess.startWeek) || 1,
                    endWeek: Number(sess.endWeek) || 16,
                    seriesId: editingCourse.seriesId,
                  } as any));
                  await replaceSeries(editingCourse.seriesId, newRows);
                } else {
                  // If user added multiple sessions while editing a single-row course, convert it into a series
                  if (toCreate.length > 1) {
                    const seriesId = 'series-' + Date.now();
                    // remove the original single row
                    await deleteCourse(editingCourse.id!);
                    // create new rows for each session
                    await Promise.all(toCreate.map(async (sess: any) => {
                      const course = {
                        title,
                        color: editingCourse.color || COLORS[0],
                        instructor: sess.instructor || '',
                        building: sess.building || '',
                        room: sess.room || '',
                        day: Number(sess.day),
                        startTime: sess.startTime || '',
                        endTime: sess.endTime || '',
                        startWeek: Number(sess.startWeek) || 1,
                        endWeek: Number(sess.endWeek) || 16,
                        seriesId,
                      } as any;
                      await addCourse(course);
                    }));
                    await loadData();
                  } else {
                    await updateCourse(editingCourse.id!, updates);
                  }
                }
                setEditingCourse(null);
                setMode(null);
              } else {
                // Create a series id for grouped sessions
                const seriesId = 'series-' + Date.now();
                // sessions state holds the multiple meeting entries
                // each session: { day, startTime, endTime, building, room, startWeek, endWeek, instructor }
                const toCreate = sessions.length ? sessions : [{
                  day: Number(form.day.value),
                  startTime: form.startTime.value,
                  endTime: form.endTime.value,
                  building: form.building.value,
                  room: form.room.value,
                  startWeek: Number(form.startWeek.value) || 1,
                  endWeek: Number(form.endWeek.value) || 16,
                  instructor: '',
                }];

                await Promise.all(toCreate.map(async (s: any) => {
                  const course = {
                    title,
                    color,
                    instructor: s.instructor || '',
                    building: s.building,
                    room: s.room,
                    day: Number(s.day),
                    startTime: s.startTime,
                    endTime: s.endTime,
                    startWeek: Number(s.startWeek) || 1,
                    endWeek: Number(s.endWeek) || 16,
                    seriesId,
                  } as any;
                  await addCourse(course);
                }));
              }
              setSessions([]);
              setIsAddingCourse(false);
              setErrors([]);
              setWarnings([]);
              setWarnAcknowledged(false);
              await loadData();
            } catch (err: any) {
              console.error('Failed to save course(s):', err);
              setErrors([String(err?.message || err)]);
            }
            }}>
              <div className="grid gap-3">
                <div>
                  <label className="text-sm font-medium">Course title</label>
                  <Input name="title" placeholder="Course title" required defaultValue={editingCourse?.title ?? ''} className="w-full" />
                </div>
                {errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertTitle>Fix the following</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc ml-5 space-y-1">
                        {errors.map((err, i) => (<li key={i}>{err}</li>))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                {warnings.length > 0 && (
                  <Alert>
                    <AlertTitle>Potential overlaps detected</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc ml-5 space-y-1">
                        {warnings.map((w, i) => (<li key={i}>{w}</li>))}
                      </ul>
                      {!warnAcknowledged && (
                        <div className="mt-2 text-sm text-muted-foreground">Submit again to proceed anyway.</div>
                      )}
                    </AlertDescription>
                  </Alert>
                )}

                {/* If in basic mode, show a simple single-session form; otherwise show sessions UI */}
                {mode === 'basic' ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm font-medium">Day</label>
                        <select name="day" defaultValue={String(selectedDay)} className="rounded-md border px-2 py-2 w-full">
                          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Start</label>
                        <Input name="startTime" placeholder="09:00" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm font-medium">End</label>
                        <Input name="endTime" placeholder="10:30" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Building</label>
                        <Input name="building" placeholder="Building" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-sm font-medium">Room</label>
                        <Input name="room" placeholder="Room" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Weeks</label>
                        <div className="flex gap-2">
                          <Input name="startWeek" placeholder="1" />
                          <Input name="endWeek" placeholder="16" />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Sessions</div>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => {
                          setSessions(prev => {
                            const last = prev[prev.length - 1];
                            const base = last ? { ...last } : { day: selectedDay, startTime: '', endTime: '', building: '', room: '', startWeek: 1, endWeek: 16, instructor: '' };
                            const next = [...prev, { ...base }];
                            // auto-expand the newly added session and collapse others
                            setExpandedSession(next.length - 1);
                            return next;
                          });
                        }}>Add session</Button>
                      </div>
                    </div>

                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-2">
                    {sessions.length === 0 && (
                      <div className="text-sm text-muted-foreground">No additional sessions. Fill the main fields below or add sessions to specify multiple meeting times.</div>
                    )}
                    {sessions.map((s, idx) => {
                      const isOpen = expandedSession === idx;
                      return (
                        <div key={idx} className="p-3 border rounded">
                          <button type="button" className="w-full text-left p-2" onClick={() => setExpandedSession(prev => prev === idx ? null : idx)}>
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{s.instructor || 'Instructor'} — {DAYS[s.day]} {s.startTime} - {s.endTime}</div>
                              <div className="text-sm text-muted-foreground">{isOpen ? 'Collapse' : 'Expand'}</div>
                            </div>
                          </button>

                          <div className={`${isOpen ? 'block' : 'hidden'} space-y-2 p-2`}>
                            <div>
                              <label className="text-sm font-medium">Instructor</label>
                              <Input value={s.instructor} onChange={(e) => setSessions(prev => { const copy = [...prev]; copy[idx].instructor = e.target.value; return copy; })} placeholder="Instructor" />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-sm font-medium">Day</label>
                                <select value={s.day} onChange={(e) => setSessions(prev => { const copy = [...prev]; copy[idx].day = Number(e.target.value); return copy; })} className="rounded-md border px-2 py-2 w-full">
                                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                                </select>
                              </div>
                              <div>
                                <label className="text-sm font-medium">Start</label>
                                <Input value={s.startTime} onChange={(e) => setSessions(prev => { const copy = [...prev]; copy[idx].startTime = e.target.value; return copy; })} placeholder="09:00" />
                              </div>
                              <div>
                                <label className="text-sm font-medium">End</label>
                                <Input value={s.endTime} onChange={(e) => setSessions(prev => { const copy = [...prev]; copy[idx].endTime = e.target.value; return copy; })} placeholder="10:30" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-sm font-medium">Building</label>
                                <Input value={s.building} onChange={(e) => setSessions(prev => { const copy = [...prev]; copy[idx].building = e.target.value; return copy; })} placeholder="Building" />
                              </div>
                              <div>
                                <label className="text-sm font-medium">Room</label>
                                <Input value={s.room} onChange={(e) => setSessions(prev => { const copy = [...prev]; copy[idx].room = e.target.value; return copy; })} placeholder="Room" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 items-end">
                              <div>
                                <label className="text-sm font-medium">Start week</label>
                                <Input value={String(s.startWeek)} onChange={(e) => setSessions(prev => { const copy = [...prev]; copy[idx].startWeek = Number(e.target.value); return copy; })} />
                              </div>
                              <div>
                                <label className="text-sm font-medium">End week</label>
                                <Input value={String(s.endWeek)} onChange={(e) => setSessions(prev => { const copy = [...prev]; copy[idx].endWeek = Number(e.target.value); return copy; })} />
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <Button type="button" variant="destructive" onClick={() => {
                                setSessions(prev => {
                                  const next = prev.filter((_, i) => i !== idx);
                                  // adjust expandedSession to remain consistent
                                  setExpandedSession(prevExpanded => {
                                    if (prevExpanded === null) return null;
                                    if (prevExpanded === idx) return null; // closed the removed one
                                    if (prevExpanded > idx) return prevExpanded - 1; // shift left
                                    return prevExpanded;
                                  });
                                  return next;
                                });
                              }}>Remove</Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => { setIsAddingCourse(false); setEditingCourse(null); setSessions([]); setExpandedSession(null); }}>Cancel</Button>
                  <Button type="submit">{editingCourse ? 'Save' : 'Add Course'}</Button>
                </DialogFooter>
              </div>
            </form>
            </DialogContent>
          </Dialog>

            {/* Guard dialog when semester/major missing */}
            <Dialog open={guardOpen} onOpenChange={setGuardOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Missing semester or major</DialogTitle>
                  <DialogDescription>
                    You must first create or select a semester and major in Settings before adding courses.
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setGuardOpen(false)}>Cancel</Button>
                  <Button onClick={() => { setGuardOpen(false); window.location.href = '/settings'; }} className="bg-primary text-primary-foreground">Go to Settings</Button>
                </div>
              </DialogContent>
            </Dialog>

          {/* Week input replaced the Preview modal — the timetable is filtered by `selectedWeek` */}

          {/* Confirm delete dialog */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete course</DialogTitle>
                <DialogDescription>Are you sure you want to delete this course? This cannot be undone.</DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                <Button onClick={async () => {
                  setConfirmOpen(false);
                  if (confirmTarget) {
                    await deleteCourse(confirmTarget);
                    await loadData();
                  }
                  setConfirmTarget(null);
                }} className="bg-red-600 hover:bg-red-700">Delete</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {DAYS.map((day, index) => {
          const daysCourses = getCoursesForDay(index);
          const isToday = index === new Date().getDay();
          
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(index)}
              className={`flex flex-col items-center gap-1 px-4 py-3 rounded-lg border transition-colors min-w-fit ${
                selectedDay === index
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent'
              }`}
            >
              <span className="font-medium">{day.slice(0, 3)}</span>
              <div className="flex items-center gap-1">
                {isToday && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                )}
                {daysCourses.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {daysCourses.length}
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Day Schedule */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          {DAYS[selectedDay]} Schedule
        </h2>
        
        <div className="space-y-4">
          {getCoursesForDay(selectedDay).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No classes today</h3>
                <p className="text-muted-foreground text-center mb-4">
                  No courses scheduled for {DAYS[selectedDay]}
                </p>
                <Button onClick={() => setIsAddingCourse(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Course
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {getCoursesForDay(selectedDay).map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}