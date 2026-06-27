/**
 * Local Quest Breakdown engine — turns a single task into an ordered "quest line"
 * of small, concrete sub-steps.
 *
 * WHY THIS EXISTS (grounded in user research):
 *   "Don't know where to start" was the #3 procrastination trigger (41% of students)
 *   and "break it into smaller tasks" was the single most common first move on a hard
 *   assignment. The expert review independently asked for quest-style progression and an
 *   "always present a relevant next action" system. This engine serves both.
 *
 * DESIGN CONSTRAINT (from the product owner):
 *   100% local. No network calls, no API keys, no paid plans, no rate limits, works
 *   offline. It is deterministic, which for this bounded domain (student task types)
 *   gives higher and more predictable accuracy than a small in-browser ML model — and
 *   it adds zero latency and zero cost. If fuzzier free-text understanding is ever
 *   needed, this module's `classifyIntent` can be swapped for a transformers.js ONNX
 *   classifier running locally in the browser without changing any callers.
 *
 * No imports. Pure functions. Fully unit-testable.
 */

export type QuestIntent =
  | 'essay'
  | 'problem_set'
  | 'reading'
  | 'lab_report'
  | 'presentation'
  | 'revision'
  | 'coding'
  | 'project'
  | 'memorization'
  | 'generic';

export type TaskDifficulty = 'easy' | 'medium' | 'hard';

export interface BreakdownInput {
  title: string;
  description?: string;
  subject?: string;
  priority?: TaskDifficulty;
  /** ISO string. Used only to flag urgency in the intro copy. */
  deadline?: string;
  /** Optional override; if omitted the engine classifies from the text. */
  intent?: QuestIntent;
}

export interface QuestStep {
  /** Stable id derived from index, so progress can be persisted. */
  id: string;
  label: string;
  /** Rough effort estimate in minutes. */
  estMinutes: number;
  /** The very first step is flagged so the UI can offer a one-tap "Start". */
  isStarter?: boolean;
}

export interface QuestBreakdown {
  intent: QuestIntent;
  /** Human label for the detected intent, e.g. "Essay / writing". */
  intentLabel: string;
  /** Confidence 0..1 from the classifier (1 when intent was supplied explicitly). */
  confidence: number;
  steps: QuestStep[];
  totalEstMinutes: number;
}

interface IntentSpec {
  label: string;
  /** Weighted keyword/regex signals. Higher weight = stronger signal. */
  signals: { re: RegExp; w: number }[];
}

/**
 * Keyword signals per intent. Word boundaries keep "art" from matching "start", etc.
 * Order of INTENT_SPECS also defines tie-break priority (earlier wins ties).
 */
