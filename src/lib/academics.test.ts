import { describe, it, expect } from 'vitest';
import { daysUntil, examUrgency, countdownLabel, goalProgress, effortBySubject, nextConfidence } from './academics';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const now = new Date('2026-06-29T09:00:00');

describe('academics helpers', () => {
  it('daysUntil counts whole days', () => {
    expect(daysUntil(iso(now), now)).toBe(0);
    expect(daysUntil(iso(new Date('2026-07-04')), now)).toBe(5);
    expect(daysUntil(iso(new Date('2026-06-27')), now)).toBe(-2);
  });
  it('examUrgency buckets', () => {
    expect(examUrgency(-1)).toBe('past');
    expect(examUrgency(0)).toBe('today');
    expect(examUrgency(2)).toBe('urgent');
    expect(examUrgency(10)).toBe('soon');
    expect(examUrgency(30)).toBe('far');
  });
  it('countdownLabel reads naturally', () => {
    expect(countdownLabel(0)).toBe('Today');
    expect(countdownLabel(1)).toBe('Tomorrow');
    expect(countdownLabel(5)).toBe('in 5 days');
    expect(countdownLabel(-2)).toBe('2d ago');
  });
  it('goalProgress from subject tasks', () => {
    const tasks = [
      { subject: 'Chemistry', completed: true },
      { subject: 'Chemistry', completed: false },
      { subject: 'Maths', completed: true },
    ];
    expect(goalProgress(tasks, 'Chemistry')).toEqual({ completed: 1, total: 2, pct: 50 });
    expect(goalProgress(tasks, undefined)).toEqual({ completed: 0, total: 0, pct: 0 });
  });
  it('effortBySubject aggregates and sorts', () => {
    const tasks = [
      { subject: 'Maths', completed: true },
      { subject: 'Maths', completed: true },
      { subject: 'English', completed: true },
      { subject: '', completed: true },
    ];
    const e = effortBySubject(tasks);
    expect(e[0]).toEqual({ subject: 'Maths', completed: 2, total: 2 });
    expect(e.find(x => x.subject === 'English')?.completed).toBe(1);
    expect(e.length).toBe(2); // blank subject ignored
  });
  it('nextConfidence cycles RAG', () => {
    expect(nextConfidence('red')).toBe('amber');
    expect(nextConfidence('amber')).toBe('green');
    expect(nextConfidence('green')).toBe('red');
  });
});
