"use client";

import { useEffect, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { CheckSquare, Clock, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppStore } from '@/lib/stores/app-store';
import { Task } from '@/lib/database';

export function UpcomingTasks() {
  const { getUpcomingTasks, getOverdueTasks, toggleTask } = useAppStore();
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);

  useEffect(() => {
    setUpcomingTasks(getUpcomingTasks().slice(0, 5)); // Show top 5
    setOverdueTasks(getOverdueTasks().slice(0, 3)); // Show top 3
  }, [getUpcomingTasks, getOverdueTasks]);

  const handleToggleTask = async (taskId: number) => {
    await toggleTask(taskId);
    // Refresh the lists
    setUpcomingTasks(getUpcomingTasks().slice(0, 5));
    setOverdueTasks(getOverdueTasks().slice(0, 3));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 dark:bg-red-950';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
      case 'low':
        return 'text-green-600 bg-green-50 dark:bg-green-950';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-950';
    }
  };

  const TaskItem = ({ task, isOverdue = false }: { task: Task; isOverdue?: boolean }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <Checkbox
        checked={task.completed}
        onCheckedChange={() => handleToggleTask(task.id!)}
        className="mt-0.5"
      />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`font-medium truncate ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
            {task.title}
          </h4>
          <Badge
            variant="secondary"
            className={`text-xs ${getPriorityColor(task.priority)}`}
          >
            {task.priority}
          </Badge>
        </div>
        
        {task.description && (
          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isOverdue ? (
            <div className="flex items-center gap-1 text-red-600">
              <AlertTriangle className="h-3 w-3" />
              Overdue by {formatDistanceToNow(new Date(task.dueDate))}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Due {formatDistanceToNow(new Date(task.dueDate), { addSuffix: true })}
            </div>
          )}
          <span>•</span>
          <span>{format(new Date(task.dueDate), 'MMM d, yyyy')}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Overdue Tasks ({overdueTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {overdueTasks.map((task) => (
              <TaskItem key={task.id} task={task} isOverdue />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Upcoming Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingTasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No upcoming tasks. You're all caught up! ✨
            </p>
          ) : (
            <div className="space-y-3">
              {upcomingTasks.map((task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}