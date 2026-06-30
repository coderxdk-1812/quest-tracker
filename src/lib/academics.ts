/**
 * Academics — pure helpers (no React, unit-testable).
 * Goals attach to a subject; progress + effort are derived from the user's tasks,
 * so no task/schema coupling is needed. Curriculum-agnostic: no grades anywhere.
 */

export interface EffortTask {
  subject?: string;
  completed: boolean;
}

/** Whole days from today to an ISO date (YYYY-MM-DD). Negative = past. */
export function daysUntil(dateStr: string, now: Date = new Date()): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export type ExamUrgency = 'past' | 'today' | 'urgent' | 'soon' | 'far';

export function examUrgency(days: number): ExamUrgency {
  if (days < 0) return 'past';
  if (days === 0) return 'today';
  if (days <= 3) return 'urgent';
  if (days <= 14) return 'soon';
  return 'far';
}

/** Friendly countdown label. */
export function countdownLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}

export interface GoalProgress {
  completed: number;
  total: number;
  pct: number;
}

/** Goal progress = completed vs total tasks in the goal's subject. */
export function goalProgress(tasks: EffortTask[], subject?: string | null): GoalProgress {
  if (!subject) return { completed: 0, total: 0, pct: 0 };
  const s = subject.toLowerCase();
  const rel = tasks.filter(t => (t.subject || '').toLowerCase() === s);
  const completed = rel.filter(t => t.completed).length;
  const total = rel.length;
  return { completed, total, pct: total ? Math.round((completed / total) * 100) : 0 };
}

export interface SubjectEffort {
  subject: string;
  completed: number;
  total: number;
}

/** Per-subject completed/total tasks, busiest first — a curriculum-free effort signal. */
export function effortBySubject(tasks: EffortTask[]): SubjectEffort[] {
  const map = new Map<string, { c: number; t: number }>();
  for (const task of tasks) {
    const s = (task.subject || '').trim();
    if (!s) continue;
    const e = map.get(s) || { c: 0, t: 0 };
    e.t += 1;
    if (task.completed) e.c += 1;
    map.set(s, e);
  }
  return [...map.entries()]
    .map(([subject, { c, t }]) => ({ subject, completed: c, total: t }))
    .sort((a, b) => b.completed - a.completed);
}

export type Confidence = 'red' | 'amber' | 'green';

/** Cycle red → amber → green → red for the RAG toggle. */
export function nextConfidence(level: Confidence): Confidence {
  return level === 'red' ? 'amber' : level === 'amber' ? 'green' : 'red';
}

export const CONFIDENCE_HSL: Record<Confidence, string> = {
  red: '0 70% 55%',
  amber: '38 92% 50%',
  green: '145 60% 42%',
};
