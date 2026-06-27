/**
 * "Next move" personalization engine (Phase 3 of the spec, §4).
 *
 * Turns the user's real state into exactly ONE recommended next action, using a
 * relevance ranking with an intelligent fallback ladder so the result is never blank
 * and never irrelevant (e.g. it will not tell you to clear overdue work when you have
 * none). Pure, deterministic, local — no API. Fully unit-testable.
 *
 * Survey basis: 51% are frequently overwhelmed and students rarely prioritise; the app
 * must always surface the single most valuable thing to do right now.
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface NMTask {
  id: string;
  title: string;
  completed: boolean;
  priority: Difficulty;
  subject?: string;
  deadline?: string; // ISO
}

export interface NMTimetableEntry {
  subject: string;
  day: number;        // Mon=0..Sun=6
  days?: number[];
}

export type MoveKind =
  | 'overdue' | 'due_today' | 'scheduled_subject'
  | 'breakdown_big' | 'focus_streak' | 'plan_ahead' | 'add_first_task';

export interface NextMove {
  kind: MoveKind;
  /** Short imperative headline, e.g. "Clear an overdue task". */
  title: string;
  /** Why this is being suggested (one line). */
  reason: string;
  /** Call-to-action button label. */
  cta: string;
  /** Route the CTA should navigate to. */
  route: '/tasks' | '/focus' | '/timetable';
  /** Target task, when the move concerns a specific one. */
  taskId?: string;
  taskTitle?: string;
}

const WEIGHT: Record<Difficulty, number> = { hard: 3, medium: 2, easy: 1 };

function sameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function dayIdx(d: Date): number {
  return (d.getDay() + 6) % 7; // Mon=0..Sun=6
}

/** Pick the "most important" task from a list: by priority, then earliest deadline. */
function mostImportant(tasks: NMTask[]): NMTask | undefined {
  return [...tasks].sort((a, b) => {
    const w = WEIGHT[b.priority] - WEIGHT[a.priority];
    if (w !== 0) return w;
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    return da - db;
  })[0];
}

export interface NextMoveInput {
  tasks: NMTask[];
  timetable?: NMTimetableEntry[];
  /** Whether the streak has already been advanced today (i.e. a task done today). */
  streakSafeToday?: boolean;
  now?: Date;
}

/**
 * Recommend the single best next action. Walks a fallback ladder top→bottom and
 * returns the first applicable move.
 */
export function recommendNextMove(input: NextMoveInput): NextMove {
  const now = input.now ?? new Date();
  const tasks = input.tasks ?? [];
  const open = tasks.filter(t => !t.completed);

  // 1) Overdue — only if something is genuinely overdue.
  const overdue = open.filter(t => t.deadline && new Date(t.deadline).getTime() < now.getTime());
  if (overdue.length > 0) {
    const t = mostImportant(overdue)!;
    return {
      kind: 'overdue',
      title: overdue.length > 1 ? `Clear ${overdue.length} overdue tasks` : 'Clear an overdue task',
      reason: `"${t.title}" is past its deadline — knock it out first.`,
      cta: 'Break it down & start',
      route: '/tasks',
      taskId: t.id, taskTitle: t.title,
    };
  }

  // 2) Due today (not overdue).
  const dueToday = open.filter(t => t.deadline && sameDay(new Date(t.deadline), now));
  if (dueToday.length > 0) {
    const t = mostImportant(dueToday)!;
    return {
      kind: 'due_today',
      title: 'Finish what is due today',
      reason: `"${t.title}" is due today.`,
      cta: 'Break it down & start',
      route: '/tasks',
      taskId: t.id, taskTitle: t.title,
    };
  }

  // 3) A task in a subject you have class for today.
  const todays = dayIdx(now);
  const todaySubjects = new Set(
    (input.timetable ?? [])
      .filter(e => (e.days?.includes(todays)) || e.day === todays)
      .map(e => e.subject.toLowerCase()),
  );
  const scheduled = open.filter(t => t.subject && todaySubjects.has(t.subject.toLowerCase()));
  if (scheduled.length > 0) {
    const t = mostImportant(scheduled)!;
    return {
      kind: 'scheduled_subject',
      title: `Get ahead in ${t.subject}`,
      reason: `You have ${t.subject} today — "${t.title}" is waiting.`,
      cta: 'Start this task',
      route: '/tasks',
      taskId: t.id, taskTitle: t.title,
    };
  }

  // 4) Break down the biggest open task to beat "don't know where to start".
  if (open.length > 0) {
    const t = mostImportant(open)!;
    return {
      kind: 'breakdown_big',
      title: 'Chip away at your biggest task',
      reason: `Break "${t.title}" into small steps so it stops feeling huge.`,
      cta: 'Break it into steps',
      route: '/tasks',
      taskId: t.id, taskTitle: t.title,
    };
  }

  // 5..) Intelligent fallbacks when nothing is open.
  if (tasks.length === 0) {
    return {
      kind: 'add_first_task',
      title: 'Add your first task',
      reason: 'Nothing here yet — capture one thing you need to do.',
      cta: 'Add a task',
      route: '/tasks',
    };
  }
  if (!input.streakSafeToday) {
    return {
      kind: 'focus_streak',
      title: 'Protect your streak',
      reason: 'All clear! A short focus session keeps your streak alive.',
      cta: 'Run a 15-min focus session',
      route: '/focus',
    };
  }
  return {
    kind: 'plan_ahead',
    title: 'You are all caught up',
    reason: 'Nothing urgent. Get ahead by planning tomorrow.',
    cta: 'Plan tomorrow',
    route: '/tasks',
  };
}
