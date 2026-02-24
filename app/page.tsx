"use client";

import { useEffect, useState } from 'react';
import { QuickStats } from '@/components/dashboard/quick-stats';
import { Timeline } from '@/components/dashboard/timeline';
import { UpcomingTasks } from '@/components/dashboard/upcoming-tasks';
import { useAppStore } from '@/lib/stores/app-store';

export default function Dashboard() {
  const { loadData, loading } = useAppStore();
  const courses = useAppStore(state => state.courses);
  const currentWeek = useAppStore(state => state.currentWeek);
  const [now, setNow] = useState<Date>(new Date());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex flex-col items-end text-right">
          <div className="text-sm text-muted-foreground">Current time</div>
          <div className="mt-2 font-mono text-lg font-semibold px-3 py-1 bg-white/70 dark:bg-black/40 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800">
            {mounted ? now.toLocaleTimeString() : '—'}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Timeline - Takes 2 columns on large screens */}
        <div className="xl:col-span-2">
          <Timeline />
        </div>

        {/* Upcoming Tasks - Takes 1 column */}
        <div>
          <UpcomingTasks />
        </div>
      </div>
    </div>
  );
}