import { describe, it, expect } from 'vitest';
import { recommendNextMove, type NMTask } from './nextMove';

const iso = (d: Date) => d.toISOString();
const now = new Date('2026-06-25T12:00:00');
const yesterday = new Date('2026-06-24T12:00:00');
const laterToday = new Date('2026-06-25T20:00:00');

const t = (over: Partial<NMTask>): NMTask => ({
  id: Math.random().toString(36).slice(2), title: 'Task', completed: false, priority: 'medium', ...over,
});

describe('recommendNextMove fallback ladder', () => {
  it('prioritises overdue tasks', () => {
    const m = recommendNextMove({ tasks: [
      t({ title: 'Old essay', deadline: iso(yesterday) }),
      t({ title: 'Future thing', deadline: iso(laterToday) }),
    ], now });
    expect(m.kind).toBe('overdue');
    expect(m.taskTitle).toBe('Old essay');
  });

  it('never suggests overdue when nothing is overdue', () => {
    const m = recommendNextMove({ tasks: [t({ title: 'Due later', deadline: iso(laterToday) })], now });
    expect(m.kind).toBe('due_today');
  });

  it('falls to scheduled-subject when no deadlines apply', () => {
    const m = recommendNextMove({
      tasks: [t({ title: 'Maths sheet', subject: 'Maths' })],
      timetable: [{ subject: 'Maths', day: (now.getDay() + 6) % 7 }],
      now,
    });
    expect(m.kind).toBe('scheduled_subject');
  });

  it('falls to breaking down the biggest task', () => {
    const m = recommendNextMove({ tasks: [
      t({ title: 'Easy', priority: 'easy' }),
      t({ title: 'Big hard project', priority: 'hard' }),
    ], now });
    expect(m.kind).toBe('breakdown_big');
    expect(m.taskTitle).toBe('Big hard project');
  });

  it('suggests adding a first task when empty', () => {
    expect(recommendNextMove({ tasks: [], now }).kind).toBe('add_first_task');
  });

  it('protects the streak when caught up and streak not safe', () => {
    const m = recommendNextMove({ tasks: [t({ completed: true })], streakSafeToday: false, now });
    expect(m.kind).toBe('focus_streak');
  });

  it('suggests planning ahead when fully caught up and streak safe', () => {
    const m = recommendNextMove({ tasks: [t({ completed: true })], streakSafeToday: true, now });
    expect(m.kind).toBe('plan_ahead');
  });

  it('always returns a non-empty cta and route', () => {
    const m = recommendNextMove({ tasks: [], now });
    expect(m.cta.length).toBeGreaterThan(0);
    expect(['/tasks', '/focus', '/timetable']).toContain(m.route);
  });
});
