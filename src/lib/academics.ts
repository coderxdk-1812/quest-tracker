/**
 * Academics — pure helpers (no React, unit-testable).
 * Goals attach to a subject; progress + effort are derived from the user's tasks.
 * A task counts toward a subject if the subject appears in its subject field OR its
 * tags — so tagging a task "chemistry" feeds Chemistry, even if the subject differs.
 * Curriculum-agnostic: no grades anywhere.
 */

export interface EffortTask {
  subject?: string;
  tags?: string[];
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

/** A task belongs to a subject if its subject field OR any tag matches (case-insensitive). */
export function taskMatchesSubject(task: EffortTask, subject: string): boolean {
  const s = subject.trim().toLowerCase();
  if (!s) return false;
  if ((task.subject || '').trim().toLowerCase() === s) return true;
  return (task.tags || []).some(t => t.trim().toLowerCase() === s);
}

export interface GoalProgress {
  completed: number;
  total: number;
  pct: number;
}

/** Goal progress = completed vs total tasks matching the goal's subject (field or tag). */
export function goalProgress(tasks: EffortTask[], subject?: string | null): GoalProgress {
  if (!subject) return { completed: 0, total: 0, pct: 0 };
  const rel = tasks.filter(t => taskMatchesSubject(t, subject));
  const completed = rel.filter(t => t.completed).length;
  const total = rel.length;
  return { completed, total, pct: total ? Math.round((completed / total) * 100) : 0 };
}

export interface SubjectEffort {
  subject: string;
  completed: number;
  total: number;
}

/**
 * Effort for an explicit set of subjects (the ones the user actually cares about —
 * from tasks, goals and confidence). Matches by subject field OR tag, busiest first.
 */
export function effortForSubjects(tasks: EffortTask[], subjects: string[]): SubjectEffort[] {
  return subjects
    .map(subject => {
      const rel = tasks.filter(t => taskMatchesSubject(t, subject));
      return { subject, completed: rel.filter(t => t.completed).length, total: rel.length };
    })
    .filter(e => e.total > 0)
    .sort((a, b) => b.completed - a.completed);
}

/** Legacy: derive subjects from the subject field only (kept for compatibility). */
export function effortBySubject(tasks: EffortTask[]): SubjectEffort[] {
  const subjects = Array.from(
    new Set(tasks.map(t => (t.subject || '').trim()).filter(Boolean)),
  );
  return effortForSubjects(tasks, subjects);
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
