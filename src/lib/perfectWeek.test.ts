import { describe, it, expect } from 'vitest';
import { computePerfectWeek } from './perfectWeek';

// 2026-06-25 is a Thursday (weekday index 3, Mon=0..Sun=6), so this week runs
// Mon 2026-06-22 .. Sun 2026-06-28.
const now = new Date('2026-06-25T12:00:00.000Z');
const MON = '2026-06-22', TUE = '2026-06-23', WED = '2026-06-24';
const THU = '2026-06-25', FRI = '2026-06-26', SAT = '2026-06-27', SUN = '2026-06-28';

describe('computePerfectWeek', () => {
  it('marks correct past/today/upcoming flags for each day', () => {
    const { days } = computePerfectWeek([], now);
    expect(days.map(d => d.date)).toEqual([MON, TUE, WED, THU, FRI, SAT, SUN]);
    expect(days[0]).toMatchObject({ isPast: true, isToday: false });
    expect(days[3]).toMatchObject({ isPast: false, isToday: true }); // Thursday = today
    expect(days[4]).toMatchObject({ isPast: false, isToday: false }); // Friday = upcoming
  });

  it('is on track when every elapsed day (through today) has a completion', () => {
    const { onTrack, achieved, completedCount } = computePerfectWeek([MON, TUE, WED, THU], now);
    expect(onTrack).toBe(true);
    expect(achieved).toBe(false); // Fri–Sun haven't happened yet
    expect(completedCount).toBe(4);
  });

  it('is not on track when a past day was missed', () => {
    // Monday missing, Tue/Wed/Thu done.
    const { onTrack } = computePerfectWeek([TUE, WED, THU], now);
    expect(onTrack).toBe(false);
  });

  it('is not on track when today itself has no completion yet', () => {
    const { onTrack } = computePerfectWeek([MON, TUE, WED], now);
    expect(onTrack).toBe(false);
  });

  it('never counts a future day, even with no activity, against the user', () => {
    const { days } = computePerfectWeek([], now);
    const future = days.filter(d => !d.isPast && !d.isToday);
    expect(future.every(d => d.completed === false)).toBe(true);
    expect(future.every(d => !d.isPast)).toBe(true);
  });

  it('is achieved only once all 7 days have a completion', () => {
    const almost = computePerfectWeek([MON, TUE, WED, THU, FRI, SAT], now);
    expect(almost.achieved).toBe(false);
    const full = computePerfectWeek([MON, TUE, WED, THU, FRI, SAT, SUN], now);
    expect(full.achieved).toBe(true);
    expect(full.completedCount).toBe(7);
  });

  it('accepts full ISO timestamps, not just date strings', () => {
    const { completedCount } = computePerfectWeek(['2026-06-22T23:59:00.000Z'], now);
    expect(completedCount).toBe(1);
  });
});
