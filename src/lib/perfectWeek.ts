/**
 * Perfect week (spec §4): track progress toward completing at least one task every
 * day this week (Mon–Sun), and flag when the whole week is achieved so the UI can
 * celebrate. Pure & testable. Future days are never counted against the user — this
 * is meant to encourage, never shame (a day that hasn't arrived yet is "upcoming",
 * not "missed").
 */

export interface PerfectWeekDay {
  /** Mon=0..Sun=6 */
  index: number;
  /** YYYY-MM-DD */
  date: string;
  isPast: boolean;
  isToday: boolean;
  completed: boolean;
}

export interface PerfectWeekProgress {
  days: PerfectWeekDay[];
  /** How many of this week's days (so far) have at least one completion. */
  completedCount: number;
  /** Every day up to and including today has at least one completion — no gaps yet. */
  onTrack: boolean;
  /** All 7 days of the week are complete — only possible once Sunday is done. */
  achieved: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Mon=0..Sun=6, matching the rest of the app's weekday convention. */
function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/**
 * `activityDates` is any list of ISO date/datetime strings on which at least one
 * task was completed (same "day of activity" signal StudyHeatmap already uses).
 */
export function computePerfectWeek(activityDates: string[], now: Date = new Date()): PerfectWeekProgress {
  const activeDays = new Set(activityDates.map(d => dateKey(new Date(d))));
  const today = dateKey(now);
  const monday = new Date(now.getTime() - weekdayIndex(now) * DAY_MS);

  const days: PerfectWeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getTime() + i * DAY_MS);
    const key = dateKey(d);
    return {
      index: i,
      date: key,
      isPast: key < today,
      isToday: key === today,
      completed: activeDays.has(key),
    };
  });

  const completedCount = days.filter(d => d.completed).length;
  const elapsedDays = days.filter(d => d.isPast || d.isToday);
  const onTrack = elapsedDays.every(d => d.completed);
  const achieved = days.every(d => d.completed);

  return { days, completedCount, onTrack, achieved };
}
