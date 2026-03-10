"use client";

import { useEffect, useState, useCallback } from 'react';
import { Monitor, Moon, Sun, Calendar, Download, Upload, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTheme } from 'next-themes';
import { getDb } from '@/lib/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAppStore } from '@/lib/stores/app-store';
import ReactJoyride, { CallBackProps, Step } from 'react-joyride';
import { pushSync, setCredential, getCredential, deleteCredential, hasCredential } from '@/lib/electron-sync';
import { isElectronAvailable, getLocalBackupPath, readLocalBackup, writeLocalBackup } from '@/lib/electron-storage';

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings, loadData, courses, tasks, addCourse, addTask } = useAppStore();
  const { addSemester, selectSemester, addMajor, selectMajor } = useAppStore();
  const [semesterStart, setSemesterStart] = useState('');
  const [previewData, setPreviewData] = useState<{courses:any[];tasks:any[]}>({courses:[],tasks:[]});
  const [previewOpen, setPreviewOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'all'|'current'>('all');
  const [exportIncludeSemesters, setExportIncludeSemesters] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete-course'|'erase-db'|null>(null);
  const [confirmTargetId, setConfirmTargetId] = useState<number | null>(null);
  const [confirmDeleteType, setConfirmDeleteType] = useState<'major'|'semester'|null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState<string | null>(null);
  const [confirmDeleteDeleteData, setConfirmDeleteDeleteData] = useState<boolean>(false);
  const [dedupeOption, setDedupeOption] = useState<'skip'|'overwrite'|'merge'>('skip');
  const [selectedPreview, setSelectedPreview] = useState<{courses: Set<number>; tasks: Set<number>}>({courses: new Set(), tasks: new Set()});
  const [selectedMajor, setSelectedMajor] = useState<string | 'Unspecified' | ''>('');
  const [newMajorDialogOpen, setNewMajorDialogOpen] = useState(false);
  const [newMajorName, setNewMajorName] = useState('');
  const [newMajorOptions, setNewMajorOptions] = useState<string[]>([]);
  const [selectedNewMajor, setSelectedNewMajor] = useState<string>('');
  const [importTargetMode, setImportTargetMode] = useState<'current'|'select'>('current');
  const [importTargetSemesterId, setImportTargetSemesterId] = useState<string | undefined>(undefined);
  const [importTargetMajor, setImportTargetMajor] = useState<string | ''>('');
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json'|'csv'|'xlsx'>('json');
  const [syncLoading, setSyncLoading] = useState(false);
  const [mongoUriInput, setMongoUriInput] = useState('');
  const [credStatus, setCredStatus] = useState<'unknown'|'present'|'absent'>('unknown');
  const [credLoading, setCredLoading] = useState(false);
  const [localBackupPath, setLocalBackupPath] = useState<string | null>(null);
  const [localBackupBusy, setLocalBackupBusy] = useState(false);
  const [localBackupStatus, setLocalBackupStatus] = useState<string | null>(null);
  const electronAvailable = isElectronAvailable();

  useEffect(() => {
    loadData();
  }, [loadData]);

  // joyride steps for guided tour
  const tourSteps: Step[] = [
    { target: '#new-sem-major', content: 'Choose a major for the semester or add a new one using the + button.' },
    { target: '#new-major-input', content: 'Enter a major name and click Add.' },
    { target: '#new-sem-number', content: 'Give the semester a number or identifier.' },
    { target: '#new-sem-start', content: 'Pick the semester start date — this is used to calculate week numbers.' },
    { target: '#add-semester-btn', content: 'Click here to add the semester.' },
  ];

  const handleJoyrideCallback = useCallback((data: CallBackProps) => {
    const { action, index, type, status } = data;
    // sync internal step index with Joyride's index
    setTourStep(index || 0);
    // close conditions
    if (status === 'finished' || status === 'skipped') {
      setTourOpen(false);
    }
    // when user navigates via Joyride controls, keep tourStep in sync
    if (type === 'step:after' && action === 'next') {
      setTourStep((s) => Math.min(s + 1, tourSteps.length - 1));
    }
    if (type === 'step:after' && action === 'prev') {
      setTourStep((s) => Math.max(s - 1, 0));
    }
  }, []);

  useEffect(() => {
  const active = settings?.semesters?.find(s => s.id === settings.activeSemesterId);
  if (active?.startDate) setSemesterStart(active.startDate);
  // default selectedMajor to the semester's activeMajor or first available major
  if (!selectedMajor) {
    const firstMajor = active?.activeMajor || Array.from(new Set((settings?.semesters || []).flatMap(s => s.majors || [])))[0];
    if (firstMajor) setSelectedMajor(firstMajor as string);
    else setSelectedMajor('Unspecified');
  }
  }, [settings]);

  // When the tour step changes, focus the relevant element and open/close major dialog as needed
  useEffect(() => {
    if (!tourOpen) return;
    const step = tourStep;
    // small delay so modals open/close before focusing
    setTimeout(() => {
      if (step === 0) {
        const el = document.getElementById('new-sem-major') as HTMLElement | null;
        el?.focus();
      }
      if (step === 1) {
        // open add-major dialog and focus its input
        setNewMajorDialogOpen(true);
        setTimeout(() => {
          const inel = document.getElementById('new-major-input') as HTMLInputElement | null;
          inel?.focus();
        }, 150);
      }
      if (step === 2) {
        // ensure add-major dialog is closed
        setNewMajorDialogOpen(false);
        const el = document.getElementById('new-sem-number') as HTMLElement | null;
        el?.focus();
      }
      if (step === 3) {
        const el = document.getElementById('new-sem-start') as HTMLElement | null;
        el?.focus();
      }
      if (step === 4) {
        const el = document.getElementById('add-semester-btn') as HTMLElement | null;
        el?.focus();
      }
    }, 120);
  }, [tourOpen, tourStep]);

  useEffect(() => {
    // reload when settings change
  }, [settings]);

  // mark client mount to avoid rendering Joyride on server (prevents hydration mismatch)
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isElectronAvailable()) return;
    getLocalBackupPath()
      .then((p) => setLocalBackupPath(p))
      .catch(() => {});
  }, []);

  // expose simple import helpers to the global window so the import parser can call them
  useEffect(() => {
    (window as any).__importAddCourse = async (c: any) => {
      try {
        const course = {
          title: c.title || c.name || 'Untitled',
          building: c.building || '',
          room: c.room || '',
          day: typeof c.day === 'number' ? c.day : Number(c.day) || 0,
          startTime: c.startTime || '09:00',
          endTime: c.endTime || '10:00',
          startWeek: Number(c.startWeek) || 1,
          endWeek: Number(c.endWeek) || 16,
          color: c.color || '#3B82F6',
          instructor: c.instructor || ''
        };
        await addCourse(course as any);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to import course', err);
      }
    };

    (window as any).__importAddTask = async (t: any) => {
      try {
        const task = {
          title: t.title || 'Untitled Task',
          description: t.description || '',
          dueDate: t.dueDate || new Date().toISOString().split('T')[0],
          completed: !!t.completed,
          priority: (t.priority as any) || 'low',
          createdAt: t.createdAt || new Date().toISOString(),
        };
        await addTask(task as any);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to import task', err);
      }
    };

    return () => {
      delete (window as any).__importAddCourse;
      delete (window as any).__importAddTask;
    };
  }, [addCourse, addTask]);

  
  const handleSemesterStartChange = async (date: string) => {
  setSemesterStart(date);
  // update active semester's startDate
  const active = settings?.semesters?.find(s => s.id === settings.activeSemesterId);
  if (!active) return;
  const updatedSemesters = (settings?.semesters || []).map(s => s.id === active.id ? { ...s, startDate: date } : s);
  await updateSettings({ semesters: updatedSemesters });
  };

  const buildExportPayload = () => {
    const payloadSettings = exportIncludeSemesters ? settings : undefined;
    const activeSemId = settings?.activeSemesterId;
    const scopeCourses = exportScope === 'all' ? courses : courses.filter(c => c.semesterId === activeSemId);
    const scopeTasks = exportScope === 'all' ? tasks : tasks.filter(t => t.semesterId === activeSemId);
    return {
      courses: scopeCourses,
      tasks: scopeTasks,
      settings: payloadSettings,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
  };

  const exportData = (format?: 'json'|'csv'|'xlsx') => {
    const fmt = format || exportFormat;
    const payload = buildExportPayload();
    const scopeCourses = payload.courses || [];
    const scopeTasks = payload.tasks || [];

    if (fmt === 'json') {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `studydash-export-${new Date().toISOString().split('T')[0]}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      return;
    }

    if (fmt === 'csv') {
      // simple CSV with courses followed by tasks
      let csv = 'type,title,building,room,day,startTime,endTime,startWeek,endWeek,color,instructor\n';
      scopeCourses.forEach((c:any) => {
        csv += `course,${c.title || ''},${c.building || ''},${c.room || ''},${c.day ?? ''},${c.startTime || ''},${c.endTime || ''},${c.startWeek ?? ''},${c.endWeek ?? ''},${c.color || ''},${c.instructor || ''}\n`;
      });
      csv += '\n';
      csv += 'type,title,description,dueDate,completed,priority,createdAt\n';
      scopeTasks.forEach((t:any) => {
        csv += `task,${t.title || ''},${t.description || ''},${t.dueDate || ''},${t.completed ? 'true' : 'false'},${t.priority || ''},${t.createdAt || ''}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `studydash-export-${new Date().toISOString().split('T')[0]}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      return;
    }

    // xlsx
    const wsCourses = XLSX.utils.json_to_sheet(scopeCourses);
    const wsTasks = XLSX.utils.json_to_sheet(scopeTasks);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsCourses, 'courses');
    XLSX.utils.book_append_sheet(wb, wsTasks, 'tasks');
    XLSX.writeFile(wb, `studydash-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const saveLocalBackup = async () => {
    if (!isElectronAvailable()) {
      alert('Local backup is only available in the desktop app.');
      return;
    }
    setLocalBackupBusy(true);
    setLocalBackupStatus(null);
    try {
      const payload = buildExportPayload();
      const res = await writeLocalBackup(payload);
      setLocalBackupStatus(res?.path ? `Saved to ${res.path}` : 'Saved');
    } catch (err) {
      console.error(err);
      alert('Failed to save local backup.');
    } finally {
      setLocalBackupBusy(false);
    }
  };

  const loadLocalBackup = async () => {
    if (!isElectronAvailable()) {
      alert('Local backup is only available in the desktop app.');
      return;
    }
    setLocalBackupBusy(true);
    setLocalBackupStatus(null);
    try {
      const data = await readLocalBackup();
      if (!data) {
        alert('No local backup found.');
        return;
      }
      const courses = Array.isArray(data.courses) ? data.courses : [];
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      setPreviewData({ courses, tasks });
      setSelectedPreview({
        courses: new Set(courses.map((_: any, i: number) => i)),
        tasks: new Set(tasks.map((_: any, i: number) => i))
      });
      setPreviewOpen(true);
      setLocalBackupStatus('Loaded local backup into preview.');
    } catch (err) {
      console.error(err);
      alert('Failed to load local backup.');
    } finally {
      setLocalBackupBusy(false);
    }
  };

  const downloadSample = (type: 'json' | 'csv' | 'xlsx') => {
    const sample = {
      courses: [
        {
          title: 'Calculus I', building: 'Main', room: '101', day: 1,
          startTime: '09:00', endTime: '10:30', startWeek: 1, endWeek: 16, color: '#3B82F6', instructor: 'Dr. Li'
        }
      ],
      tasks: [
        { title: 'Homework 1', description: 'Limits', dueDate: new Date().toISOString().split('T')[0], completed: false, priority: 'high', createdAt: new Date().toISOString() }
      ]
    };

    if (type === 'json') {
      const blob = new Blob([JSON.stringify(sample, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'studydash-sample.json'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      return;
    }

    if (type === 'csv') {
      // simple CSV with courses followed by tasks
      let csv = 'type,title,building,room,day,startTime,endTime,startWeek,endWeek,color,instructor\n';
      sample.courses.forEach(c => {
        csv += `course,${c.title},${c.building},${c.room},${c.day},${c.startTime},${c.endTime},${c.startWeek},${c.endWeek},${c.color},${c.instructor}\n`;
      });
      csv += '\n';
      csv += 'type,title,description,dueDate,completed,priority,createdAt\n';
      sample.tasks.forEach(t => {
        csv += `task,${t.title},${t.description},${t.dueDate},${t.completed},${t.priority},${t.createdAt}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'studydash-sample.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      return;
    }

    // xlsx
    const wsCourses = XLSX.utils.json_to_sheet(sample.courses);
    const wsTasks = XLSX.utils.json_to_sheet(sample.tasks);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsCourses, 'courses');
    XLSX.utils.book_append_sheet(wb, wsTasks, 'tasks');
    XLSX.writeFile(wb, 'studydash-sample.xlsx');
  };

  const resetFileInput = (id = 'import-file') => {
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input) input.value = '';
  };

  const importData = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const name = file.name.toLowerCase();

    if (name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          setPreviewData({ courses: parsed.courses || [], tasks: parsed.tasks || [] });
          setSelectedPreview({ courses: new Set((parsed.courses || []).map((_:any,i:number)=>i)), tasks: new Set((parsed.tasks || []).map((_:any,i:number)=>i)) });
          setPreviewOpen(true);
        } catch (err) {
          console.error(err);
          alert('Invalid JSON');
        } finally { resetFileInput(); }
      };
      reader.readAsText(file);
      return;
    }

    if (name.endsWith('.csv')) {
      const Papa = (await import('papaparse')).default;
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results: any) => {
          const rows = results.data as any[];
          const courses: any[] = [];
          const tasks: any[] = [];
          for (const r of rows) {
            const type = (r.type || '').toString().toLowerCase();
            if (type === 'course') courses.push(r);
            else if (type === 'task') tasks.push(r);
          }
          setPreviewData({ courses, tasks });
          setSelectedPreview({ courses: new Set(courses.map((_:any,i:number)=>i)), tasks: new Set(tasks.map((_:any,i:number)=>i)) });
          setPreviewOpen(true);
          resetFileInput();
        },
        error: (err: any) => { console.error(err); alert('CSV parse error'); resetFileInput(); }
      });
      return;
    }

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const parsedAny: any = { courses: [], tasks: [] };
          if (wb.SheetNames.includes('courses')) parsedAny.courses = XLSX.utils.sheet_to_json(wb.Sheets['courses']);
          if (wb.SheetNames.includes('tasks')) parsedAny.tasks = XLSX.utils.sheet_to_json(wb.Sheets['tasks']);
          setPreviewData(parsedAny);
          setSelectedPreview({ courses: new Set(parsedAny.courses.map((_:any,i:number)=>i)), tasks: new Set(parsedAny.tasks.map((_:any,i:number)=>i)) });
          setPreviewOpen(true);
        } catch (err) { console.error(err); alert('Excel parse error'); }
        finally { resetFileInput(); }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    alert('Unsupported file type. Use JSON, CSV or Excel.');
    resetFileInput();
  };

  const toggleSelect = (kind: 'courses'|'tasks', index: number) => {
    setSelectedPreview(prev => {
      const copy = { courses: new Set(prev.courses), tasks: new Set(prev.tasks) };
      const set = kind === 'courses' ? copy.courses : copy.tasks;
      if (set.has(index)) set.delete(index); else set.add(index);
      return copy;
    });
  };

  const handleImportConfirm = async () => {
    // When importing into a manually selected target semester/major, write directly to the DB
    // and dedupe against that semester's existing data. Otherwise fall back to current active semester.
    const db = getDb();

    // determine target semester and major
    const targetSemesterId = importTargetMode === 'select' ? importTargetSemesterId : settings?.activeSemesterId;
    if (!targetSemesterId) {
      alert('No target semester selected for import.');
      return;
    }
    const targetMajor = importTargetMode === 'select'
      ? (importTargetMajor === '__unspecified' ? undefined : (importTargetMajor || undefined))
      : settings?.semesters?.find(s => s.id === settings.activeSemesterId)?.activeMajor;

    // load existing items for dedupe checks scoped to the target semester
    const existingCourses = await db.courses.where('semesterId').equals(targetSemesterId).toArray();
    const existingTasks = await db.tasks.where('semesterId').equals(targetSemesterId).toArray();

    // helper to merge fields for 'merge' dedupe option
    const mergeFields = (existing: any, incoming: any) => {
      const updates: any = {};
      for (const k of Object.keys(incoming)) {
        if ((existing as any)[k] === undefined || (existing as any)[k] === '') updates[k] = (incoming as any)[k];
      }
      return updates;
    };

    // process courses
    for (let i = 0; i < previewData.courses.length; i++) {
      const c = previewData.courses[i];
      if (!selectedPreview.courses.has(i)) continue;
      const norm = {
        title: c.title || c.name || 'Untitled',
        building: c.building || '',
        room: c.room || '',
        day: Number(c.day) || 0,
        startTime: c.startTime || '09:00',
        endTime: c.endTime || '10:00',
        startWeek: Number(c.startWeek) || 1,
        endWeek: Number(c.endWeek) || 16,
        color: c.color || '#3B82F6',
        instructor: c.instructor || ''
      };

      const existing = existingCourses.find(x => x.title === norm.title && x.startTime === norm.startTime);
      if (existing) {
        if (dedupeOption === 'skip') continue;
        if (dedupeOption === 'overwrite') {
          await db.courses.update(existing.id, { ...norm });
        }
        if (dedupeOption === 'merge') {
          const updates = mergeFields(existing, norm);
          if (Object.keys(updates).length) await db.courses.update(existing.id, updates);
        }
      } else {
        await db.courses.add({ ...norm, semesterId: targetSemesterId, major: targetMajor } as any);
      }
    }

    // process tasks
    for (let i = 0; i < previewData.tasks.length; i++) {
      const t = previewData.tasks[i];
      if (!selectedPreview.tasks.has(i)) continue;
      const norm = {
        title: t.title || 'Untitled Task',
        description: t.description || '',
        dueDate: t.dueDate || new Date().toISOString().split('T')[0],
        completed: !!t.completed,
        priority: (t.priority as any) || 'low',
        createdAt: t.createdAt || new Date().toISOString(),
      };

      const existing = existingTasks.find(x => x.title === norm.title && x.dueDate === norm.dueDate);
      if (existing) {
        if (dedupeOption === 'skip') continue;
        if (dedupeOption === 'overwrite') {
          await db.tasks.update(existing.id, { ...norm });
        }
        if (dedupeOption === 'merge') {
          const updates = mergeFields(existing, norm);
          if (Object.keys(updates).length) await db.tasks.update(existing.id, updates);
        }
      } else {
        await db.tasks.add({ ...norm, semesterId: targetSemesterId, major: targetMajor } as any);
      }
    }

    setPreviewOpen(false);
    setPreviewData({ courses: [], tasks: [] });
    setSelectedPreview({ courses: new Set(), tasks: new Set() });
    await loadData();
    alert('Import finished');
  };

  return (
    <div className="space-y-6">
      {/* Joyride guided tour (client-only to avoid SSR hydration mismatch) */}
      {mounted && (
        <ReactJoyride
          steps={tourSteps}
          run={tourOpen}
          stepIndex={tourStep}
          continuous={true}
          showSkipButton={true}
          showProgress={true}
          callback={handleJoyrideCallback}
          styles={{ options: { zIndex: 10000 } }}
        />
      )}
      {/* Header */}
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">
              Customize your dashboard preferences
            </p>
          </div>
          <div>
            {/* Take tour button temporarily disabled
            <Button onClick={() => { setTourOpen(true); setTourStep(0); }} variant="outline">Take tour</Button>
            */}
          </div>
        </div>
      </div>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
              {/* appearance-only content */}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Label>Theme</Label>
            {/* Defer rendering of Radix RadioGroup until after client mount to avoid
                hydration mismatches between server and client markup. */}
            {mounted ? (
              <RadioGroup 
                value={theme ?? 'system'} 
                onValueChange={setTheme}
                className="grid grid-cols-3 gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="light" id="light" />
                  <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer">
                    <Sun className="h-4 w-4" />
                    Light
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="dark" id="dark" />
                  <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer">
                    <Moon className="h-4 w-4" />
                    Dark
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="system" id="system" />
                  <Label htmlFor="system" className="flex items-center gap-2 cursor-pointer">
                    <Monitor className="h-4 w-4" />
                    System
                  </Label>
                </div>
              </RadioGroup>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center space-x-2 opacity-0">
                  <span className="h-4 w-4 block" />
                  <span>Light</span>
                </div>
                <div className="flex items-center space-x-2 opacity-0">
                  <span className="h-4 w-4 block" />
                  <span>Dark</span>
                </div>
                <div className="flex items-center space-x-2 opacity-0">
                  <span className="h-4 w-4 block" />
                  <span>System</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Semester Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Majors & Semesters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label>Semesters</Label>
              <div className="mt-2 grid gap-2">
                {/* Single-major dropdown + filtered semester list */}
                <div className="space-y-3">
                  <div>
                    <Label>Major</Label>
                    <div className="mt-2 flex gap-2 items-center">
                      <select className="rounded-md border px-2 py-1" value={selectedMajor} onChange={(e) => setSelectedMajor(e.target.value)}>
                        <option value="Unspecified">Unspecified</option>
                        {Array.from(new Set((settings?.semesters || []).flatMap(s => s.majors || []))).map((m:any) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                      <div className="text-sm text-muted-foreground">Choose a major to view its semesters</div>
                    </div>
                  </div>

                  <div className="overflow-auto">
                    <table className="w-full table-auto border-collapse">
                      <thead>
                        <tr>
                          <th className="border p-2 text-left">Semester</th>
                          <th className="border p-2 text-left">Start Date</th>
                          <th className="border p-2 text-left">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {((settings?.semesters || [])
                          .filter(s => {
                            if (selectedMajor === 'Unspecified') return !(s.majors && s.majors.length);
                            return (s.majors || []).includes(selectedMajor as string);
                          })
                          .map(s => (
                          <tr key={s.id}>
                            <td className="border p-2">{s.name}</td>
                            <td className="border p-2">
                              <Input
                                type="date"
                                value={s.startDate}
                                onChange={async (e) => {
                                  const newDate = (e.target as HTMLInputElement).value;
                                  try {
                                    const updatedSemesters = (settings?.semesters || []).map((ss:any) => ss.id === s.id ? { ...ss, startDate: newDate } : ss);
                                    await updateSettings({ semesters: updatedSemesters });
                                  } catch (err) {
                                    console.error('Failed to update semester start date', err);
                                  }
                                }}
                                className="w-full"
                              />
                            </td>
                            <td className="border p-2">
                              <div className="flex gap-2">
                                <Button variant={settings?.activeSemesterId === s.id ? 'secondary' : 'ghost'} onClick={() => selectSemester(s.id)}>
                                  {settings?.activeSemesterId === s.id ? 'Active' : 'Select'}
                                </Button>
                                <Button variant="destructive" onClick={() => { setConfirmDeleteType('semester'); setConfirmDeleteName(s.id); setConfirmDeleteDeleteData(false); setConfirmOpen(true); }}>Delete</Button>
                              </div>
                            </td>
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Add Semester */}
      <Card>
        <CardHeader>
          <CardTitle>Add Semester</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            <div className="grid grid-cols-2 gap-2 items-end">
              <div>
                <Label htmlFor="new-sem-number">Semester number</Label>
                <Input placeholder="Semester number (e.g., 1, 2, 20251)" id="new-sem-number" />
              </div>
              <div>
                <Label htmlFor="new-sem-start">Semester start date</Label>
                <Input type="date" id="new-sem-start" />
              </div>
            </div>

            {/* Major chooser for new semester (choose existing or add new via dialog) */}
            <div className="mt-2 grid grid-cols-3 gap-2 items-end">
              <div className="col-span-3">
                <Label htmlFor="new-sem-major">Major</Label>
                <div className="mt-1 flex items-center gap-2">
                  <select
                    id="new-sem-major"
                    className="rounded-md border px-2 py-1 w-full"
                    value={selectedNewMajor}
                    onChange={(e) => setSelectedNewMajor(e.target.value)}
                  >
                    <option value="">-- none --</option>
                    {Array.from(new Set((settings?.semesters || []).flatMap(s => s.majors || []).concat(newMajorOptions))).map((m:any) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <Button onClick={() => setNewMajorDialogOpen(true)} title="Add major">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={async () => {
                const number = (document.getElementById('new-sem-number') as HTMLInputElement).value || `${Date.now()}`;
                const start = (document.getElementById('new-sem-start') as HTMLInputElement).value || new Date().toISOString().split('T')[0];
                const id = String(number);
                const majorToUse = selectedNewMajor || undefined;
                const semPayload: any = { id, name: `Semester ${id}`, startDate: start };
                if (majorToUse) {
                  semPayload.majors = [majorToUse];
                  semPayload.activeMajor = majorToUse;
                }
                await addSemester(semPayload);
                await selectSemester(id);
                // ensure UI updates immediately for the newly created semester
                await loadData();
                setSemesterStart(start);
                if (majorToUse) setSelectedMajor(majorToUse);
                else setSelectedMajor('Unspecified');
              }}>Add semester</Button>
            </div>

            {/* Per-semester start dates are editable in the table above. */}
          </div>
        </CardContent>
      </Card>

  {/* Majors are handled during semester creation; removed separate Major card per user request */}

      {/* Data Management */}
      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Export section */}
            <div className="p-3 border rounded">
              <h4 className="font-semibold mb-2">Export</h4>
              <p className="text-sm text-muted-foreground mb-3">Download a full backup of your data.</p>
              <div className="mb-3">
                <div className="text-sm text-muted-foreground">Use the preview to adjust scope and include metadata before exporting.</div>
              </div>
              <Button onClick={() => setExportPreviewOpen(true)} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
              <div className="mt-2">
                <Button onClick={async () => {
                  setSyncLoading(true);
                  try {
                    const activeSemId = settings?.activeSemesterId;
                    const scopeCourses = exportScope === 'all' ? courses : courses.filter(c => c.semesterId === activeSemId);
                    const scopeTasks = exportScope === 'all' ? tasks : tasks.filter(t => t.semesterId === activeSemId);
                    const payload = { courses: scopeCourses, tasks: scopeTasks };

                    // If running inside Electron, use the preload bridge
                    if ((window as any).electronAPI?.syncPush) {
                      try {
                        const res = await pushSync(payload);
                        alert(`Synced ${res.courses} courses and ${res.tasks} tasks to MongoDB`);
                      } catch (err) {
                        console.error('Electron sync failed', err);
                        alert('Sync failed: ' + String(err));
                      }
                    } else {
                      // Fallback to server API route
                      try {
                        const resp = await fetch('/api/sync', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(payload)
                        });
                        const data = await resp.json();
                        if (resp.ok) {
                          alert(`Synced ${data.coursesUpserted || 0} courses and ${data.tasksUpserted || 0} tasks to server`);
                        } else {
                          alert('Sync failed: ' + (data?.error || resp.statusText));
                        }
                      } catch (err) {
                        console.error('Server sync failed', err);
                        alert('Sync failed: ' + String(err));
                      }
                    }
                  } finally {
                    setSyncLoading(false);
                  }
                }} className="w-full mt-2" disabled={syncLoading}>
                  <Upload className="h-4 w-4 mr-2" />
                  {syncLoading ? 'Syncing…' : 'Sync to Cloud'}
                </Button>
              </div>
              <div className="mt-4 p-3 border rounded">
                <h4 className="font-semibold mb-2">Cloud credentials</h4>
                <p className="text-sm text-muted-foreground mb-2">Set the MongoDB connection string for cloud sync (stored securely on this machine).</p>
                <div className="grid gap-2">
                  <Input placeholder="mongodb+srv://..." value={mongoUriInput} onChange={(e) => setMongoUriInput((e.target as HTMLInputElement).value)} />
                  <div className="flex gap-2">
                    <Button onClick={async () => {
                      setCredLoading(true);
                      try {
                        await setCredential('studydash', 'mongodb', mongoUriInput);
                        alert('Saved MongoDB URI securely');
                        setCredStatus('present');
                      } catch (err) { console.error(err); alert('Failed to save credential'); }
                      finally { setCredLoading(false); }
                    }} disabled={credLoading}>
                      Save
                    </Button>
                    <Button onClick={async () => {
                      setCredLoading(true);
                      try {
                        const v = await getCredential('studydash', 'mongodb');
                        if (v) { alert('Credential present'); setCredStatus('present'); }
                        else { alert('No credential saved'); setCredStatus('absent'); }
                      } catch (err) { console.error(err); alert('Failed to read credential'); }
                      finally { setCredLoading(false); }
                    }} disabled={credLoading}>
                      Check
                    </Button>
                    <Button variant="destructive" onClick={async () => {
                      setCredLoading(true);
                      try {
                        const ok = await deleteCredential('studydash', 'mongodb');
                        alert(ok ? 'Credential removed' : 'No credential found');
                        setCredStatus(ok ? 'absent' : 'absent');
                      } catch (err) { console.error(err); alert('Failed to remove credential'); }
                      finally { setCredLoading(false); }
                    }} disabled={credLoading}>
                      Remove
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">Status: {credStatus}</div>
                </div>
              </div>
            </div>

            {/* Local backup section (Electron) */}
            <div className="p-3 border rounded">
              <h4 className="font-semibold mb-2">Local Backup (Desktop)</h4>
              <p className="text-sm text-muted-foreground mb-3">Save a backup to this computer&apos;s app data folder.</p>
              {localBackupPath && (
                <div className="text-xs text-muted-foreground mb-2">Path: {localBackupPath}</div>
              )}
              <div className="flex gap-2">
                <Button onClick={saveLocalBackup} disabled={!electronAvailable || localBackupBusy} className="flex-1">
                  {localBackupBusy ? 'Working...' : 'Save Backup'}
                </Button>
                <Button onClick={loadLocalBackup} disabled={!electronAvailable || localBackupBusy} variant="secondary" className="flex-1">
                  {localBackupBusy ? 'Working...' : 'Restore Backup'}
                </Button>
              </div>
              {localBackupStatus && (
                <div className="text-xs text-muted-foreground mt-2">{localBackupStatus}</div>
              )}
              {!electronAvailable && (
                <div className="text-xs text-muted-foreground mt-2">Available in the desktop app.</div>
              )}
            </div>

            {/* Import section */}
            <div className="p-3 border rounded">
              <h4 className="font-semibold mb-2">Import</h4>
              <p className="text-sm text-muted-foreground mb-3">Download a sample and import it to populate courses and tasks.</p>
              <div className="flex gap-2 items-center mb-3">
                <select id="sample-format" className="rounded-md border px-2 py-1 text-sm">
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel</option>
                </select>
                <Button onClick={() => downloadSample((document.getElementById('sample-format') as HTMLSelectElement).value as any)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download Sample
                </Button>
              </div>

              <div className="mb-3">
                <div className="text-sm text-muted-foreground">Use the preview to choose the target semester/major for the import.</div>
              </div>

              <div className="relative">
                <Button asChild className="w-full">
                  <label htmlFor="import-file" className="cursor-pointer flex items-center justify-center">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Data
                  </label>
                </Button>
                <Input
                  id="import-file"
                  type="file"
                  accept=".json,.csv,.xlsx,.xls"
                  onChange={importData}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent>
          <DialogHeader>
            <DialogTitle>Import preview</DialogTitle>
            <DialogDescription>Review parsed items and choose dedupe behavior.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[60vh] overflow-auto">
            {/* Import target controls inside preview */}
            <div className="mb-3">
              <Label>Import target</Label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input type="radio" name="import-target-preview" checked={importTargetMode === 'current'} onChange={() => setImportTargetMode('current')} />
                  <span className="text-sm">Import into current semester/major</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="import-target-preview" checked={importTargetMode === 'select'} onChange={() => setImportTargetMode('select')} />
                  <span className="text-sm">Select semester/major</span>
                </label>
              </div>
              {importTargetMode === 'select' && (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select className="rounded-md border px-2 py-1" value={importTargetSemesterId} onChange={(e) => setImportTargetSemesterId(e.target.value)}>
                    <option value="">-- select semester --</option>
                    {settings?.semesters?.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                  <select className="rounded-md border px-2 py-1" value={importTargetMajor} onChange={(e) => setImportTargetMajor(e.target.value)}>
                    <option value="">-- select major --</option>
                    <option value="__unspecified">Unspecified</option>
                    {Array.from(new Set([
                      ...(settings?.semesters?.find(s => s.id === importTargetSemesterId)?.majors || []),
                      ...((settings?.semesters || []).flatMap(s => s.majors || [])),
                      ...newMajorOptions
                    ])).map((m:any) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Courses ({previewData.courses.length})</h3>
                <div className="flex items-center gap-2">
                  <label className="text-sm mr-2">Dedupe:</label>
                  <select value={dedupeOption} onChange={(e) => setDedupeOption(e.target.value as any)} className="rounded-md border px-2 py-1">
                    <option value="skip">Skip duplicates</option>
                    <option value="overwrite">Overwrite</option>
                    <option value="merge">Merge</option>
                  </select>
                </div>
              </div>

              <div className="mt-2 grid gap-2">
                {previewData.courses.map((c, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 border rounded">
                    <Checkbox checked={selectedPreview.courses.has(i)} onCheckedChange={() => toggleSelect('courses', i)} />
                    <div>
                      <div className="font-medium">{c.title}</div>
                      <div className="text-sm text-muted-foreground">{c.startTime} • {c.building} {c.room}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-semibold">Tasks ({previewData.tasks.length})</h3>
              <div className="mt-2 grid gap-2">
                {previewData.tasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-3 p-2 border rounded">
                    <Checkbox checked={selectedPreview.tasks.has(i)} onCheckedChange={() => toggleSelect('tasks', i)} />
                    <div>
                      <div className="font-medium">{t.title}</div>
                      <div className="text-sm text-muted-foreground">Due {t.dueDate}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setPreviewOpen(false); setPreviewData({courses:[],tasks:[]}); }}>Cancel</Button>
            <Button onClick={handleImportConfirm}>Import selected</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Export Preview Modal */}
      <Dialog open={exportPreviewOpen} onOpenChange={setExportPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export preview</DialogTitle>
            <DialogDescription>Confirm export options and preview counts before downloading.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Export scope</Label>
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2">
                  <input type="radio" name="export-scope-preview" checked={exportScope === 'all'} onChange={() => setExportScope('all')} />
                  <span className="text-sm">All data</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="export-scope-preview" checked={exportScope === 'current'} onChange={() => setExportScope('current')} />
                  <span className="text-sm">Current semester</span>
                </label>
              </div>
              <label className="flex items-center gap-2 mt-2">
                <input type="checkbox" checked={exportIncludeSemesters} onChange={(e) => setExportIncludeSemesters(e.target.checked)} />
                <span className="text-sm">Include semesters & majors metadata</span>
              </label>
            </div>

            <div>
              <Label>Format</Label>
              <div className="mt-2 flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <input type="radio" name="export-format" checked={exportFormat === 'json'} onChange={() => setExportFormat('json')} />
                  <span className="text-sm">JSON</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="export-format" checked={exportFormat === 'csv'} onChange={() => setExportFormat('csv')} />
                  <span className="text-sm">CSV</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="export-format" checked={exportFormat === 'xlsx'} onChange={() => setExportFormat('xlsx')} />
                  <span className="text-sm">Excel (.xlsx)</span>
                </label>
              </div>
            </div>

            <div>
              <h3 className="font-semibold">Preview</h3>
              <div className="mt-2 text-sm text-muted-foreground">
                {exportScope === 'all' ? (
                  <>
                    Courses: {courses.length} • Tasks: {tasks.length}
                  </>
                ) : (
                  (() => {
                    const activeSemId = settings?.activeSemesterId;
                    const semCourses = courses.filter(c => c.semesterId === activeSemId);
                    const semTasks = tasks.filter(t => t.semesterId === activeSemId);
                    return (<>{`Courses: ${semCourses.length} • Tasks: ${semTasks.length}`}</>);
                  })()
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExportPreviewOpen(false)}>Cancel</Button>
            <Button onClick={() => { exportData(exportFormat); setExportPreviewOpen(false); }}>Download export</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Major Dialog (for semester creation) */}
      <Dialog open={newMajorDialogOpen} onOpenChange={setNewMajorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add major</DialogTitle>
            <DialogDescription>Enter a major name to add it to the selection list.</DialogDescription>
          </DialogHeader>
          <div className="mt-2">
            <Label>Major name</Label>
            <Input id="new-major-input" value={newMajorName} onChange={(e) => setNewMajorName(e.target.value)} placeholder="e.g., CS" className="mt-1" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setNewMajorDialogOpen(false); setNewMajorName(''); }}>Cancel</Button>
            <Button onClick={async () => {
              const name = newMajorName.trim();
              if (!name) return;
              // add to local options and clear input
              setNewMajorOptions(prev => Array.from(new Set([...prev, name])));
              setSelectedNewMajor(name);
              // persist at store level so it's available elsewhere if desired
              try { await addMajor(name); } catch (err) { /* ignore */ }
              setNewMajorDialogOpen(false);
              setNewMajorName('');
            }}>Add major</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{
                (() => {
                  try {
                    const set = new Set<string>();
                    (courses || []).forEach((c:any) => {
                      if (c.seriesId) set.add(`series:${c.seriesId}`);
                      else set.add(`title:${(c.title || '').trim()}`);
                    });
                    return set.size;
                  } catch (err) { return courses.length; }
                })()
              }</div>
              <div className="text-sm text-muted-foreground">Courses</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{tasks.length}</div>
              <div className="text-sm text-muted-foreground">Tasks</div>
            </div>
          </div>

          <div className="mt-4 border-t pt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <Label>Delete a course</Label>
              <div className="flex gap-2">
                <select id="delete-course-select" className="flex-1 rounded-md border px-2 py-1">
                  <option value="">-- select course --</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
                <Button id="delete-course-btn" onClick={async () => {
                  const sel = document.getElementById('delete-course-select') as HTMLSelectElement | null;
                  const id = sel ? Number(sel.value) : NaN;
                  if (!id) return alert('Select a course to delete');
                  setConfirmAction('delete-course');
                  setConfirmTargetId(id);
                  setConfirmOpen(true);
                }}>
                  Delete
                </Button>
              </div>
            </div>

            <div>
              <Label>Danger zone</Label>
              <div className="mt-2">
                <Button className="w-full bg-red-600 hover:bg-red-700" onClick={async () => {
                  setConfirmAction('erase-db');
                  setConfirmTargetId(null);
                  setConfirmOpen(true);
                }}>
                  Erase database
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm dialog for delete/erase actions and major/semester deletions */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDeleteType === 'major' ? `Delete major ${confirmDeleteName}` : confirmDeleteType === 'semester' ? `Delete semester ${confirmDeleteName}` : (confirmAction === 'erase-db' ? 'Erase entire database' : 'Delete course')}
            </DialogTitle>
            <DialogDescription>
              {confirmDeleteType === 'major' && (
                <>
                  Deleting this major will remove it from the list of majors.
                  {confirmDeleteDeleteData ? ' Associated courses and tasks for this major will be deleted.' : ' Courses and tasks will remain.'}
                </>
              )}
              {confirmDeleteType === 'semester' && (
                <>
                  Deleting this semester will remove it and {confirmDeleteDeleteData ? 'also delete associated courses and tasks.' : 'leave associated courses and tasks in the DB (they will be unscoped).'}
                </>
              )}
              {(!confirmDeleteType) && (
                confirmAction === 'erase-db'
                  ? 'This will permanently remove all courses, tasks and settings. This action cannot be undone.'
                  : 'Are you sure you want to delete the selected course? This cannot be undone.'
              )}
            </DialogDescription>
          </DialogHeader>
          {confirmDeleteType && (
            <div className="mt-2">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={confirmDeleteDeleteData} onChange={(e) => setConfirmDeleteDeleteData(e.target.checked)} />
                <span className="text-sm">Also delete associated data (courses/tasks)</span>
              </label>
            </div>
          )}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              setConfirmOpen(false);
              if (confirmDeleteType === 'major' && confirmDeleteName) {
                await (await import('@/lib/stores/app-store')).useAppStore.getState()?.removeMajor?.(confirmDeleteName, confirmDeleteDeleteData);
              } else if (confirmDeleteType === 'semester' && confirmDeleteName) {
                await (await import('@/lib/stores/app-store')).useAppStore.getState()?.deleteSemester?.(confirmDeleteName, confirmDeleteDeleteData);
              } else {
                if (confirmAction === 'delete-course' && confirmTargetId) {
                  await (await import('@/lib/stores/app-store')).useAppStore.getState()?.deleteCourse?.(confirmTargetId);
                  await loadData();
                }
                if (confirmAction === 'erase-db') {
                  await (await import('@/lib/stores/app-store')).useAppStore.getState()?.clearDatabase?.();
                  await loadData();
                }
              }
              // reset confirm state
              setConfirmAction(null);
              setConfirmTargetId(null);
              setConfirmDeleteType(null);
              setConfirmDeleteName(null);
              setConfirmDeleteDeleteData(false);
            }} className={(confirmDeleteType === 'major' || confirmDeleteType === 'semester' || confirmAction === 'erase-db') ? 'bg-red-600 hover:bg-red-700' : ''}>
              {confirmDeleteType === 'major' ? 'Delete major' : confirmDeleteType === 'semester' ? 'Delete semester' : (confirmAction === 'erase-db' ? 'Erase' : 'Delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