const INTENT_SPECS: Record<Exclude<QuestIntent, 'generic'>, IntentSpec> = {
  lab_report: {
    label: 'Lab report / experiment',
    signals: [
      { re: /\blab\b/, w: 3 }, { re: /\bpractical\b/, w: 3 },
      { re: /\bexperiment\b/, w: 3 }, { re: /\bhypothesis\b/, w: 2 },
      { re: /\bmethod(?:ology)?\b/, w: 1 }, { re: /\bresults?\b/, w: 1 },
      { re: /\bobservations?\b/, w: 2 }, { re: /\btitration\b/, w: 3 },
    ],
  },
  problem_set: {
    label: 'Problem set',
    signals: [
      { re: /\bproblem set\b/, w: 4 }, { re: /\bp-?set\b/, w: 4 },
      { re: /\bproblems?\b/, w: 2 }, { re: /\bexercises?\b/, w: 2 },
      { re: /\bquestions?\b/, w: 1 }, { re: /\bworksheet\b/, w: 3 },
      { re: /\bequations?\b/, w: 2 }, { re: /\bsums?\b/, w: 2 },
      { re: /\bcalcul/, w: 2 }, { re: /\bderivativ/, w: 2 },
      { re: /\bintegrat/, w: 2 }, { re: /\bmaths?\b/, w: 1 },
    ],
  },
  coding: {
    label: 'Coding / build',
    signals: [
      { re: /\bcode\b/, w: 3 }, { re: /\bcoding\b/, w: 3 },
      { re: /\bprogram(?:ming)?\b/, w: 3 }, { re: /\bdebug\b/, w: 3 },
      { re: /\bfunction\b/, w: 2 }, { re: /\balgorithm\b/, w: 2 },
      { re: /\bapp\b/, w: 2 }, { re: /\bwebsite\b/, w: 2 },
      { re: /\bscript\b/, w: 2 }, { re: /\bapi\b/, w: 2 },
      { re: /\bpython\b/, w: 3 }, { re: /\bjava(?:script)?\b/, w: 3 },
      { re: /\bleetcode\b/, w: 4 }, { re: /\bbug\b/, w: 2 },
    ],
  },
  essay: {
    label: 'Essay / writing',
    signals: [
      { re: /\bessay\b/, w: 4 }, { re: /\bwrite\b/, w: 2 },
      { re: /\bwriting\b/, w: 2 }, { re: /\bcomposition\b/, w: 3 },
      { re: /\barticle\b/, w: 2 }, { re: /\bparagraph\b/, w: 2 },
      { re: /\bdissertation\b/, w: 3 }, { re: /\breport\b/, w: 1 },
      { re: /\bthesis\b/, w: 2 }, { re: /\bblog\b/, w: 2 },
      { re: /\breview\b/, w: 1 }, { re: /\bletter\b/, w: 2 },
    ],
  },
  presentation: {
    label: 'Presentation / slides',
    signals: [
      { re: /\bpresent(?:ation)?\b/, w: 4 }, { re: /\bslides?\b/, w: 3 },
      { re: /\bdeck\b/, w: 3 }, { re: /\bpowerpoint\b/, w: 3 },
      { re: /\bppt\b/, w: 3 }, { re: /\bpitch\b/, w: 2 },
      { re: /\bspeech\b/, w: 2 }, { re: /\btalk\b/, w: 1 },
      { re: /\bposter\b/, w: 2 },
    ],
  },
  reading: {
    label: 'Reading',
    signals: [
      { re: /\bread(?:ing)?\b/, w: 3 }, { re: /\bchapter\b/, w: 3 },
      { re: /\bpages?\b/, w: 2 }, { re: /\bnovel\b/, w: 3 },
      { re: /\btextbook\b/, w: 2 }, { re: /\barticle\b/, w: 1 },
      { re: /\bannotate\b/, w: 2 }, { re: /\bpaper\b/, w: 1 },
    ],
  },
  revision: {
    label: 'Revision / exam prep',
    signals: [
      { re: /\brevis/, w: 4 }, { re: /\brevision\b/, w: 4 },
      { re: /\bexam\b/, w: 3 }, { re: /\btest\b/, w: 2 },
      { re: /\bquiz\b/, w: 2 }, { re: /\bstudy for\b/, w: 3 },
      { re: /\bprep(?:are)?\b/, w: 1 }, { re: /\bpast papers?\b/, w: 3 },
      { re: /\bmidterm\b/, w: 3 }, { re: /\bfinals?\b/, w: 2 },
    ],
  },
  memorization: {
    label: 'Memorization',
    signals: [
      { re: /\bmemoris|memoriz/, w: 4 }, { re: /\bflashcards?\b/, w: 3 },
      { re: /\blearn by heart\b/, w: 4 }, { re: /\bvocab(?:ulary)?\b/, w: 3 },
      { re: /\bformulae?\b/, w: 2 }, { re: /\bdefinitions?\b/, w: 2 },
      { re: /\brecite\b/, w: 3 },
    ],
  },
  project: {
    label: 'Project',
    signals: [
      { re: /\bproject\b/, w: 4 }, { re: /\bbuild\b/, w: 1 },
      { re: /\bdesign\b/, w: 1 }, { re: /\bportfolio\b/, w: 2 },
      { re: /\bmodel\b/, w: 1 }, { re: /\bprototype\b/, w: 2 },
      { re: /\bgroup project\b/, w: 4 },
    ],
  },
};

