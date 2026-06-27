import { describe, it, expect } from 'vitest';
import {
  breakdownTask, classifyIntent, formatMinutes, type QuestIntent,
} from './questBreakdown';

/**
 * Labelled corpus of realistic student task titles.
 * Acts as an accuracy benchmark for the local classifier.
 */
const CORPUS: Array<[string, QuestIntent]> = [
  ['Write a 1500 word essay on the causes of WW1', 'essay'],
  ['English composition about climate change', 'essay'],
  ['Personal statement draft', 'generic'],
  ['Book review of 1984', 'essay'],
  ['Maths problem set chapter 7', 'problem_set'],
  ['Finish calculus worksheet questions 1-20', 'problem_set'],
  ['Physics p-set on kinematics', 'problem_set'],
  ['Solve integration exercises', 'problem_set'],
  ['Read chapter 4 of the biology textbook', 'reading'],
  ['Read 30 pages of the novel and annotate', 'reading'],
  ['Chemistry lab report on titration', 'lab_report'],
  ['Write up the pendulum experiment results', 'lab_report'],
  ['Physics practical observations writeup', 'lab_report'],
  ['Make a presentation about the solar system', 'presentation'],
  ['Build slides for history pitch', 'presentation'],
  ['Prepare powerpoint for group talk', 'presentation'],
  ['Revise for the chemistry exam', 'revision'],
  ['Study for biology midterm', 'revision'],
  ['Do past papers for maths', 'revision'],
  ['Memorise French vocabulary list', 'memorization'],
  ['Make flashcards for the periodic table', 'memorization'],
  ['Learn the quadratic formula by heart', 'memorization'],
  ['Debug the python script for the assignment', 'coding'],
  ['Code a function to reverse a linked list', 'coding'],
  ['Build the website for computing coursework', 'coding'],
  ['Leetcode practice: two sum', 'coding'],
  ['Science project on renewable energy', 'project'],
  ['Group project prototype for design tech', 'project'],
  ['Tidy my desk', 'generic'],
  ['Email the teacher about the trip', 'generic'],
];

describe('classifyIntent accuracy', () => {
  it('classifies the labelled corpus with high accuracy (>= 90%)', () => {
    let correct = 0;
    const misses: string[] = [];
    for (const [title, expected] of CORPUS) {
      const got = classifyIntent(title).intent;
      if (got === expected) correct++;
      else misses.push(`"${title}" -> got ${got}, expected ${expected}`);
    }
    const acc = correct / CORPUS.length;
    if (acc < 0.9) console.log('Misclassifications:\n' + misses.join('\n'));
    expect(acc).toBeGreaterThanOrEqual(0.9);
  });
});

describe('breakdownTask', () => {
  it('is deterministic', () => {
    const a = breakdownTask({ title: 'Write an essay on Macbeth', priority: 'hard' });
    const b = breakdownTask({ title: 'Write an essay on Macbeth', priority: 'hard' });
    expect(a).toEqual(b);
  });

  it('flags exactly one starter step (the first)', () => {
    const r = breakdownTask({ title: 'Maths problem set' });
    expect(r.steps[0].isStarter).toBe(true);
    expect(r.steps.filter(s => s.isStarter).length).toBe(1);
  });

  it('produces more detail for hard tasks than easy ones', () => {
    const easy = breakdownTask({ title: 'Write an essay', priority: 'easy' });
    const hard = breakdownTask({ title: 'Write an essay', priority: 'hard' });
    expect(hard.totalEstMinutes).toBeGreaterThan(easy.totalEstMinutes);
  });

  it('honours an explicit intent override with full confidence', () => {
    const r = breakdownTask({ title: 'anything at all', intent: 'revision' });
    expect(r.intent).toBe('revision');
    expect(r.confidence).toBe(1);
  });

  it('every step has a positive time estimate and totals match', () => {
    const r = breakdownTask({ title: 'Chemistry lab report' });
    expect(r.steps.every(s => s.estMinutes > 0)).toBe(true);
    expect(r.totalEstMinutes).toBe(r.steps.reduce((a, s) => a + s.estMinutes, 0));
  });

  it('falls back to generic for unrecognised tasks', () => {
    const r = breakdownTask({ title: 'asdfqwerty' });
    expect(r.intent).toBe('generic');
    expect(r.steps.length).toBeGreaterThan(2);
  });
});

describe('formatMinutes', () => {
  it('formats correctly', () => {
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(85)).toBe('1h 25m');
  });
});
