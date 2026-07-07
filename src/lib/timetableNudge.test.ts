import { describe, it, expect } from 'vitest';
import { getTimetableNudge, type TNTask, type TNTimetableEntry } from './timetableNudge';

const MON = 0;
const TUE = 1;

describe('getTimetableNudge', () => {
  it('returns null when there are no classes today', () => {
    const entries: TNTimetableEntry[] = [{ subject: 'Maths', day: TUE }];
    expect(getTimetableNudge(entries, [], MON)).toBeNull();
  });

  it('nudges about a subject with a class today and no open task', () => {
    const entries: TNTimetableEntry[] = [{ subject: 'Maths', day: MON }];
    expect(getTimetableNudge(entries, [], MON)).toEqual({ subject: 'Maths' });
  });

  it('does not nudge when an open task already exists for that subject', () => {
    const entries: TNTimetableEntry[] = [{ subject: 'Maths', day: MON }];
    const tasks: TNTask[] = [{ completed: false, subject: 'Maths' }];
    expect(getTimetableNudge(entries, tasks, MON)).toBeNull();
  });

  it('is case-insensitive when matching subjects', () => {
    const entries: TNTimetableEntry[] = [{ subject: 'maths', day: MON }];
    const tasks: TNTask[] = [{ completed: false, subject: 'Maths' }];
    expect(getTimetableNudge(entries, tasks, MON)).toBeNull();
  });

  it('ignores a completed task when checking for an open one', () => {
    const entries: TNTimetableEntry[] = [{ subject: 'Maths', day: MON }];
    const tasks: TNTask[] = [{ completed: true, subject: 'Maths' }];
    expect(getTimetableNudge(entries, tasks, MON)).toEqual({ subject: 'Maths' });
  });

  it('picks the nearest class (by start time) among several unmet subjects', () => {
    const entries: TNTimetableEntry[] = [
      { subject: 'History', day: MON, startTime: '14:00' },
      { subject: 'Maths', day: MON, startTime: '09:00' },
    ];
    expect(getTimetableNudge(entries, [], MON)).toEqual({ subject: 'Maths' });
  });

  it('supports the multi-day `days` field, falling back to `day` when absent', () => {
    const entries: TNTimetableEntry[] = [{ subject: 'Maths', day: 9, days: [MON, TUE] }];
    expect(getTimetableNudge(entries, [], MON)).toEqual({ subject: 'Maths' });
  });

  it('returns null once every today-subject already has an open task', () => {
    const entries: TNTimetableEntry[] = [
      { subject: 'Maths', day: MON },
      { subject: 'History', day: MON },
    ];
    const tasks: TNTask[] = [
      { completed: false, subject: 'Maths' },
      { completed: false, subject: 'History' },
    ];
    expect(getTimetableNudge(entries, tasks, MON)).toBeNull();
  });
});
