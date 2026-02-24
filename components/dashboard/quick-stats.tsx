"use client";

import { useEffect, useState } from 'react';
import { Calendar, CheckSquare, AlertTriangle, GraduationCap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAppStore } from '@/lib/stores/app-store';

export function QuickStats() {
  const { courses, tasks, exams, currentWeek } = useAppStore();
  const [stats, setStats] = useState({
    upcomingExams: 0,
    todaysClasses: 0,
    upcomingTasks: 0,
    overdueTasks: 0,
  });

  useEffect(() => {
    const today = new Date().getDay();
    const todaysClasses = courses.filter(course => 
      course.day === today && 
      course.startWeek <= currentWeek && 
      course.endWeek >= currentWeek
    ).length;

    const now = new Date();
    const upcomingTasks = tasks.filter(task => 
      !task.completed && new Date(task.dueDate) >= now
    ).length;

    const overdueTasks = tasks.filter(task => 
      !task.completed && new Date(task.dueDate) < now
    ).length;
    // upcoming exams (date/time in the future)
    const upcomingExams = exams.filter(ex => {
      const dt = new Date(`${ex.date}T${ex.time || '00:00'}`);
      return dt >= now;
    }).length;

    setStats({
      upcomingExams,
      todaysClasses,
      upcomingTasks,
      overdueTasks,
    });
  }, [courses, tasks, exams, currentWeek]);

  const statCards = [
    {
      title: "Upcoming Exams",
      value: stats.upcomingExams,
      icon: GraduationCap,
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950",
    },
    {
      title: "Today's Classes",
      value: stats.todaysClasses,
      icon: Calendar,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Upcoming Tasks",
      value: stats.upcomingTasks,
      icon: CheckSquare,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
    },
    {
      title: "Overdue Tasks",
      value: stats.overdueTasks,
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950",
    },
  ];

  return (
    // mobile: 2 columns x 2 rows (md), desktop (lg and up): single inline row
    <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-row gap-4 lg:items-stretch lg:justify-between">
      {statCards.map((stat) => (
        <Card key={stat.title} className="lg:flex-1 lg:min-w-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {stat.title}
            </CardTitle>
            <div className={`p-2 rounded-md ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}