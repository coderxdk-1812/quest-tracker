/**
 * Local Quest Breakdown engine — turns a task into an ordered list of small sub-steps.
 *
 * 100% local & deterministic. No API, no keys, no paid plans. It now reads ALL the
 * context the user provides — title, notes/description, subject, tags and deadline —
 * to classify the task and tailor the steps (length, item counts, urgency, group work).
 *
 * If fuzzier free-text understanding is ever needed, `classifyIntent` can be swapped for
 * a local transformers.js classifier without changing callers.
 */

export type QuestIntent =
  | 'essay' | 'problem_set' | 'reading' | 'lab_report' | 'presentation'
  | 'revision' | 'coding' | 'project' | 'memorization' | 'generic';

export type TaskDifficulty = 'easy' | 'medium' | 'hard';

/** Structured answers to clarifyingQuestions, keyed by each question's `key` (see QUESTIONS). */
export type SlotAnswers = Record<string, string>;

export interface BreakdownInput {
  title: string;
  description?: string;
  subject?: string;
  priority?: TaskDifficulty;
  /** ISO string — used to gauge urgency and tailor the steps. */
  deadline?: string;
  /** Tags add context (e.g. "group-project", "exam"). */
  tags?: string[];
  /** Extra free-text context (kept for classification/signal-extraction fallback). */
  context?: string;
  /** Structured answers to clarifying questions — these are injected directly into step labels. */
  answers?: SlotAnswers;
  /** Optional override; if omitted the engine classifies from the combined text. */
  intent?: QuestIntent;
  /** Injectable clock for testing. */
  now?: number;
}

export interface QuestStep {
  id: string;
  label: string;
  estMinutes: number;
  isStarter?: boolean;
}

export interface QuestBreakdown {
  intent: QuestIntent;
  intentLabel: string;
  confidence: number;
  steps: QuestStep[];
  totalEstMinutes: number;
}

interface IntentSpec {
  label: string;
  signals: { re: RegExp; w: number }[];
}

