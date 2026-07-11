import { describe, it, expect } from 'vitest';
import {
  breakdownTask, classifyIntent, clarifyingQuestions, formatMinutes,
  type QuestIntent, type SlotAnswers,
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

describe('clarifyingQuestions (structured slots)', () => {
  const ALL_INTENTS: QuestIntent[] = [
    'essay', 'problem_set', 'reading', 'lab_report', 'presentation',
    'revision', 'coding', 'project', 'memorization', 'generic',
  ];

  it('gives every intent at least one slot-keyed question with a non-empty key', () => {
    for (const intent of ALL_INTENTS) {
      const qs = clarifyingQuestions(intent);
      expect(qs.length).toBeGreaterThan(0);
      for (const q of qs) {
        expect(q.key.length).toBeGreaterThan(0);
        expect(q.question.length).toBeGreaterThan(0);
      }
    }
  });

  it('has unique slot keys within a single intent', () => {
    for (const intent of ALL_INTENTS) {
      const keys = clarifyingQuestions(intent).map(q => q.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

/**
 * Regression coverage for the "Regenerate with this" bug: answers to the
 * clarifying questions must actually change the step labels, not just be
 * appended to unused context. One case per intent that ships questions.
 */
describe('applyModifiers slot injection (answers sharpen steps)', () => {
  const labelsFor = (title: string, intent: QuestIntent, answers?: SlotAnswers) =>
    breakdownTask({ title, intent, answers }).steps.map(s => s.label);

  it('essay: topic and wordCount answers change the thesis/outline/body steps', () => {
    const base = labelsFor('Write an essay', 'essay');
    const answers: SlotAnswers = { topic: 'the causes of WW1', wordCount: '1500' };
    const sharpened = labelsFor('Write an essay', 'essay', answers);
    expect(sharpened).not.toEqual(base);
    expect(sharpened.some(l => l.includes('the causes of WW1'))).toBe(true);
    expect(sharpened.some(l => l.includes('1500 words'))).toBe(true);
  });

  it('essay: falls back to generic wording when no answers are given', () => {
    const r = breakdownTask({ title: 'Write an essay', intent: 'essay' });
    expect(r.steps.some(s => s.label === 'Write a one-line thesis / main argument')).toBe(true);
  });

  it('problem_set: count and topic answers change the skim/hard steps', () => {
    const base = labelsFor('Finish the problem set', 'problem_set');
    const sharpened = labelsFor('Finish the problem set', 'problem_set', { count: '20', topic: 'quadratic equations' });
    expect(sharpened).not.toEqual(base);
    expect(sharpened.some(l => l.includes('20') && l.includes('quadratic equations'))).toBe(true);
    expect(sharpened.some(l => l.toLowerCase().includes('hardest quadratic equations problems'))).toBe(true);
  });

  it('presentation: audience and minutes answers change the message/rehearse steps', () => {
    const base = labelsFor('Make a presentation', 'presentation');
    const sharpened = labelsFor('Make a presentation', 'presentation', { audience: 'the school board', minutes: '5' });
    expect(sharpened).not.toEqual(base);
    expect(sharpened.some(l => l.includes('the school board'))).toBe(true);
    expect(sharpened.some(l => l.includes('~5 min'))).toBe(true);
  });

  it('coding: language and mode answers change the scaffold/restate steps', () => {
    const base = labelsFor('Build a small app', 'coding');
    const sharpened = labelsFor('Build a small app', 'coding', { language: 'Python', mode: 'debugging existing code' });
    expect(sharpened).not.toEqual(base);
    expect(sharpened.some(l => l.includes('Scaffold the Python project'))).toBe(true);
    expect(sharpened.some(l => l.includes('Restate the bug'))).toBe(true);
  });

  it('revision: weakTopics answer changes the re-learn/practice steps', () => {
    const base = labelsFor('Revise for the exam', 'revision');
    const sharpened = labelsFor('Revise for the exam', 'revision', { weakTopics: 'trigonometry' });
    expect(sharpened).not.toEqual(base);
    expect(sharpened.filter(l => l.includes('trigonometry')).length).toBeGreaterThanOrEqual(2);
  });

  it('project: deliverable answer changes the goal step, groupOrSolo answer adds coordination step', () => {
    const base = labelsFor('Science fair project', 'project');
    const sharpened = labelsFor('Science fair project', 'project', {
      deliverable: 'a working volcano model', groupOrSolo: 'group of three',
    });
    expect(sharpened).not.toEqual(base);
    expect(sharpened.some(l => l.includes('a working volcano model'))).toBe(true);
    expect(sharpened.some(l => l.toLowerCase().includes('agree who does what'))).toBe(true);
  });

  it('accumulates: a second regenerate with more answers is strictly more specific than the first', () => {
    const first = labelsFor('Make a presentation', 'presentation', { audience: 'the class' });
    const second = labelsFor('Make a presentation', 'presentation', { audience: 'the class', minutes: '8', slides: '12' });
    expect(second).not.toEqual(first);
    expect(second.some(l => l.includes('~8 min'))).toBe(true);
    expect(second.some(l => l.includes('12 slides'))).toBe(true);
  });
});
