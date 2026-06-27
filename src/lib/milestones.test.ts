import { describe, it, expect } from 'vitest';
import { computeMilestones, nextMilestones, totalReached } from './milestones';

const stats = { totalTasksCompleted: 60, focusSessionsCompleted: 0, streak: 4, level: 6 };

describe('milestones', () => {
  it('marks reached tiers and computes bounded pct', () => {
    const all = computeMilestones(stats);
    expect(all.every(m => m.pct >= 0 && m.pct <= 100)).toBe(true);
    const century = all.find(m => m.track === 'tasks' && m.target === 100)!;
    expect(century.reached).toBe(false);
    expect(century.current).toBe(60);
  });
  it('returns one next tier per track', () => {
    const next = nextMilestones(stats);
    const tracks = new Set(next.map(m => m.track));
    expect(tracks.size).toBe(next.length);
    const nt = next.find(m => m.track === 'tasks')!;
    expect(nt.target).toBe(100); // 50 reached, 100 next
  });
  it('counts reached milestones', () => {
    expect(totalReached(stats)).toBeGreaterThan(0);
  });
});
