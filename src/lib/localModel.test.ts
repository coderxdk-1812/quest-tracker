import { describe, it, expect, beforeEach } from 'vitest';
import {
  formatInput, isGenericStep, parseBreakdownOutput, parseClarifyOutput, parseRefineOutput,
  isOnDeviceAssistantEnabled, setOnDeviceAssistantEnabled,
  breakdown, clarify, refine,
  type ModelTaskJson,
} from './localModel';

/**
 * Covers the JSON parsing + fallback contract (per the on-device model spec:
 * "Unit-test the JSON parsing + fallback path (not the weights)"). Every
 * public function must return null — never throw — on invalid/unsupported
 * input, since QuestBreakdown.tsx relies on null meaning "fall back to the
 * rule engine" with no special-casing.
 */

const TASK: ModelTaskJson = {
  title: 'Write an essay on WW1', description: null, subject: 'History',
  intent: 'essay', priority: 'hard', deadline: null, tags: [],
};

beforeEach(() => {
  localStorage.clear();
});

describe('formatInput', () => {
  it('builds the breakdown prefix with just the task', () => {
    expect(formatInput('breakdown', TASK)).toBe(`breakdown: ${JSON.stringify(TASK)}`);
  });

  it('builds the clarify prefix with task + steps', () => {
    const steps = ['Step one', 'Step two'];
    expect(formatInput('clarify', TASK, steps))
      .toBe(`clarify: ${JSON.stringify(TASK)} steps: ${JSON.stringify(steps)}`);
  });

  it('builds the refine prefix with task + steps + answers', () => {
    const steps = ['Step one'];
    const answers = [{ question: 'What topic?', answer: 'WW1' }];
    expect(formatInput('refine', TASK, steps, answers))
      .toBe(`refine: ${JSON.stringify(TASK)} steps: ${JSON.stringify(steps)} answers: ${JSON.stringify(answers)}`);
  });
});

describe('isGenericStep', () => {
  it('flags known filler phrases', () => {
    for (const s of ['Research the topic', 'Review your notes', 'Study', 'Prepare', 'Get started', 'Practice']) {
      expect(isGenericStep(s)).toBe(true);
    }
  });

  it('flags anything under 3 words', () => {
    expect(isGenericStep('Do it')).toBe(true);
    expect(isGenericStep('Go')).toBe(true);
  });

  it('does not flag specific steps', () => {
    for (const s of [
      'Draft a thesis about the causes of WW1',
      'Scaffold the Python project and implement the smallest piece that runs',
      'Practice past-paper questions on trigonometric identities',
    ]) {
      expect(isGenericStep(s)).toBe(false);
    }
  });
});

describe('parseBreakdownOutput', () => {
  const good = ['Read the prompt and underline what is being asked', 'Draft a thesis about WW1', 'Outline the body paragraphs', 'Draft the essay'];

  it('accepts a valid array of specific steps', () => {
    expect(parseBreakdownOutput(JSON.stringify(good))).toEqual(good);
  });

  it('rejects invalid JSON', () => {
    expect(parseBreakdownOutput('not json')).toBeNull();
    expect(parseBreakdownOutput('{"steps": [}')).toBeNull();
  });

  it('rejects a non-array', () => {
    expect(parseBreakdownOutput(JSON.stringify({ steps: good }))).toBeNull();
  });

  it('rejects too few or too many steps', () => {
    expect(parseBreakdownOutput(JSON.stringify(['One step only', 'Two steps total']))).toBeNull();
    expect(parseBreakdownOutput(JSON.stringify(Array(10).fill('A reasonably specific filler step')))).toBeNull();
  });

  it('rejects bare generic placeholders', () => {
    expect(parseBreakdownOutput(JSON.stringify(['Research the topic', 'Review your notes', 'Study', 'Prepare']))).toBeNull();
  });

  it('rejects duplicate steps', () => {
    const dup = ['Draft the essay body', 'Draft the essay body', 'Write the intro', 'Proofread it carefully'];
    expect(parseBreakdownOutput(JSON.stringify(dup))).toBeNull();
  });
});