const INTENT_SPECS: Record<Exclude<QuestIntent, 'generic'>, IntentSpec> = {
  lab_report: {
    label: 'Lab report / experiment',
    signals: [
      { re: /\blab\b/, w: 3 }, { re: /\bpractical\b/, w: 3 }, { re: /\bexperiment\b/, w: 3 },
      { re: /\bhypothesis\b/, w: 2 }, { re: /\bmethod(?:ology)?\b/, w: 1 }, { re: /\bresults?\b/, w: 1 },
      { re: /\bobservations?\b/, w: 2 }, { re: /\btitration\b/, w: 3 },
    ],
  },
  problem_set: {
    label: 'Problem set',
    signals: [
      { re: /\bproblem set\b/, w: 4 }, { re: /\bp-?set\b/, w: 4 }, { re: /\bproblems?\b/, w: 2 },
      { re: /\bexercises?\b/, w: 2 }, { re: /\bquestions?\b/, w: 1 }, { re: /\bworksheet\b/, w: 3 },
      { re: /\bequations?\b/, w: 2 }, { re: /\bsums?\b/, w: 2 }, { re: /\bcalcul/, w: 2 },
      { re: /\bderivativ/, w: 2 }, { re: /\bintegrat/, w: 2 }, { re: /\bmaths?\b/, w: 1 },
    ],
  },
  coding: {
    label: 'Coding / build',
    signals: [
      { re: /\bcode\b/, w: 3 }, { re: /\bcoding\b/, w: 3 }, { re: /\bprogram(?:ming)?\b/, w: 3 },
      { re: /\bdebug\b/, w: 3 }, { re: /\bfunction\b/, w: 2 }, { re: /\balgorithm\b/, w: 2 },
      { re: /\bapp\b/, w: 2 }, { re: /\bwebsite\b/, w: 2 }, { re: /\bscript\b/, w: 2 },
      { re: /\bapi\b/, w: 2 }, { re: /\bpython\b/, w: 3 }, { re: /\bjava(?:script)?\b/, w: 3 },
      { re: /\bleetcode\b/, w: 4 }, { re: /\bbug\b/, w: 2 },
    ],
  },
  essay: {
    label: 'Essay / writing',
    signals: [
      { re: /\bessay\b/, w: 4 }, { re: /\bwrite\b/, w: 2 }, { re: /\bwriting\b/, w: 2 },
      { re: /\bcomposition\b/, w: 3 }, { re: /\barticle\b/, w: 2 }, { re: /\bparagraph\b/, w: 2 },
      { re: /\bdissertation\b/, w: 3 }, { re: /\breport\b/, w: 1 }, { re: /\bthesis\b/, w: 2 },
      { re: /\bblog\b/, w: 2 }, { re: /\breview\b/, w: 1 }, { re: /\bletter\b/, w: 2 },
    ],
  },
  presentation: {
    label: 'Presentation / slides',
    signals: [
      { re: /\bpresent(?:ation)?\b/, w: 4 }, { re: /\bslides?\b/, w: 3 }, { re: /\bdeck\b/, w: 3 },
      { re: /\bpowerpoint\b/, w: 3 }, { re: /\bppt\b/, w: 3 }, { re: /\bpitch\b/, w: 2 },
      { re: /\bspeech\b/, w: 2 }, { re: /\btalk\b/, w: 1 }, { re: /\bposter\b/, w: 2 },
    ],
  },
  reading: {
    label: 'Reading',
    signals: [
      { re: /\bread(?:ing)?\b/, w: 3 }, { re: /\bchapter\b/, w: 3 }, { re: /\bpages?\b/, w: 2 },
      { re: /\bnovel\b/, w: 3 }, { re: /\btextbook\b/, w: 2 }, { re: /\barticle\b/, w: 1 },
      { re: /\bannotate\b/, w: 2 }, { re: /\bpaper\b/, w: 1 },
    ],
  },
  revision: {
    label: 'Revision / exam prep',
    signals: [
      { re: /\brevis/, w: 4 }, { re: /\bexam\b/, w: 3 }, { re: /\btest\b/, w: 2 },
      { re: /\bquiz\b/, w: 2 }, { re: /\bstudy for\b/, w: 3 }, { re: /\bprep(?:are)?\b/, w: 1 },
      { re: /\bpast papers?\b/, w: 3 }, { re: /\bmidterm\b/, w: 3 }, { re: /\bfinals?\b/, w: 2 },
    ],
  },
  memorization: {
    label: 'Memorization',
    signals: [
      { re: /\bmemoris|memoriz/, w: 4 }, { re: /\bflashcards?\b/, w: 3 }, { re: /\blearn by heart\b/, w: 4 },
      { re: /\bvocab(?:ulary)?\b/, w: 3 }, { re: /\bformulae?\b/, w: 2 }, { re: /\bdefinitions?\b/, w: 2 },
      { re: /\brecite\b/, w: 3 },
    ],
  },
  project: {
    label: 'Project',
    signals: [
      { re: /\bproject\b/, w: 4 }, { re: /\bbuild\b/, w: 1 }, { re: /\bdesign\b/, w: 1 },
      { re: /\bportfolio\b/, w: 2 }, { re: /\bmodel\b/, w: 1 }, { re: /\bprototype\b/, w: 2 },
      { re: /\bgroup project\b/, w: 4 },
    ],
  },
};

const TIE_BREAK_ORDER: QuestIntent[] = [
  'lab_report', 'problem_set', 'coding', 'presentation',
  'revision', 'memorization', 'reading', 'essay', 'project', 'generic',
];

