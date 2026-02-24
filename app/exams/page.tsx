"use client";

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, GraduationCap, Plus, Trash2, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/stores/app-store';

export default function ExamsPage() {
  const { exams, courses, loadData, addExam, updateExam, deleteExam, settings } = useAppStore();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [mode, setMode] = useState<'course' | 'custom'>('course');
  const [monthFilter, setMonthFilter] = useState<'all' | string>('all');
  const [dayFilter, setDayFilter] = useState<'all' | string>('all');

  // form state
  const [courseId, setCourseId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => { loadData(); }, [loadData]);

  const activeSemester = settings?.semesters?.find(s => s.id === settings.activeSemesterId);
  const activeMajor = activeSemester?.activeMajor;
  const filteredCourses = useMemo(() => {
    return courses.filter(c => {
      if (!activeMajor) return true;
      if (activeMajor === '__unspecified') return !c.major;
      return c.major === activeMajor;
    }).sort((a,b) => a.title.localeCompare(b.title));
  }, [courses, activeMajor]);

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayOrder = [1,2,3,4,5,6,0]; // Monday..Sunday order for the UI

  const availableMonths = useMemo(() => {
    const set = new Set<number>();
    exams.forEach(e => { if (e.date) { const m = new Date(`${e.date}T00:00`).getMonth(); set.add(m); } });
    return Array.from(set).sort((a,b) => a - b);
  }, [exams]);

  const sortedExams = useMemo(() => {
    const filtered = exams.filter(e => {
      const d = e.date ? new Date(`${e.date}T00:00`) : null;
      if (!d) return false;
      if (monthFilter !== 'all') {
        if (d.getMonth() !== Number(monthFilter)) return false;
      }
      if (dayFilter !== 'all') {
        if (d.getDay() !== Number(dayFilter)) return false;
      }
      return true;
    });
    const cmp = (a: typeof exams[number], b: typeof exams[number]) => {
      // Sort primarily by month/day via ISO date string (YYYY-MM-DD) which preserves month/day order,
      // then by time within the day.
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      const at = a.time || '';
      const bt = b.time || '';
      return at.localeCompare(bt);
    };
    return filtered.slice().sort(cmp);
  }, [exams, monthFilter, dayFilter]);

  const resetForm = () => {
    setEditingId(null);
    setMode('course');
    setCourseId(null);
    setTitle('');
    setSeatNumber('');
    setDate('');
    setTime('');
    setErrors([]);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (id: number) => {
    const e = exams.find(x => x.id === id);
    if (!e) return;
    setEditingId(id);
    if (e.courseId) {
      setMode('course');
      setCourseId(e.courseId);
      setTitle(e.title);
    } else {
      setMode('custom');
      setTitle(e.title);
    }
    setSeatNumber(e.seatNumber || '');
    setDate(e.date || '');
    setTime(e.time || '');
    setOpen(true);
  };

  const validate = () => {
    const errs: string[] = [];
    const t = (mode === 'course') ? (title || filteredCourses.find(c => c.id === courseId)?.title || '') : title;
    if (!t) errs.push('Title or course is required.');
    if (!date) errs.push('Date is required.');
    if (!time) errs.push('Time is required.');
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const selectedCourse = filteredCourses.find(c => c.id === courseId || undefined);
    const effectiveTitle = mode === 'course' ? (title || selectedCourse?.title || '') : title;
    const payload = {
      title: effectiveTitle,
      courseId: mode === 'course' ? (courseId ?? undefined) : undefined,
      seatNumber: seatNumber || undefined,
      date,
      time,
    } as any;

    if (editingId) {
      await updateExam(editingId, payload);
    } else {
      await addExam(payload);
    }
    setOpen(false);
    resetForm();
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Exams</h1>
          <p className="text-muted-foreground">Plan and track your upcoming exams</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Month</label>
            <Select value={monthFilter} onValueChange={(v) => setMonthFilter(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={String(m)}>{monthNames[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Day</label>
            <Select value={dayFilter} onValueChange={(v) => setDayFilter(v)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All days</SelectItem>
                {dayOrder.map((d) => (
                  <SelectItem key={d} value={String(d)}>{weekdayNames[d]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add Exam
          </Button>
        </div>
      </div>

      {sortedExams.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No exams yet</h3>
            <p className="text-muted-foreground text-center mb-4">Create your first exam to get started</p>
            <Button onClick={openAdd}>Add Exam</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedExams.map(exam => {
            const course = courses.find(c => c.id === exam.courseId);
            return (
              <Card key={exam.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-lg">{exam.title}</div>
                      {course && <div className="text-sm text-muted-foreground">{course.title}</div>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEdit(exam.id!)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" onClick={() => deleteExam(exam.id!)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {exam.date}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {exam.time}
                  </div>
                  {exam.seatNumber && (
                    <Badge variant="secondary" className="text-xs">Seat {exam.seatNumber}</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Exam' : 'Add Exam'}</DialogTitle>
            <DialogDescription>Choose a course or type a custom title, then provide date/time and optional seat number.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant={mode === 'course' ? 'default' : 'outline'} onClick={() => setMode('course')}>From course</Button>
              <Button type="button" variant={mode === 'custom' ? 'default' : 'outline'} onClick={() => setMode('custom')}>Custom</Button>
            </div>

            {mode === 'course' ? (
              <div className="space-y-2">
                <label className="text-sm font-medium">Course</label>
                <select value={courseId ?? ''} onChange={(e) => { const id = e.target.value ? Number(e.target.value) : null; setCourseId(id); if (!title && id) { const c = filteredCourses.find(cc => cc.id === id); if (c) setTitle(c.title); } }} className="rounded-md border px-2 py-2 w-full">
                  <option value="">Select course</option>
                  {filteredCourses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <label className="text-xs text-muted-foreground">Title (optional override)</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Exam title (optional)" />
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Calculus II Final" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium">Time</label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Seat number (optional)</label>
              <Input value={seatNumber} onChange={(e) => setSeatNumber(e.target.value)} placeholder="e.g., A32" />
            </div>

            {errors.length > 0 && (
              <div className="text-sm text-red-600">
                <ul className="list-disc ml-5 space-y-1">
                  {errors.map((err, i) => (<li key={i}>{err}</li>))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button type="submit">{editingId ? 'Save' : 'Add'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
