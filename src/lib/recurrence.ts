/**
 * Recurring tasks (spec §4). A task can repeat daily, weekly, or on chosen weekdays.
 * Pure & testable: given the current occurrence's deadline + its recurrence rule,
 * compute the next occurrence's deadline. The React/reducer layer decides *when*
 * to call this (on completion, or when a day passes uncompleted) and how to copy
 * the rest of the task's fields.
 */

export type RecurrenceType = 'daily' | 'weekly' | 'weekdays';

export interface TaskRecurrence {
  type: RecurrenceType;
  /** Weekdays this recurs on, Mon=0..Sun=6. Only meaningful when type === 'weekdays'. */
  days?: number[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Mon=0..Sun=6, matching TimetableEntry.days' convention. */
function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * Next occurrence's deadline as an ISO string. `currentDeadline` is the occurrence
 * that just completed or expired; `from` (defaults to now) is only used as the
 * anchor when there was no deadline to begin with (an undated recurring task).
 */
export function computeNextOccurrenceDeadline(
  currentDeadline: string | undefined,
  recurrence: TaskRecurrence,
  from: Date = new Date(),
): string | undefined {
  const anchor = currentDeadline ? new Date(currentDeadline) : from;

  if (recurrence.type === 'daily') {
    return new Date(anchor.getTime() + DAY_MS).toISOString();
  }

  if (recurrence.type === 'weekly') {
    return new Date(anchor.getTime() + 7 * DAY_MS).toISOString();
  }

  // 'weekdays': next date, starting the day after the anchor, whose weekday is in
  // recurrence.days. Falls back to +7 days if no weekdays were configured, so a
  // misconfigured task never gets stuck in a same-day loop.
  const days = recurrence.days ?? [];
  if (days.length === 0) {
    return new Date(anchor.getTime() + 7 * DAY_MS).toISOString();
  }
  for (let i = 1; i <= 7; i++) {
    const candidate = new Date(anchor.getTime() + i * DAY_MS);
    if (days.includes(weekdayIndex(candidate))) {
      return candidate.toISOString();
    }
  }
  // Unreachable in practice (days is non-empty and there are 7 weekdays to scan),
  // but keeps the return type total.
  return new Date(anchor.getTime() + 7 * DAY_MS).toISOString();
}

/** A recurring task's day has passed without completion — due for a fresh occurrence. */
export function isRecurrenceDue(
  task: { completed: boolean; deadline?: string; recurrence?: TaskRecurrence },
  now: Date = new Date(),
): boolean {
  return !!task.recurrence && !task.completed && !!task.deadline && new Date(task.deadline).getTime() < now.getTime();
}