const TIE_BREAK_ORDER: QuestIntent[] = [
  'lab_report', 'problem_set', 'coding', 'presentation',
  'revision', 'memorization', 'reading', 'essay', 'project', 'generic',
];

/** Classify the task text into an intent with a rough confidence score. */
export function classifyIntent(text: string): { intent: QuestIntent; confidence: number } {
  const hay = ` ${text.toLowerCase()} `;
  let best: QuestIntent = 'generic';
  let bestScore = 0;
  let total = 0;

  (Object.keys(INTENT_SPECS) as Exclude<QuestIntent, 'generic'>[]).forEach(intent => {
    let score = 0;
    for (const sig of INTENT_SPECS[intent].signals) {
      if (sig.re.test(hay)) score += sig.w;
    }
    total += score;
    const beatsBest =
      score > bestScore ||
      (score === bestScore && score > 0 &&
        TIE_BREAK_ORDER.indexOf(intent) < TIE_BREAK_ORDER.indexOf(best));
    if (beatsBest) { bestScore = score; best = intent; }
  });

  if (bestScore === 0) return { intent: 'generic', confidence: 0.3 };
  const confidence = Math.min(1, Math.max(0.5, bestScore / Math.max(total, bestScore)));
  return { intent: best, confidence: Number(confidence.toFixed(2)) };
}

/** Step templates per intent. */
type StepTemplate = (ctx: { difficulty: TaskDifficulty; subject?: string }) => Array<[string, number]>;

const harder = (d: TaskDifficulty) => d === 'hard';
const subj = (s?: string) => (s ? ` (${s})` : '');

