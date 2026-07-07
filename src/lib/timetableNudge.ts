/**
 * Timetable nudge (spec §4): if the user has a class today with no open task yet
 * for that subject, gently suggest capturing one — "You have <Subject> today —
 * got a <Subject> task?". Pure & testable; never nudges about a subject that
 * already has an open task, and never nudges when there's nothing scheduled today.
 */

export interface TNTask {
  completed: boolean;
  subject?: string;
}

export interface TNTimetableEntry {
  subject: string;
  /** Legacy single weekday index, Mon=0..Sun=6 — used when `days` is empty. */
  day: number;
  /** Weekdays this class repeats on, Mon=0..Sun=6. Source of truth when present. */
  days?: number[];
  /** "HH:MM" — used only to nudge about the nearest class first. */
  startTime?: string;
}

export interface TimetableNudge {
  subject: string;
}

function todaysEntries(entries: TNTimetableEntry[], todayIdx: number): TNTimetableEntry[] {
  return entries
    .filter(e => {
      const days = e.days && e.days.length > 0 ? e.days : [e.day];
      return days.includes(todayIdx);
    })
    .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
}

/**
 * At most one nudge: the nearest today-scheduled subject that has no matching
 * open (incomplete) task yet. Returns null if there's nothing to nudge about.
 */
export function getTimetableNudge(
  entries: TNTimetableEntry[],
  tasks: TNTask[],
  todayIdx: number,
): TimetableNudge | null {
  const today = todaysEntries(entries, todayIdx);
  if (today.length === 0) return null;

  const openSubjects = new Set(
    tasks.filter(t => !t.completed && t.subject).map(t => t.subject!.trim().toLowerCase())
  );

  const seen = new Set<string>();
  for (const entry of today) {
    const key = entry.subject.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!openSubjects.has(key)) {
      return { subject: entry.subject };
    }
  }
  return null;
}
