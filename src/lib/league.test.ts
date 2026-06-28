import { describe, it, expect } from 'vitest';
import { zoneFor, tierInfo, msUntilWeeklyReset, formatCountdown, MAX_TIER } from './league';

describe('league helpers', () => {
  it('marks promotion zone (top 5) below max tier', () => {
    expect(zoneFor(1, 30, 2)).toBe('promote');
    expect(zoneFor(5, 30, 2)).toBe('promote');
    expect(zoneFor(6, 30, 2)).toBe('hold');
  });
  it('never promotes from the top tier', () => {
    expect(zoneFor(1, 30, MAX_TIER)).toBe('hold');
  });
  it('marks relegation zone (bottom 5) above bottom tier', () => {
    expect(zoneFor(30, 30, 3)).toBe('demote');
    expect(zoneFor(26, 30, 3)).toBe('demote');
    expect(zoneFor(25, 30, 3)).toBe('hold');
  });
  it('never relegates from the bottom tier (soft floor)', () => {
    expect(zoneFor(30, 30, 0)).toBe('hold');
  });
  it('clamps tier info to valid range', () => {
    expect(tierInfo(-5).name).toBe('Bronze');
    expect(tierInfo(99).name).toBe('Diamond');
  });
  it('weekly reset is always in the future and within a week', () => {
    const ms = msUntilWeeklyReset(new Date('2026-06-24T12:00:00'));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(7 * 24 * 3600 * 1000);
  });
  it('formats countdowns', () => {
    expect(formatCountdown(2 * 86400000 + 3 * 3600000)).toBe('2d 3h');
    expect(formatCountdown(3 * 3600000 + 12 * 60000)).toBe('3h 12m');
    expect(formatCountdown(12 * 60000)).toBe('12m');
  });
});
