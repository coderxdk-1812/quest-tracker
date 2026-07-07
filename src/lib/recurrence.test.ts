import { describe, it, expect } from 'vitest';
import { computeNextOccurrenceDeadline, isRecurrenceDue } from './recurrence';

// 2026-06-25 is a Thursday (weekday index 3, Mon=0..Sun=6).
const thursday = '2026-06-25T18:00:00.000Z';

describe('computeNextOccurrenceDeadline', () => {
  it('daily: advances by exactly one day', () => {
    const next = computeNextOccurrenceDeadline(thursday, { type: 'daily' });
    expect(next).toBe('2026-06-26T18:00:00.000Z');
  });

  it('weekly: advances by exactly seven days', () => {
    const next = computeNextOccurrenceDeadline(thursday, { type: 'weekly' });
    expect(next).toBe('2026-07-02T18:00:00.000Z');
  });

  it('weekdays: jumps to the next configured weekday', () => {
    // Mon(0), Wed(2), Fri(4) — from Thursday, next hit is Friday.
    const next = computeNextOccurrenceDeadline(thursday, { type: 'weekdays', days: [0, 2, 4] });
    expect(next).toBe('2026-06-26T18:00:00.000Z');
  });

  it('weekdays: wraps to next week when no more configured days remain this week', () => {
    // Only Monday(0) configured — from Thursday, next hit is the following Monday.
    const next = computeNextOccurrenceDeadline(thursday, { type: 'weekdays', days: [0] });
    expect(next).toBe('2026-06-29T18:00:00.000Z');
  });

  it('weekdays: falls back to +7 days when misconfigured with no days', () => {
    const next = computeNextOccurrenceDeadline(thursday, { type: 'weekdays', days: [] });
    expect(next).toBe('2026-07-02T18:00:00.000Z');
  });

  it('uses `from` as the anchor when there is no existing deadline', () => {
    const from = new Date(thursday);
    const next = computeNextOccurrenceDeadline(undefined, { type: 'daily' }, from);
    expect(next).toBe('2026-06-26T18:00:00.000Z');
  });
});

describe('isRecurrenceDue', () => {
  const now = new Date('2026-06-25T12:00:00.000Z');

  it('is false without a recurrence rule', () => {
    expect(isRecurrenceDue({ completed: false, deadline: '2026-06-24T12:00:00.000Z' }, now)).toBe(false);
  });

  it('is false once already completed', () => {
    expect(isRecurrenceDue({ completed: true, deadline: '2026-06-24T12:00:00.000Z', recurrence: { type: 'daily' } }, now)).toBe(false);
  });

  it('is false without a deadline to compare against', () => {
    expect(isRecurrenceDue({ completed: false, recurrence: { type: 'daily' } }, now)).toBe(false);
  });

  it('is true once the deadline has passed while still incomplete', () => {
    expect(isRecurrenceDue({ completed: false, deadline: '2026-06-24T12:00:00.000Z', recurrence: { type: 'daily' } }, now)).toBe(true);
  });

  it('is false before the deadline arrives', () => {
    expect(isRecurrenceDue({ completed: false, deadline: '2026-06-26T12:00:00.000Z', recurrence: { type: 'daily' } }, now)).toBe(false);
  });
});