const TEMPLATES: Record<QuestIntent, StepTemplate> = {
  essay: ({ difficulty }) => [
    ['Read the prompt and underline exactly what is being asked', 5],
    ['Brain-dump every idea/argument you already have — no filtering', 10],
    ...(harder(difficulty) ? [['Gather 3–5 sources and note one quote from each', 25] as [string, number]] : []),
    ['Write a one-line thesis / main argument', 8],
    ['Outline: intro, ' + (harder(difficulty) ? '4–5' : '2–3') + ' body points, conclusion', 12],
    ['Draft the body paragraphs (skip the intro for now)', harder(difficulty) ? 60 : 35],
    ['Write the intro and conclusion last', 15],
    ['Re-read once for argument flow, once for grammar', 15],
  ],
  problem_set: ({ difficulty }) => [
    ['Skim all questions and tag each easy / medium / hard', 5],
    ['Do every easy question first to build momentum', 15],
    ['Re-read your notes/formulas for the hard ones', 10],
    ['Work the medium questions', harder(difficulty) ? 35 : 25],
    ['Attempt the hard questions; mark anything you get stuck on', harder(difficulty) ? 40 : 25],
    ['Check answers and redo every one you got wrong', 15],
  ],
  reading: ({ difficulty }) => [
    ['Preview headings, intro, and summary before reading', 5],
    ['Read the first section and write a one-sentence summary', 15],
    ['Continue section by section, summarising each in a line', harder(difficulty) ? 45 : 30],
    ['Note any terms or ideas you did not understand', 8],
    ['Write a 3-bullet takeaway for the whole reading', 10],
  ],
  lab_report: ({ difficulty }) => [
    ['Write the aim/hypothesis in one sentence', 5],
    ['List apparatus and the method as numbered steps', 12],
    ['Put your raw data into a clean table', 15],
    ['Do the calculations / plot the graph', harder(difficulty) ? 35 : 20],
    ['Write the results and what they mean', 20],
    ['Write a discussion: errors, improvements, conclusion', 20],
  ],
  presentation: ({ difficulty }) => [
    ['Decide the single message the audience should remember', 8],
    ['Outline the slides (1 idea per slide)', 12],
    ['Build the slides — visuals first, minimal text', harder(difficulty) ? 50 : 35],
    ['Write speaker notes for each slide', 20],
    ['Rehearse out loud once, end to end', 15],
  ],
  revision: ({ difficulty, subject }) => [
    ['List every topic on the syllabus' + subj(subject), 8],
    ['Rate each topic red / amber / green by confidence', 8],
    ['Start with one red topic: re-learn it from notes', 25],
    ['Do active recall — close notes and write what you remember', 15],
    ['Practice past-paper questions on that topic', harder(difficulty) ? 40 : 25],
    ['Mark your answers and log mistakes to revisit', 12],
  ],
  coding: ({ difficulty }) => [
    ['Restate the problem and the expected input/output', 8],
    ['Write the approach in plain English / pseudocode', 12],
    ['Implement the smallest piece that runs', harder(difficulty) ? 45 : 25],
    ['Test with one simple case, then edge cases', 20],
    ['Debug failures one at a time', harder(difficulty) ? 35 : 20],
    ['Clean up and add a comment on how it works', 12],
  ],
  project: ({ difficulty }) => [
    ['Write the goal and definition of "done" in 2 lines', 8],
    ['Break the project into 3–6 milestones', 15],
    ['Pick the first milestone and list its concrete tasks', 12],
    ['Do the first task now', harder(difficulty) ? 45 : 30],
    ['Schedule the remaining milestones across your calendar', 12],
  ],
  memorization: () => [
    ['Split the material into small chunks (5–10 items each)', 8],
    ['Make flashcards or a question/answer list for chunk 1', 15],
    ['Test yourself on chunk 1 until 100% recall', 15],
    ['Add the next chunk and review all previous ones', 20],
    ['Space it out: review again tonight and tomorrow', 5],
  ],
  generic: ({ difficulty }) => [
    ['Write down what "finished" looks like for this task', 5],
    ['Break it into 3 smaller, concrete sub-tasks', 8],
    ['Do the easiest sub-task first to build momentum', harder(difficulty) ? 30 : 20],
    ['Do the remaining sub-tasks one at a time', harder(difficulty) ? 40 : 25],
    ['Quick review: is anything missing before you call it done?', 8],
  ],
};

const INTENT_LABELS: Record<QuestIntent, string> = {
  essay: 'Essay / writing',
  problem_set: 'Problem set',
  reading: 'Reading',
  lab_report: 'Lab report / experiment',
  presentation: 'Presentation / slides',
  revision: 'Revision / exam prep',
  coding: 'Coding / build',
  project: 'Project',
  memorization: 'Memorization',
  generic: 'General task',
};

/**
 * Main entry point: produce an ordered quest breakdown for a task.
 * Deterministic — same input always yields the same steps.
 */
export function breakdownTask(input: BreakdownInput): QuestBreakdown {
  const difficulty: TaskDifficulty = input.priority ?? 'medium';
  const text = `${input.title} ${input.description ?? ''} ${input.subject ?? ''}`.trim();

  let intent: QuestIntent;
  let confidence: number;
  if (input.intent) {
    intent = input.intent;
    confidence = 1;
  } else {
    const c = classifyIntent(text);
    intent = c.intent;
    confidence = c.confidence;
  }

  const raw = TEMPLATES[intent]({ difficulty, subject: input.subject });

  const steps: QuestStep[] = raw.map(([label, estMinutes], i) => ({
    id: `s${i}`,
    label,
    estMinutes,
    ...(i === 0 ? { isStarter: true } : {}),
  }));

  const totalEstMinutes = steps.reduce((a, s) => a + s.estMinutes, 0);

  return {
    intent,
    intentLabel: INTENT_LABELS[intent],
    confidence,
    steps,
    totalEstMinutes,
  };
}

/** Convenience for UI: "1h 25m" from minutes. */
export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
