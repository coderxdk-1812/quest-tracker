import { useState, useMemo, useEffect } from 'react';
import { useGame, type Task, type Priority, type Subtask } from '@/context/GameContext';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, CheckCircle2, Circle, CalendarIcon, Pencil, Search,
  ChevronDown, ChevronRight, ListChecks, Repeat,
} from 'lucide-react';
import type { RecurrenceType, TaskRecurrence } from '@/lib/recurrence';
import { QuestBreakdown } from '@/components/tasks/QuestBreakdown';
import { TaskCheckbox } from '@/components/tasks/TaskCheckbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn, prefersReducedMotion } from '@/lib/utils';
import { format } from 'date-fns';
import { getSavedSubjects, setSavedSubjects as persistSavedSubjects, subscribeSavedSubjects } from '@/lib/userPrefs';
import { Magnetic } from '@/components/motion/Magnetic';

const listItemSpring = { type: 'spring' as const, stiffness: 420, damping: 34, mass: 0.7 };

const PRIORITY_CONFIG: Record<Priority, { label: string; class: string; xp: number; weight: number; dot: string }> = {
  easy:   { label: 'Low',    class: 'bg-easy/15 text-easy border-easy/30',       xp: 10, weight: 1, dot: 'bg-easy' },
  medium: { label: 'Medium', class: 'bg-medium/15 text-medium border-medium/30', xp: 25, weight: 2, dot: 'bg-medium' },
  hard:   { label: 'High',   class: 'bg-hard/15 text-hard border-hard/30',       xp: 50, weight: 3, dot: 'bg-hard' },
};

function getDeadlineStatus(deadline?: string, completed?: boolean) {
  if (!deadline || completed) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 24 * 60 * 60 * 1000) return 'urgent';
  return 'normal';
}