export function classifyIntent(text: string): { intent: QuestIntent; confidence: number } {
  const hay = ` ${text.toLowerCase()} `;
  let best: QuestIntent = 'generic';
  let bestScore = 0;
  let total = 0;
  (Object.keys(INTENT_SPECS) as Exclude<QuestIntent, 'generic'>[]).forEach(intent => {
    let score = 0;
    for (const sig of INTENT_SPECS[intent].signals) if (sig.re.test(hay)) score += sig.w;
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

/* ───────────────── context signal extraction ───────────────── */

export type Urgency = 'urgent' | 'soon' | 'normal' | 'far' | 'none';

export interface Signals {
  wordCount?: number;
  itemCount?: number;   // questions / problems
  pages?: number;
  chapters?: number;
  slides?: number;
  minutes?: number;
  isGroup: boolean;
  urgency: Urgency;
  hoursLeft?: number;
}

function firstInt(re: RegExp, s: string): number | undefined {
  const m = s.match(re);
  return m ? parseInt(m[1], 10) : undefined;
}

/** Pulls the first integer out of a free-text slot answer, e.g. "about 20" -> 20. */
function parseNum(s?: string): number | undefined {
  if (!s) return undefined;
  const m = s.match(/\d{1,6}/);
  return m ? parseInt(m[0], 10) : undefined;
}

export function extractSignals(text: string, deadline?: string, now: number = Date.now()): Signals {
  const s = text.toLowerCase();
  let urgency: Urgency = 'none';
  let hoursLeft: number | undefined;
  if (deadline) {
    const t = Date.parse(deadline);
    if (!Number.isNaN(t)) {
      hoursLeft = (t - now) / 3_600_000;
      urgency = hoursLeft <= 24 ? 'urgent' : hoursLeft <= 72 ? 'soon' : hoursLeft >= 240 ? 'far' : 'normal';
    }
  }
  return {
    wordCount: firstInt(/(\d{2,5})\s*words?/, s),
    itemCount: firstInt(/(\d{1,3})\s*(?:questions?|problems?|exercises?|sums?|qs)\b/, s)
      ?? firstInt(/\bq?\s*1\s*[-–to]+\s*(\d{1,3})\b/, s),
    pages: firstInt(/(\d{1,4})\s*pages?/, s),
    chapters: firstInt(/chapter\s*(\d{1,3})/, s) ?? firstInt(/(\d{1,2})\s*chapters?/, s),
    slides: firstInt(/(\d{1,3})\s*slides?/, s),
    minutes: firstInt(/(\d{1,3})\s*(?:min|minute)/, s),
    isGroup: /\bgroup\b|\bteam\b|\bpartner/.test(s),
    urgency,
    hoursLeft,
  };
}

/* ───────────────── step templates ───────────────── */

type Pair = [string, number];
type StepTemplate = (ctx: { difficulty: TaskDifficulty; subject?: string }) => Pair[];
const harder = (d: TaskDifficulty) => d === 'hard';
const subj = (s?: string) => (s ? ` (${s})` : '');

const TEMPLATES: Record<QuestIntent, StepTemplate> = {
  essay: ({ difficulty }) => [
    ['Read the prompt and underline exactly what is being asked', 5],
    ['Brain-dump every idea/argument you already have — no filtering', 10],
    ...(harder(difficulty) ? [['Gather 3–5 sources and note one quote from each', 25] as Pair] : []),
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
  essay: 'Essay / writing', problem_set: 'Problem set', reading: 'Reading',
  lab_report: 'Lab report / experiment', presentation: 'Presentation / slides',
  revision: 'Revision / exam prep', coding: 'Coding / build', project: 'Project',
  memorization: 'Memorization', generic: 'General task',
};

/* ───────────────── context-aware modifiers ───────────────── */

function applyModifiers(base: Pair[], intent: QuestIntent, sig: Signals, answers: SlotAnswers = {}): Pair[] {
  let steps = base.map(p => [...p] as Pair);
  const get = (k: string): string | undefined => answers[k]?.trim() || undefined;
  const map = (pred: (l: string) => boolean, next: (l: string) => string) =>
    (steps = steps.map(([l, e]) => (pred(l) ? [next(l), e] as Pair : [l, e])));

  // Length / count aware tailoring of specific steps. Structured slot answers
  // (from the clarify panel) take priority over signals parsed from free text.
  if (intent === 'essay') {
    const topic = get('topic');
    const thesisStatus = get('thesisStatus');
    const wordCount = parseNum(get('wordCount')) ?? sig.wordCount;
    if (wordCount) {
      const per = Math.max(80, Math.round(wordCount / 4 / 10) * 10);
      map(l => l.startsWith('Draft the body'),
        () => `Draft the body paragraphs (~${wordCount} words total, ~${per} per paragraph)`);
    }
    if (topic || thesisStatus) {
      map(l => l.startsWith('Write a one-line thesis'), () => {
        if (topic && thesisStatus) return `Draft a thesis about ${topic} (${thesisStatus})`;
        if (topic) return `Draft a thesis about ${topic}`;
        return `Write a one-line thesis / main argument — ${thesisStatus}`;
      });
    }
    if (topic) map(l => l.startsWith('Outline:'),
      l => `Outline on ${topic}: ${l.slice('Outline:'.length).trim()}`);
  }

  if (intent === 'problem_set') {
    const topic = get('topic');
    const count = parseNum(get('count')) ?? sig.itemCount;
    if (count) {
      map(l => l.startsWith('Skim all'),
        () => `Skim all ${count}${topic ? ` ${topic}` : ''} questions and tag each easy / medium / hard`);
    } else if (topic) {
      map(l => l.startsWith('Skim all'), () => `Skim all the ${topic} questions and tag each easy / medium / hard`);
    }
    if (topic) map(l => l.startsWith('Attempt the hard'),
      () => `Do the hardest ${topic} problems first; mark anything you get stuck on`);
  }

  if (intent === 'reading') {
    const pagesOrChapter = get('pagesOrChapter');
    const ref = pagesOrChapter ?? (sig.chapters ? `chapter ${sig.chapters}` : sig.pages ? `${sig.pages} pages` : '');
    if (ref) map(l => l.startsWith('Preview'), () => `Preview ${ref}: headings, intro and summary first`);
    const mode = get('mode');
    if (mode && /annotat/i.test(mode)) map(l => l.startsWith('Note any terms'),
      () => 'Annotate as you go — note terms/ideas you did not understand');
  }

  if (intent === 'lab_report') {
    const dataStatus = get('dataStatus');
    const sections = get('sections');
    if (dataStatus && /\b(no|not yet|haven'?t|need to)\b/i.test(dataStatus)) {
      steps.unshift(['Collect/finish your raw data first', 20]);
    }
    if (sections) map(l => l.startsWith('Write the results'), () => `Write up the required sections (${sections})`);
  }

  if (intent === 'presentation') {
    const audience = get('audience');
    const minutes = parseNum(get('minutes')) ?? sig.minutes;
    const slides = parseNum(get('slides')) ?? sig.slides;
    if (slides) map(l => l.startsWith('Outline the slides'), () => `Outline ${slides} slides (1 idea per slide)`);
    if (audience) map(l => l.startsWith('Decide the single message'),
      () => `Decide the single message ${audience} should remember`);
    if (audience || minutes) {
      map(l => l.startsWith('Rehearse out loud'), () => {
        if (audience && minutes) return `Rehearse aloud for ${audience} to fit ~${minutes} min`;
        if (audience) return `Rehearse aloud for ${audience}, end to end`;
        return `Rehearse aloud to fit ~${minutes} min`;
      });
    }
  }

  if (intent === 'coding') {
    const language = get('language');
    const mode = get('mode');
    if (language) map(l => l.startsWith('Implement the smallest piece'),
      () => `Scaffold the ${language} project, then implement the smallest piece that runs`);
    if (mode && /debug|fix|bug|existing/i.test(mode)) {
      map(l => l.startsWith('Restate the problem'), () => 'Restate the bug and the expected vs. actual behaviour');
    }
  }

  if (intent === 'revision') {
    const weakTopics = get('weakTopics');
    if (weakTopics) {
      map(l => l.startsWith('Start with one red topic'), () => `Focus revision on ${weakTopics}: re-learn from notes`);
      map(l => l.startsWith('Practice past-paper'), () => `Practice past-paper questions on ${weakTopics}`);
    }
  }

  if (intent === 'project') {
    const deliverable = get('deliverable');
    if (deliverable) map(l => l.startsWith('Write the goal'), () => `Write the goal: ${deliverable}`);
  }

  if (intent === 'memorization') {
    const itemCount = parseNum(get('itemCount'));
    if (itemCount) map(l => l.startsWith('Split the material'),
      () => `Split the ${itemCount} items into small chunks (5–10 items each)`);
  }

  if (intent === 'generic') {
    const doneLooksLike = get('doneLooksLike');
    const firstPiece = get('firstPiece');
    if (doneLooksLike) map(l => l.startsWith('Write down what'), () => `Finished looks like: ${doneLooksLike}`);
    if (firstPiece) map(l => l.startsWith('Do the easiest sub-task'), () => `Start with: ${firstPiece}`);
  }

  // Group work → add a coordination step early. A "group vs solo" slot answer
  // (e.g. on projects) overrides the free-text signal when both are present.
  const groupOrSolo = get('groupOrSolo');
  const isGroup = groupOrSolo ? /group|team|partner/i.test(groupOrSolo) : sig.isGroup;
  if (isGroup) steps.splice(1, 0, ['Agree who does what with your group, and a check-in time', 10]);

  // Deadline awareness.
  if (sig.urgency === 'urgent') {
    const h = sig.hoursLeft && sig.hoursLeft > 0 ? `~${Math.ceil(sig.hoursLeft)}h` : 'little time';
    steps.unshift([`You have ${h} left — list what is essential vs optional and do essentials first`, 5]);
  } else if (sig.urgency === 'far' && (intent === 'essay' || intent === 'project' || intent === 'revision' || intent === 'lab_report')) {
    steps.push(['Spread the remaining steps across the days before your deadline', 8]);
  }

  return steps;
}

/* ───────────────── main entry ───────────────── */

function combinedText(input: BreakdownInput): string {
  const answerText = input.answers ? Object.values(input.answers).filter(Boolean).join(' ') : '';
  return [input.title, input.description, input.subject, (input.tags || []).join(' '), input.context, answerText]
    .filter(Boolean).join(' ').trim();
}

export function breakdownTask(input: BreakdownInput): QuestBreakdown {
  const difficulty: TaskDifficulty = input.priority ?? 'medium';
  const text = combinedText(input);

  let intent: QuestIntent;
  let confidence: number;
  if (input.intent) { intent = input.intent; confidence = 1; }
  else { const c = classifyIntent(text); intent = c.intent; confidence = c.confidence; }

  const sig = extractSignals(text, input.deadline, input.now);
  const base = TEMPLATES[intent]({ difficulty, subject: input.subject });
  const tailored = applyModifiers(base, intent, sig, input.answers);

  const steps: QuestStep[] = tailored.map(([label, estMinutes], i) => ({
    id: `s${i}`, label, estMinutes, ...(i === 0 ? { isStarter: true } : {}),
  }));

  return {
    intent,
    intentLabel: INTENT_LABELS[intent],
    confidence,
    steps,
    totalEstMinutes: steps.reduce((a, s) => a + s.estMinutes, 0),
  };
}

/* ───────────────── clarifying questions (for "regenerate") ───────────────── */

/**
 * A clarifying question tied to a "slot" — a specific piece of missing info
 * that, once answered, is injected verbatim into the matching step label(s)
 * in applyModifiers (see the `answers[key]` lookups above). `key` is the
 * property the answer is stored under in SlotAnswers.
 */
export interface QuestionSlot {
  key: string;
  question: string;
  placeholder?: string;
}

const QUESTIONS: Record<QuestIntent, QuestionSlot[]> = {
  essay: [
    { key: 'topic', question: 'What is the essay about?', placeholder: 'e.g. causes of WW1' },
    { key: 'thesisStatus', question: 'Do you already have a thesis/argument, or need to form one?' },
    { key: 'wordCount', question: 'Roughly how many words?', placeholder: 'e.g. 1500' },
  ],
  problem_set: [
    { key: 'count', question: 'How many questions/problems?', placeholder: 'e.g. 20' },
    { key: 'topic', question: 'Which topic do they cover?', placeholder: 'e.g. quadratic equations' },
  ],
  reading: [
    { key: 'pagesOrChapter', question: 'How many pages or which chapter?', placeholder: 'e.g. chapter 4' },
    { key: 'mode', question: 'Do you need to annotate, or just read?' },
  ],
  lab_report: [
    { key: 'sections', question: 'Which sections are required (method, results, discussion)?' },
    { key: 'dataStatus', question: 'Is the data collected yet?' },
  ],
  presentation: [
    { key: 'audience', question: 'Who is the audience?', placeholder: 'e.g. the class, judges' },
    { key: 'minutes', question: 'How many minutes do you have?', placeholder: 'e.g. 5' },
    { key: 'slides', question: 'About how many slides?', placeholder: 'e.g. 10' },
  ],
  revision: [
    { key: 'weakTopics', question: 'Which topics feel weakest?', placeholder: 'e.g. trigonometry, redox reactions' },
  ],
  coding: [
    { key: 'language', question: 'Which language/tool?', placeholder: 'e.g. Python' },
    { key: 'mode', question: 'New build, or debugging existing code?' },
  ],
  project: [
    { key: 'deliverable', question: 'What does the finished project look like?' },
    { key: 'groupOrSolo', question: 'Working solo or in a group?' },
  ],
  memorization: [
    { key: 'itemCount', question: 'About how many items to memorise?', placeholder: 'e.g. 40' },
    { key: 'recallBy', question: 'By when do you need to recall them?' },
  ],
  generic: [
    { key: 'doneLooksLike', question: 'What does "done" look like for this?' },
    { key: 'firstPiece', question: 'What is the very first concrete piece?' },
  ],
};

/** Up to 3 targeted, slot-keyed questions to sharpen a regenerate. */
export function clarifyingQuestions(intent: QuestIntent): QuestionSlot[] {
  return QUESTIONS[intent] ?? QUESTIONS.generic;
}

export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