describe('parseClarifyOutput', () => {
  const steps = ['Research the topic', 'Draft the body paragraphs', 'Write the conclusion'];

  it('accepts a valid targeted question', () => {
    const out = [{ question: 'What is the essay about?', targetStepIndex: 0, targetStepText: 'Research the topic' }];
    expect(parseClarifyOutput(JSON.stringify(out), steps)).toEqual(out);
  });

  it('accepts an empty array (no vague steps found)', () => {
    expect(parseClarifyOutput('[]', steps)).toEqual([]);
  });

  it('rejects invalid JSON', () => {
    expect(parseClarifyOutput('nope', steps)).toBeNull();
  });

  it('rejects an out-of-range targetStepIndex', () => {
    const out = [{ question: 'huh?', targetStepIndex: 99, targetStepText: 'Research the topic' }];
    expect(parseClarifyOutput(JSON.stringify(out), steps)).toBeNull();
  });

  it('rejects when targetStepText does not match the actual step at that index', () => {
    const out = [{ question: 'huh?', targetStepIndex: 0, targetStepText: 'This is not the real step text' }];
    expect(parseClarifyOutput(JSON.stringify(out), steps)).toBeNull();
  });

  it('rejects more than 3 questions', () => {
    const out = Array.from({ length: 4 }, (_, i) => ({ question: `Q${i}`, targetStepIndex: 0, targetStepText: steps[0] }));
    expect(parseClarifyOutput(JSON.stringify(out), steps)).toBeNull();
  });
});

describe('parseRefineOutput', () => {
  const oldSteps = ['Research the topic', 'Draft the body paragraphs', 'Write the conclusion', 'Proofread it once'];
  const answers = [{ question: 'What is the essay about?', answer: 'the causes of the French Revolution' }];

  it('accepts genuinely sharpened steps that reflect the answer', () => {
    const sharpened = [
      'Draft a thesis about the causes of the French Revolution',
      'Draft the body paragraphs on the French Revolution',
      'Write the conclusion tying back to the French Revolution',
      'Proofread it once for grammar and flow',
    ];
    expect(parseRefineOutput(JSON.stringify(sharpened), oldSteps, answers)).toEqual(sharpened);
  });

  it('rejects output identical to the input steps', () => {
    expect(parseRefineOutput(JSON.stringify(oldSteps), oldSteps, answers)).toBeNull();
  });

  it('rejects changed steps whose content does not reflect any answer', () => {
    const unrelated = ['Look at the prompt again', 'Draft some paragraphs', 'Write an ending', 'Check it over once'];
    expect(parseRefineOutput(JSON.stringify(unrelated), oldSteps, answers)).toBeNull();
  });

  it('does not require answer-reflection when there were no answers to give', () => {
    const changed = ['Skim the topic overview', 'Draft the body paragraphs carefully', 'Write a strong conclusion', 'Proofread it twice'];
    expect(parseRefineOutput(JSON.stringify(changed), oldSteps, [])).toEqual(changed);
  });

  it('still rejects bare generic placeholders even if technically "changed"', () => {
    const stillVague = ['Research', 'Review your notes', 'Study', 'Prepare'];
    expect(parseRefineOutput(JSON.stringify(stillVague), oldSteps, answers)).toBeNull();
  });
});

describe('on-device assistant enable/disable preference', () => {
  it('defaults to disabled', () => {
    expect(isOnDeviceAssistantEnabled()).toBe(false);
  });

  it('persists enabling and disabling', () => {
    setOnDeviceAssistantEnabled(true);
    expect(isOnDeviceAssistantEnabled()).toBe(true);
    setOnDeviceAssistantEnabled(false);
    expect(isOnDeviceAssistantEnabled()).toBe(false);
  });
});

describe('fallback contract: breakdown/clarify/refine return null (never throw) when disabled', () => {
  it('breakdown() resolves to null without attempting to load a model', async () => {
    setOnDeviceAssistantEnabled(false);
    await expect(breakdown(TASK)).resolves.toBeNull();
  });

  it('clarify() resolves to null without attempting to load a model', async () => {
    setOnDeviceAssistantEnabled(false);
    await expect(clarify(TASK, ['Some step'])).resolves.toBeNull();
  });

  it('refine() resolves to null without attempting to load a model', async () => {
    setOnDeviceAssistantEnabled(false);
    await expect(refine(TASK, ['Some step'], [])).resolves.toBeNull();
  });
});
