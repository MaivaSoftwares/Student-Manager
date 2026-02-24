"use client";

import { useEffect, useState } from 'react';
import { Plus, Calendar, Clock, AlertTriangle, CheckSquare2, Edit, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppStore } from '@/lib/stores/app-store';
import { Task } from '@/lib/database';

export default function Tasks() {
  const { tasks, loadData, toggleTask, deleteTask, addTask, updateTask } = useAppStore();
  const { settings } = useAppStore();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [guardOpen, setGuardOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleTask = async (taskId: number) => {
    await toggleTask(taskId);
  };

  const handleDeleteTask = async (taskId: number) => {
    setConfirmTarget(taskId);
    setConfirmOpen(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 dark:bg-red-950 border-red-200';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950 border-yellow-200';
      case 'low':
        return 'text-green-600 bg-green-50 dark:bg-green-950 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-950 border-gray-200';
    }
  };

  const getFilteredTasks = () => {
    const now = new Date();
    switch (filter) {
      case 'pending':
        return tasks.filter(task => !task.completed && new Date(task.dueDate) >= now);
      case 'completed':
        return tasks.filter(task => task.completed);
      case 'overdue':
        return tasks.filter(task => !task.completed && new Date(task.dueDate) < now);
      default:
        return tasks;
    }
  };

  const getTaskCounts = () => {
    const now = new Date();
    return {
      all: tasks.length,
      pending: tasks.filter(task => !task.completed && new Date(task.dueDate) >= now).length,
      completed: tasks.filter(task => task.completed).length,
      overdue: tasks.filter(task => !task.completed && new Date(task.dueDate) < now).length,
    };
  };

  const getDueDateLabel = (dueDate: string) => {
    const date = new Date(dueDate);
    
    if (isToday(date)) {
      return 'Due Today';
    } else if (isTomorrow(date)) {
      return 'Due Tomorrow';
    } else if (date < new Date()) {
      return `Overdue by ${formatDistanceToNow(date)}`;
    } else {
      return `Due ${formatDistanceToNow(date, { addSuffix: true })}`;
    }
  };

  const getDueDateColor = (dueDate: string, completed: boolean) => {
    if (completed) return 'text-muted-foreground';
    
    const date = new Date(dueDate);
    if (date < new Date()) return 'text-red-600';
    if (isToday(date)) return 'text-orange-600';
    if (isTomorrow(date)) return 'text-yellow-600';
    return 'text-muted-foreground';
  };

  const TaskCard = ({ task }: { task: Task }) => (
    <Card className={`relative transition-all duration-200 ${task.completed ? 'opacity-75' : ''}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-start gap-3">
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => handleToggleTask(task.id!)}
            className="mt-1"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className={`font-semibold ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                {task.title}
              </h3>
              
              <div className="flex items-center gap-1">
                <Badge
                  variant="secondary"
                  className={`text-xs ${getPriorityColor(task.priority)}`}
                >
                  {task.priority}
                </Badge>
                
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setEditingTask(task); setIsAddingTask(true); }}>
                  <Edit className="h-3 w-3" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                  onClick={() => handleDeleteTask(task.id!)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            {task.description && (
              <p className={`text-sm mt-2 ${task.completed ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
                {task.description}
              </p>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <div className={`flex items-center gap-1 ${getDueDateColor(task.dueDate, task.completed)}`}>
            {task.completed ? (
              <CheckSquare2 className="h-3 w-3" />
            ) : new Date(task.dueDate) < new Date() ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <Clock className="h-3 w-3" />
            )}
            {getDueDateLabel(task.dueDate)}
          </div>
          
          <span className="text-muted-foreground">
            {format(new Date(task.dueDate), 'MMM d, yyyy')}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  const counts = getTaskCounts();
  const filteredTasks = getFilteredTasks();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            Manage your assignments and activities
          </p>
        </div>
        <Dialog open={isAddingTask} onOpenChange={(open) => { setIsAddingTask(open); if (!open) setEditingTask(null); }}>
          <Button onClick={() => {
            const activeSemester = settings?.semesters?.find(s => s.id === settings.activeSemesterId);
            const hasSemester = !!activeSemester;
            const hasMajor = !!(activeSemester && activeSemester.activeMajor);
            if (!hasSemester || !hasMajor) {
              setGuardOpen(true);
              return;
            }
            setEditingTask(null);
            setIsAddingTask(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>

          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Add Task'}</DialogTitle>
              <DialogDescription>{editingTask ? 'Update the task details' : 'Create a new task'}</DialogDescription>
            </DialogHeader>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement & any;
              const taskPayload: any = {
                title: form.title.value,
                description: form.description.value || '',
                dueDate: form.dueDate.value || new Date().toISOString().split('T')[0],
                completed: false,
                priority: form.priority.value || 'low',
                courseId: form.courseId.value ? Number(form.courseId.value) : undefined,
              };
              if (editingTask) {
                await updateTask(editingTask.id!, taskPayload);
                setEditingTask(null);
              } else {
                await addTask(taskPayload);
              }
              setIsAddingTask(false);
              await loadData();
            }}>
              <div className="grid gap-2">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <Input name="title" placeholder="Task title" required defaultValue={editingTask?.title ?? ''} />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea name="description" placeholder="Description" defaultValue={editingTask?.description ?? ''} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-sm font-medium">Due date</label>
                    <Input name="dueDate" type="date" defaultValue={editingTask?.dueDate ? editingTask.dueDate.split('T')[0] : ''} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Priority</label>
                    <Input name="priority" placeholder="low|medium|high" defaultValue={editingTask?.priority ?? 'low'} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Course ID</label>
                    <Input name="courseId" placeholder="Course ID (optional)" defaultValue={editingTask?.courseId ? String(editingTask.courseId) : ''} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => { setIsAddingTask(false); setEditingTask(null); }}>Cancel</Button>
                  <Button type="submit">{editingTask ? 'Save' : 'Add Task'}</Button>
                </DialogFooter>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={guardOpen} onOpenChange={setGuardOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Missing semester or major</DialogTitle>
              <DialogDescription>
                You must first create or select a semester and major in Settings before adding tasks.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setGuardOpen(false)}>Cancel</Button>
              <Button onClick={() => { setGuardOpen(false); window.location.href = '/settings'; }} className="bg-primary text-primary-foreground">Go to Settings</Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Confirm delete dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete task</DialogTitle>
              <DialogDescription>Are you sure you want to delete this task? This cannot be undone.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button onClick={async () => {
                setConfirmOpen(false);
                if (confirmTarget) {
                  await deleteTask(confirmTarget);
                  await loadData();
                }
                setConfirmTarget(null);
              }} className="bg-red-600 hover:bg-red-700">Delete</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="flex items-center gap-2">
            All
            <Badge variant="secondary" className="text-xs">
              {counts.all}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2">
            Pending
            <Badge variant="secondary" className="text-xs">
              {counts.pending}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex items-center gap-2">
            Overdue
            <Badge variant="destructive" className="text-xs">
              {counts.overdue}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            Done
            <Badge variant="secondary" className="text-xs">
              {counts.completed}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4 mt-6">
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckSquare2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">
                  {filter === 'completed' ? 'No completed tasks' : 
                   filter === 'overdue' ? 'No overdue tasks' :
                   filter === 'pending' ? 'No pending tasks' : 'No tasks yet'}
                </h3>
                <p className="text-muted-foreground text-center mb-4">
                  {filter === 'completed' ? 'Complete some tasks to see them here' : 
                   filter === 'overdue' ? 'Great! You\'re on top of your deadlines' :
                   filter === 'pending' ? 'All caught up! No pending tasks' : 'Create your first task to get started'}
                </p>
                {filter !== 'completed' && filter !== 'overdue' && (
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredTasks
                .sort((a, b) => {
                  // Sort by completion status first, then by due date
                  if (a.completed !== b.completed) {
                    return a.completed ? 1 : -1;
                  }
                  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
                })
                .map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}