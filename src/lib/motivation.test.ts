import { describe, it, expect } from 'vitest';
import { rollSurpriseReward, subjectMastery, masteryTitle, dailyCueState } from './motivation';

/** rng that returns a queued sequence, then 0. */
function seq(values: number[]): () => number {
  let i = 0;
  return () => (i < values.length ? values[i++] : 0);
}

describe('rollSurpriseReward', () => {
  it('returns null most of the time', () => {
    expect(rollSurpriseReward(seq([0.5]))).toBeNull();
    expect(rollSurpriseReward(seq([0.99]))).toBeNull();
  });
  it('gives bonus coins on a common hit', () => {
    const r = rollSurpriseReward(seq([0.05, 0.3, 0.0]))!;
    expect(r).not.toBeNull();
    expect(r.coins).toBeGreaterThan(0);
    expect(r.xp).toBe(0);
  });
  it('gives an xp spark in the mid band', () => {
    const r = rollSurpriseReward(seq([0.05, 0.7]))!;
    expect(r.xp).toBe(15);
    expect(r.coins).toBe(0);
  });
  it('gives a jackpot in the rare band', () => {
    const r = rollSurpriseReward(seq([0.05, 0.95, 0.0]))!;
    expect(r.coins).toBeGreaterThanOrEqual(50);
  });
});

describe('subjectMastery', () => {
  it('levels up every 5 completed tasks and sorts by activity', () => {
    const tasks = [
      ...Array(6).fill(0).map(() => ({ subject: 'Maths', completed: true })),
      { subject: 'Maths', completed: false },
      { subject: 'English', completed: true },
      { subject: '', completed: true },
    ];
    const m = subjectMastery(tasks);
    expect(m[0].subject).toBe('Maths');
    expect(m[0].completed).toBe(6);
    expect(m[0].level).toBe(2);          // 6 → level 2
    expect(m[0].title).toBe('Apprentice');
    expect(m.length).toBe(2);            // blank subject ignored
  });
  it('masteryTitle caps at Master', () => {
    expect(masteryTitle(1)).toBe('Novice');
    expect(masteryTitle(99)).toBe('Master');
  });
});

describe('dailyCueState', () => {
  const now = new Date('2026-06-29T09:00:00Z');
  const today = now.toISOString().slice(0, 10);
  it('set when acted today', () => {
    expect(dailyCueState({ lastActiveDate: today, streak: 3, totalCompleted: 9, now })).toBe('set');
  });
  it('streak_active when streak alive but not today', () => {
    expect(dailyCueState({ lastActiveDate: '2026-06-28', streak: 3, totalCompleted: 9, now })).toBe('streak_active');
  });
  it('comeback when lapsed after prior activity', () => {
    expect(dailyCueState({ lastActiveDate: '2026-06-20', streak: 0, totalCompleted: 12, now })).toBe('comeback');
  });
  it('fresh for a brand-new user', () => {
    expect(dailyCueState({ lastActiveDate: '', streak: 0, totalCompleted: 0, now })).toBe('fresh');
  });
});