function formatDeadline(deadline: string) {
  return format(new Date(deadline), "EEE d MMM, h:mm a");
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function recurrenceLabel(r: TaskRecurrence): string {
  if (r.type === 'daily') return 'Daily';
  if (r.type === 'weekly') return 'Weekly';
  const days = r.days ?? [];
  return days.length > 0 ? days.map(i => DAY_LABELS[i]).join(', ') : 'Weekly';
}

interface FormState {
  title: string;
  description: string;
  priority: Priority;
  subject: string;
  tagsInput: string;
  deadlineDate: Date | undefined;
  deadlineTime: string;
  subtasks: Subtask[];
  recurrenceType: 'none' | RecurrenceType;
  recurrenceDays: number[];
}

const emptyForm = (): FormState => ({
  title: '', description: '', priority: 'medium', subject: '',
  tagsInput: '', deadlineDate: undefined, deadlineTime: '23:59', subtasks: [],
  recurrenceType: 'none', recurrenceDays: [],
});

/** Build the recurrence rule to save from the form, or undefined for "None". */
function formRecurrence(f: FormState): TaskRecurrence | undefined {
  if (f.recurrenceType === 'none') return undefined;
  if (f.recurrenceType === 'weekdays') return { type: 'weekdays', days: f.recurrenceDays };
  return { type: f.recurrenceType };
}

/** Build an ISO deadline from the form's date + time, if a date is set. */
function formDeadlineIso(f: FormState): string | undefined {
  if (!f.deadlineDate) return undefined;
  const [h, m] = f.deadlineTime.split(':').map(Number);
  const d = new Date(f.deadlineDate);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export default function Tasks() {
  const { state, dispatch, toggleTask } = useGame();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'overdue'>('all');
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [sortBy, setSortBy] = useState<'deadline' | 'priority'>('deadline');

  const [savedSubjects, setSavedSubjects] = useState<string[]>(() => getSavedSubjects());
  useEffect(() => subscribeSavedSubjects(() => setSavedSubjects(getSavedSubjects())), []);
  useEffect(() => {
    const remote = getSavedSubjects();
    if (remote.length !== savedSubjects.length || remote.some((s, i) => s !== savedSubjects[i])) {
      persistSavedSubjects(savedSubjects);
    }
  }, [savedSubjects]);

  const persistSubject = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavedSubjects(prev =>
      prev.some(s => s.toLowerCase() === trimmed.toLowerCase()) ? prev : [...prev, trimmed]
    );
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setEditorOpen(true);
  };

  const openEdit = (t: Task) => {
    setEditingId(t.id);
    const d = t.deadline ? new Date(t.deadline) : undefined;
    setForm({
      title: t.title,
      description: t.description || '',
      priority: t.priority,
      subject: t.subject || '',
      tagsInput: (t.tags || []).join(', '),
      deadlineDate: d,
      deadlineTime: d ? format(d, 'HH:mm') : '23:59',
      subtasks: t.subtasks || [],
      recurrenceType: t.recurrence?.type ?? 'none',
      recurrenceDays: t.recurrence?.days ?? [],
    });
    setEditorOpen(true);
  };

  const saveTask = () => {
    if (!form.title.trim()) return;
    const deadline = formDeadlineIso(form);
    const subjectName = form.subject.trim();
    if (subjectName) persistSubject(subjectName);
    const tags = form.tagsInput.split(',').map(s => s.trim()).filter(Boolean);

    if (editingId) {
      const existing = state.tasks.find(t => t.id === editingId);
      if (!existing) return;
      dispatch({
        type: 'UPDATE_TASK',
        task: {
          ...existing,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
          subject: subjectName || undefined,
          subjectColor: subjectName ? 'other' : undefined,
          tags,
          deadline,
          subtasks: form.subtasks,
          recurrence: formRecurrence(form),
        },
      });
    } else {
      const task: Task = {
        id: crypto.randomUUID(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        completed: false,
        priority: form.priority,
        subject: subjectName || undefined,
        subjectColor: subjectName ? 'other' : undefined,
        tags,
        deadline,
        createdAt: new Date().toISOString(),
        subtasks: form.subtasks,
        recurrence: formRecurrence(form),
      };
      dispatch({ type: 'ADD_TASK', task });
    }
    setEditorOpen(false);
    setForm(emptyForm());
    setEditingId(null);
  };

  const toggleExpanded = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Toggle a subtask on a saved task; completing every subtask completes the task.
  const toggleSubtask = (task: Task, subId: string) => {
    const subtasks = (task.subtasks || []).map(s => s.id === subId ? { ...s, done: !s.done } : s);
    dispatch({ type: 'UPDATE_TASK', task: { ...task, subtasks } });
    if (!task.completed && subtasks.length > 0 && subtasks.every(s => s.done)) {
      toggleTask(task.id);
    }
  };

  const allSubjects = useMemo(() => {
    const s = new Set<string>();
    state.tasks.forEach(t => t.subject && s.add(t.subject));
    savedSubjects.forEach(x => s.add(x));
    return Array.from(s).sort();
  }, [state.tasks, savedSubjects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    let list = state.tasks.filter(t => {
      if (q) {
        const hay = (t.title + ' ' + (t.subject || '') + ' ' + (t.description || '') + ' ' + (t.tags || []).join(' ')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === 'active' && t.completed) return false;
      if (statusFilter === 'completed' && !t.completed) return false;
      if (statusFilter === 'overdue' && (t.completed || !t.deadline || new Date(t.deadline).getTime() >= now)) return false;
      if (subjectFilter !== 'all' && t.subject !== subjectFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (sortBy === 'priority') {
        const pd = PRIORITY_CONFIG[b.priority].weight - PRIORITY_CONFIG[a.priority].weight;
        if (pd !== 0) return pd;
        const aT = a.deadline ? new Date(a.deadline).getTime() : Infinity;
        const bT = b.deadline ? new Date(b.deadline).getTime() : Infinity;
        return aT - bT;
      }
      const aT = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bT = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (aT !== bT) return aT - bT;
      return PRIORITY_CONFIG[b.priority].weight - PRIORITY_CONFIG[a.priority].weight;
    });
    return list;
  }, [state.tasks, search, statusFilter, subjectFilter, priorityFilter, sortBy]);

  const reduced = prefersReducedMotion();
  const headerItem = reduced
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: listItemSpring } };

  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: reduced ? {} : { staggerChildren: 0.06 } } }}
      className="max-w-4xl mx-auto space-y-6"
    >
      <motion.div variants={headerItem} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1>Tasks ✅</h1>
          <p className="text-muted-foreground text-sm mt-1">Plan, prioritise and crush your assignments.</p>
        </div>
        <Magnetic strength={6}>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />New Task</Button>
        </Magnetic>
      </motion.div>

      {/* Toolbar */}
      <motion.div variants={headerItem} className="glass-card p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={v => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Sort by" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="deadline">Sort: Deadline</SelectItem>
            <SelectItem value="priority">Sort: Priority</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={v => setPriorityFilter(v as typeof priorityFilter)}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            <SelectItem value="hard">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="easy">Low</SelectItem>
          </SelectContent>
        </Select>
        {allSubjects.length > 0 && (
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All subjects</SelectItem>
              {allSubjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </motion.div>

      {/* Task list */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map(task => {
            const dlStatus = getDeadlineStatus(task.deadline, task.completed);
            const subs = task.subtasks || [];
            const subsDone = subs.filter(s => s.done).length;
            const isOpen = expanded.has(task.id);
            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -60 }}
                transition={listItemSpring}
                className={cn(
                  'glass-card p-4 flex items-start gap-3 group transition-all',
                  task.completed && 'opacity-60',
                  dlStatus === 'overdue' && 'ring-1 ring-destructive/50'
                )}
              >
                <TaskCheckbox task={task} className="mt-0.5" />

                <div className="flex-1 min-w-0">
                  <div className="cursor-pointer" onClick={() => openEdit(task)}>
                    <div className="flex items-start gap-2">
                      <span className={cn('w-1.5 h-1.5 rounded-full mt-2 shrink-0', PRIORITY_CONFIG[task.priority].dot)} />
                      <p className={cn('font-medium leading-snug', task.completed && 'line-through text-muted-foreground')}>
                        {task.title}
                      </p>
                    </div>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2 ml-3.5">{task.description}</p>
                    )}
                    <div className="flex gap-1.5 mt-2 flex-wrap items-center ml-3.5">
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide', PRIORITY_CONFIG[task.priority].class)}>
                        {PRIORITY_CONFIG[task.priority].label}
                      </span>
                      {task.subject && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                          {task.subject}
                        </span>
                      )}
                      {task.deadline && (
                        <span className={cn(
                          'text-[10px] px-2 py-0.5 rounded-full font-medium',
                          dlStatus === 'overdue' && 'bg-destructive/15 text-destructive',
                          dlStatus === 'urgent' && 'bg-medium/15 text-medium',
                          dlStatus === 'normal' && 'bg-muted text-muted-foreground',
                          task.completed && 'bg-muted text-muted-foreground',
                        )}>
                          🗓 {formatDeadline(task.deadline)}
                        </span>
                      )}
                      {task.recurrence && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium inline-flex items-center gap-1">
                          <Repeat className="h-2.5 w-2.5" /> {recurrenceLabel(task.recurrence)}
                        </span>
                      )}
                      {(task.tags || []).map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Subtasks: collapsible checklist (Tasks #4, #5) */}
                  {subs.length > 0 && (
                    <div className="ml-3.5 mt-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(task.id)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                      >
                        {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        <ListChecks className="h-3.5 w-3.5" />
                        {subsDone}/{subs.length} steps
                      </button>
                      {isOpen && (
                        <div className="mt-1.5 space-y-1">
                          {subs.map(st => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => toggleSubtask(task, st.id)}
                              className="flex items-center gap-2 text-left w-full"
                            >
                              {st.done
                                ? <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                              <span className={cn('text-xs', st.done && 'line-through text-muted-foreground')}>
                                {st.label || 'Untitled step'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!task.completed && (
                    <span className="text-xs text-muted-foreground font-medium hidden sm:inline">+{PRIORITY_CONFIG[task.priority].xp} XP</span>
                  )}
                  <button
                    onClick={() => openEdit(task)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-muted"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => dispatch({ type: 'DELETE_TASK', taskId: task.id })}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-destructive/10"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {state.tasks.length === 0 ? (
              <>
                <p className="text-4xl mb-2">🌱</p>
                <p>A blank page, full of potential. What's the first thing on your mind?</p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-2">🔍</p>
                <p>Nothing matches that combination — try loosening a filter.</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Editor dialog — scrollable so Save is always reachable (Tasks #3) */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="">{editingId ? 'Edit Task' : 'New Task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              placeholder="Task name"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              autoFocus
            />
            <Textarea
              placeholder="Notes / description (optional)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hard">High (+50 XP)</SelectItem>
                    <SelectItem value="medium">Medium (+25 XP)</SelectItem>
                    <SelectItem value="easy">Low (+10 XP)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Subject / Class</label>
                <Input
                  placeholder="e.g. Maths"
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  list="task-subjects-list"
                />
                <datalist id="task-subjects-list">
                  {allSubjects.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Deadline date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !form.deadlineDate && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.deadlineDate ? format(form.deadlineDate, 'MMM d, yyyy') : 'Pick a date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.deadlineDate}
                      onSelect={d => setForm(f => ({ ...f, deadlineDate: d }))}
                      initialFocus
                      className={cn('p-3 pointer-events-auto')}
                    />
                    {form.deadlineDate && (
                      <div className="px-3 pb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setForm(f => ({ ...f, deadlineDate: undefined }))}
                        >
                          Clear deadline
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Deadline time</label>
                <Input
                  type="time"
                  value={form.deadlineTime}
                  onChange={e => setForm(f => ({ ...f, deadlineTime: e.target.value }))}
                  disabled={!form.deadlineDate}
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                <Repeat className="h-3 w-3" /> Repeat
              </label>
              <Select
                value={form.recurrenceType}
                onValueChange={v => setForm(f => ({ ...f, recurrenceType: v as FormState['recurrenceType'] }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Doesn't repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="weekdays">Chosen weekdays</SelectItem>
                </SelectContent>
              </Select>
              {form.recurrenceType === 'weekdays' && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setForm(f => ({
                        ...f,
                        recurrenceDays: f.recurrenceDays.includes(i)
                          ? f.recurrenceDays.filter(d => d !== i)
                          : [...f.recurrenceDays, i],
                      }))}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
                        form.recurrenceDays.includes(i)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted text-muted-foreground border-transparent hover:bg-secondary'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
              {form.recurrenceType !== 'none' && !form.deadlineDate && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Tip: add a deadline so we know when each occurrence is due.
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tags (comma-separated, optional)</label>
              <Input
                placeholder="e.g. exam, group-project"
                value={form.tagsInput}
                onChange={e => setForm(f => ({ ...f, tagsInput: e.target.value }))}
              />
            </div>

            {/* AI subtasks — generate, edit, delete, clear, regenerate (saved with the task) */}
            {form.title.trim() && (
              <QuestBreakdown
                title={form.title}
                description={form.description || undefined}
                subject={form.subject || undefined}
                priority={form.priority}
                tags={form.tagsInput.split(',').map(s => s.trim()).filter(Boolean)}
                deadline={formDeadlineIso(form)}
                value={form.subtasks}
                onChange={subtasks => setForm(f => ({ ...f, subtasks }))}
              />
            )}

            {editingId && (
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const t = state.tasks.find(x => x.id === editingId);
                    if (t) toggleTask(t.id);
                  }}
                >
                  {state.tasks.find(t => t.id === editingId)?.completed ? 'Mark incomplete' : 'Mark complete'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    dispatch({ type: 'DELETE_TASK', taskId: editingId });
                    setEditorOpen(false);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            )}

            <div className="flex gap-2 pt-2 sticky bottom-0 bg-background pb-1">
              <Button variant="ghost" onClick={() => setEditorOpen(false)} className="ml-auto">Cancel</Button>
              <Button
                onClick={saveTask}
                disabled={!form.title.trim() || (form.recurrenceType === 'weekdays' && form.recurrenceDays.length === 0)}
              >
                {editingId ? 'Save' : 'Add Task'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
