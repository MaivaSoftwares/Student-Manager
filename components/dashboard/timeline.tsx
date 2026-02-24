"use client";

import { useEffect, useState } from 'react';
import { format, startOfWeek, differenceInWeeks } from 'date-fns';
import { Clock, MapPin, User, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/lib/stores/app-store';
import { Course, Exam } from '@/lib/database';

export function Timeline() {
  const { getCoursesForDay } = useAppStore();
  const courses = useAppStore(state => state.courses);
  const currentWeek = useAppStore(state => state.currentWeek);
  const settings = useAppStore(state => state.settings);
  const exams = useAppStore(state => state.exams);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());
  const [displayedWeek, setDisplayedWeek] = useState<number>(currentWeek);
  const [todaysCourses, setTodaysCourses] = useState<Course[]>([]);
  const [todaysExams, setTodaysExams] = useState<Exam[]>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const parseTime = (t: string) => {
      const [h, m] = (t || '00:00').split(':').map(x => Number(x));
      return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    };
    // compute courses for the selected day from store so updates when data loads
    const filtered = (courses || []).filter(course => {
      const inWeek = course.day === selectedDay && course.startWeek <= displayedWeek && course.endWeek >= displayedWeek;
      if (!inWeek) return false;
      return true;
    });
    const sorted = filtered.slice().sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
    setTodaysCourses(sorted);

    // compute exams for the selected day that fall in the displayed week of the active semester
    const activeSemester = settings?.semesters?.find(s => s.id === settings.activeSemesterId);
    const semStartStr = activeSemester?.startDate;
    const semWeekStart = semStartStr ? startOfWeek(new Date(semStartStr), { weekStartsOn: 0 }) : null;
    const filteredExams = (exams || []).filter(ex => {
      if (!ex.date) return false;
      const exDate = new Date(`${ex.date}T00:00`);
      if (exDate.getDay() !== selectedDay) return false;
      if (!semWeekStart) return true;
      const exWeekStart = startOfWeek(exDate, { weekStartsOn: 0 });
      const weekNum = Math.max(1, differenceInWeeks(exWeekStart, semWeekStart) + 1);
      return weekNum === displayedWeek;
    });
    const sortedExams = filteredExams.slice().sort((a, b) => {
      const ta = (a.time || '00:00');
      const tb = (b.time || '00:00');
      return ta.localeCompare(tb);
    });
    setTodaysExams(sortedExams);
  }, [courses, exams, settings, displayedWeek, selectedDay]);

  // determine the next upcoming course for the selected day
  const nextUpcoming = (() => {
    const now = currentTime.getTime();
    for (const c of todaysCourses) {
      const start = parseDayTimeToDate(selectedDay, c.startTime || '00:00').getTime();
      if (start > now) return c;
    }
    return null;
  })();

  const isCurrentCourse = (course: Course) => {
    if (selectedDay !== new Date().getDay()) return false;

    const now = currentTime;
    const currentTimeStr = format(now, 'HH:mm');

    return currentTimeStr >= course.startTime && currentTimeStr <= course.endTime;
  };

  const isUpcomingCourse = (course: Course) => {
    if (selectedDay !== new Date().getDay()) return false;

    const now = currentTime;
    const currentTimeStr = format(now, 'HH:mm');

    return currentTimeStr < course.startTime;
  };

  function parseDayTimeToDate(dayIndex: number, timeStr: string) {
    // Find the next date matching the dayIndex within this week (including today)
    const now = new Date();
    const delta = (dayIndex - now.getDay() + 7) % 7;
    const dt = new Date(now);
    dt.setDate(now.getDate() + delta);
    const [h, m] = (timeStr || '00:00').split(':').map(x => Number(x));
    dt.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
    return dt;
  }

  // Normalize HH:MM to minutes since midnight for reliable sorting
  const toMinutes = (t?: string | null) => {
    if (!t || typeof t !== 'string') return 24 * 60; // push unknown times to end
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return 24 * 60;
    const h = Number(m[1]);
    const mm = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(mm)) return 24 * 60;
    return h * 60 + mm;
  };

  const timeLeftForCourse = (course: Course) => {
    // Only meaningful for currently active courses on the selected day
    const endDate = parseDayTimeToDate(selectedDay, course.endTime || '00:00');
    const diff = endDate.getTime() - currentTime.getTime();
    if (diff <= 0) return null;
    const totalSec = Math.floor(diff / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  };

  const combinedCount = todaysCourses.length + todaysExams.length;
  if (combinedCount === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">
                {selectedDay === new Date().getDay() ? "Today's Schedule" : 'Schedule'}
              </span>
              <label className="sr-only" htmlFor="timeline-day-select">Select day</label>
              <select
                id="timeline-day-select"
                value={selectedDay}
                onChange={(e) => setSelectedDay(Number(e.target.value))}
                className="ml-2 rounded-md border px-3 py-1 text-sm bg-white/80 dark:bg-black/40 shadow-sm"
              >
                {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
                  <option key={d} value={i}>{d}</option>
                ))}
              </select>
              <div className="ml-3 flex items-center gap-2">
                <button
                  className="px-2 py-1 text-xs rounded border hover:bg-accent"
                  onClick={() => setDisplayedWeek((w) => Math.max(1, w - 1))}
                  aria-label="Previous week"
                >
                  ◀ Prev
                </button>
                <div className="text-xs text-muted-foreground">Week {displayedWeek}</div>
                <button
                  className="px-2 py-1 text-xs rounded border hover:bg-accent"
                  onClick={() => setDisplayedWeek((w) => w + 1)}
                  aria-label="Next week"
                >
                  Next ▶
                </button>
                {displayedWeek !== currentWeek && (
                  <button
                    className="px-2 py-1 text-xs rounded border hover:bg-accent"
                    onClick={() => setDisplayedWeek(currentWeek)}
                  >
                    Today
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(), 'EEEE, MMMM do')}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">No items scheduled for this day.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <style jsx>{`
        @keyframes breathe {
          0% { transform: scale(1); box-shadow: 0 0 0 rgba(59,130,246,0); }
          50% { transform: scale(1.02); box-shadow: 0 8px 24px rgba(59,130,246,0.12); }
          100% { transform: scale(1); box-shadow: 0 0 0 rgba(59,130,246,0); }
        }
        .live-breathe {
          animation: breathe 2.5s ease-in-out infinite;
          border-radius: 0.5rem;
        }
      `}</style>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            <span className="font-semibold">
              {selectedDay === new Date().getDay() ? "Today's Schedule" : 'Schedule'}
            </span>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(Number(e.target.value))}
              className="ml-3 rounded-md border px-2 py-1 text-sm"
            >
              {['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'].map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
            <div className="ml-3 flex items-center gap-2">
              <button
                className="px-2 py-1 text-xs rounded border hover:bg-accent"
                onClick={() => setDisplayedWeek((w) => Math.max(1, w - 1))}
                aria-label="Previous week"
              >
                ◀ Prev
              </button>
              <div className="text-xs text-muted-foreground">Week {displayedWeek}</div>
              <button
                className="px-2 py-1 text-xs rounded border hover:bg-accent"
                onClick={() => setDisplayedWeek((w) => w + 1)}
                aria-label="Next week"
              >
                Next ▶
              </button>
              {displayedWeek !== currentWeek && (
                <button
                  className="px-2 py-1 text-xs rounded border hover:bg-accent"
                  onClick={() => setDisplayedWeek(currentWeek)}
                >
                  Today
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM do')}
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Merge courses and exams, ordered by time */}
        {[...todaysCourses.map(c => ({ kind: 'course' as const, time: c.startTime || '00:00', tmin: toMinutes(c.startTime), item: c })),
          ...todaysExams.map(e => ({
            kind: 'exam' as const,
            time: e.time || '00:00',
            tmin: toMinutes(e.time),
            item: e,
            weekNum: (() => {
              const activeSemester = settings?.semesters?.find(s => s.id === settings.activeSemesterId);
              const semStartStr = activeSemester?.startDate;
              if (!semStartStr) return null;
              const semWeekStart = startOfWeek(new Date(semStartStr), { weekStartsOn: 0 });
              const exDate = new Date(`${e.date}T00:00`);
              const exWeekStart = startOfWeek(exDate, { weekStartsOn: 0 });
              return Math.max(1, differenceInWeeks(exWeekStart, semWeekStart) + 1);
            })()
          }))]
          .sort((a, b) => a.tmin - b.tmin)
          .map((entry) => entry.kind === 'course' ? (
          <div
            key={`course-${(entry.item as Course).id}`}
            className={`relative p-4 rounded-lg border-l-4 transition-all duration-200 ${
              isCurrentCourse(entry.item as Course)
                ? 'bg-primary/10 border-l-primary shadow-md scale-[1.02]'
                : isUpcomingCourse(entry.item as Course)
                ? 'bg-accent border-l-accent-foreground'
                : 'bg-muted/50 border-l-muted-foreground'
            } ${nextUpcoming && (entry.item as Course).id === nextUpcoming?.id ? 'ring-2 ring-primary/30' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">{(entry.item as Course).title}</h3>
                  {isCurrentCourse(entry.item as Course) && (
                    <Badge variant="default" className="text-xs">
                      Live Now
                    </Badge>
                  )}
                  {isUpcomingCourse(entry.item as Course) && (
                    <Badge variant="secondary" className="text-xs">
                      Upcoming
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(entry.item as Course).startTime} - {(entry.item as Course).endTime}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {(entry.item as Course).building} {(entry.item as Course).room}
                  </div>
                  {(entry.item as Course).instructor && (
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {(entry.item as Course).instructor}
                    </div>
                  )}
                </div>
              </div>
              {/* Enhanced countdown for active course */}
              {isCurrentCourse(entry.item as Course) && (() => {
                const left = timeLeftForCourse(entry.item as Course);
                const startDate = parseDayTimeToDate(selectedDay, (entry.item as Course).startTime || '00:00');
                const endDate = parseDayTimeToDate(selectedDay, (entry.item as Course).endTime || '00:00');
                const total = Math.max(0, endDate.getTime() - startDate.getTime());
                const elapsed = Math.max(0, currentTime.getTime() - startDate.getTime());
                const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((elapsed / total) * 100))) : 100;
                const urgent = (endDate.getTime() - currentTime.getTime()) <= 5 * 60 * 1000;
                return left ? (
                  <div className="mt-3">
                    <div className={`font-mono text-sm mb-1 ${urgent ? 'text-red-600' : 'text-muted-foreground'}`}>Ends in {left}</div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 rounded overflow-hidden bg-muted/20">
                        <div
                          className={`${urgent ? 'bg-red-600' : 'bg-primary'} h-full transition-all duration-300`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums w-12 text-right">{pct}%</div>
                    </div>
                  </div>
                ) : null;
              })()}
              
              <div 
                className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: (entry.item as Course).color }}
              />
            </div>
            
            {isCurrentCourse(entry.item as Course) && (
              <div className="absolute -left-1 top-1/2 transform -translate-y-1/2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              </div>
            )}
          </div>
          ) : (
            // Exam entry
            <div
              key={`exam-${(entry.item as Exam).id}`}
              className={`relative p-4 rounded-lg border-l-4 bg-amber-50 dark:bg-amber-950/30 border-l-amber-500`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold flex items-center gap-2"><GraduationCap className="h-4 w-4" /> {(entry.item as Exam).title}</h3>
                    <Badge variant="secondary" className="text-xs">Exam{typeof entry.weekNum === 'number' ? ` • W${entry.weekNum}` : ''}</Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {(entry.item as Exam).time || '—'}
                    </div>
                    {(entry.item as Exam).seatNumber && (
                      <div className="text-xs">Seat {(entry.item as Exam).seatNumber}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}