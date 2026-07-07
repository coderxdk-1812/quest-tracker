import { describe, it, expect } from 'vitest';
import { getStreakStatus, isStreakSaveEvent, streakTier } from './streak';

const now = new Date('2026-06-25T18:00:00');
const k = (d: Date) => d.toISOString().split('T')[0];
const today = k(now);
const yesterday = k(new Date(now.getTime() - 86_400_000));
const twoDaysAgo = k(new Date(now.getTime() - 2 * 86_400_000));

describe('getStreakStatus', () => {
  it('is safe when acted today', () => {
    expect(getStreakStatus({ streak: 5, lastActiveDate: today, now }).state).toBe('safe');
  });
  it('is at risk when last active yesterday', () => {
    const s = getStreakStatus({ streak: 5, lastActiveDate: yesterday, now });
    expect(s.state).toBe('at_risk');
    expect(s.hoursLeft).toBeGreaterThan(0);
  });
  it('is recoverable (with freeze) after missing a day', () => {
    const s = getStreakStatus({ streak: 5, lastActiveDate: twoDaysAgo, streakFreezes: 1, now });
    expect(s.state).toBe('recoverable');
    expect(s.canUseFreeze).toBe(true);
  });
  it('is none with no streak', () => {
    expect(getStreakStatus({ streak: 0, lastActiveDate: '', now }).state).toBe('none');
  });
});

describe('isStreakSaveEvent', () => {
  it('is true when freezes decreased (a save happened)', () => {
    expect(isStreakSaveEvent(2, 1)).toBe(true);
  });
  it('is false when freezes increased (a purchase, not a save)', () => {
    expect(isStreakSaveEvent(1, 2)).toBe(false);
  });
  it('is false when freezes are unchanged', () => {
    expect(isStreakSaveEvent(1, 1)).toBe(false);
  });
});

describe('streakTier', () => {
  it('matches milestones.ts streak tiers (3/7/30)', () => {
    expect(streakTier(0)).toBe(0);
    expect(streakTier(2)).toBe(0);
    expect(streakTier(3)).toBe(1);
    expect(streakTier(6)).toBe(1);
    expect(streakTier(7)).toBe(2);
    expect(streakTier(29)).toBe(2);
    expect(streakTier(30)).toBe(3);
    expect(streakTier(500)).toBe(3);
  });
});
