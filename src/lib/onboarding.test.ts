import { describe, it, expect } from 'vitest';
import { computeOnboarding } from './onboarding';

describe('computeOnboarding', () => {
  it('orders steps and points to the first incomplete one', () => {
    const o = computeOnboarding({ hasTask: true, hasBrokenDownTask: false, hasFocusSession: false });
    expect(o.completedCount).toBe(1);
    expect(o.nextStep?.id).toBe('break_down');
    expect(o.pct).toBe(33);
  });
  it('reports completion when all done', () => {
    const o = computeOnboarding({ hasTask: true, hasBrokenDownTask: true, hasFocusSession: true });
    expect(o.allDone).toBe(true);
    expect(o.nextStep).toBeNull();
    expect(o.pct).toBe(100);
  });
  it('starts with add_task when empty', () => {
    const o = computeOnboarding({ hasTask: false, hasBrokenDownTask: false, hasFocusSession: false });
    expect(o.nextStep?.id).toBe('add_task');
    expect(o.completedCount).toBe(0);
  });
});
