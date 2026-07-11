/**
 * On-device quest-breakdown model — a Transformers.js wrapper around the
 * purpose-trained flan-t5-small fine-tuned in ml/ (see ml/README.md).
 *
 * Fully private, fully local: once downloaded (one-time, cached by the
 * browser), no task data ever leaves the device. Every public function here
 * returns `null` on ANY failure — unsupported browser, load failure,
 * timeout, or output that fails validation — so callers (QuestBreakdown.tsx)
 * have one simple contract: null means "fall back to the rule engine"
 * (src/lib/questBreakdown.ts), which never goes away and always works.
 *
 * The prefixed-input format (formatInput below) and the output validators
 * are deliberate 1:1 ports of ml/schema.py's format_input()/validate_*() —
 * training, evaluation, and this runtime must agree on the exact same
 * contract. If you change one, change all three.
 */

import type { QuestIntent, TaskDifficulty } from '@/lib/questBreakdown';

// TODO: point at the real hosted model once ml/convert_to_onnx.py has been
// run against a full GPU training run and the result uploaded to the HF Hub
// (or served from public/models/ — see ml/README.md "Phase 5: hosting").
// Until then this id won't resolve, loadPipeline() will fail, and every
// public function below correctly (and silently) falls back to the rule
// engine — the mechanism is real and tested, only the weights are pending.
const MODEL_ID = 'zenith-app/quest-breakdown-flan-t5-small';

const LOAD_TIMEOUT_MS = 60_000;
const GENERATION_TIMEOUT_MS = 20_000;
const MAX_NEW_TOKENS = 256;

const ENABLED_KEY = 'zenith.onDeviceAssistant.enabled';

export type ModelStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

export interface ModelTaskJson {
  title: string;
  description: string | null;
  subject: string | null;
  intent: QuestIntent | null;
  priority: TaskDifficulty;
  deadline: string | null;
  tags: string[];
}

export interface ClarifyQuestion {
  question: string;
  targetStepIndex: number;
  targetStepText: string;
}

export interface Answer {
  question: string;
  answer: string;
}

// ───────────────────────── enable/disable preference ─────────────────────────

/** Device-local (not cloud-synced — the download itself is per-browser anyway). */
export function isOnDeviceAssistantEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
}

export function setOnDeviceAssistantEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // ignore — falls back to disabled next load
  }
  if (!enabled) resetPipeline();
}

// ───────────────────────── status (for a "thinking…"/progress UI) ─────────────────────────

let status: ModelStatus = 'idle';
let loadProgress = 0;
const listeners = new Set<(status: ModelStatus, progress: number) => void>();

function setStatus(next: ModelStatus, progress = loadProgress) {
  status = next;
  loadProgress = progress;
  listeners.forEach((l) => l(status, loadProgress));
}

export function getModelStatus(): { status: ModelStatus; progress: number } {
  return { status, progress: loadProgress };
}

export function subscribeModelStatus(cb: (status: ModelStatus, progress: number) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ───────────────────────── pipeline loading ─────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pipe = (input: string, opts?: Record<string, unknown>) => Promise<any>;

let pipelinePromise: Promise<Pipe> | null = null;

function browserSupportsInference(): boolean {
  return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';
}

async function pickDevice(): Promise<'webgpu' | 'wasm'> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gpu = (navigator as any).gpu;
    if (gpu) {
      const adapter = await gpu.requestAdapter();
      if (adapter) return 'webgpu';
    }
  } catch {
    // fall through to wasm
  }
  return 'wasm';
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

async function loadPipeline(): Promise<Pipe> {
  if (pipelinePromise) return pipelinePromise;
  if (!browserSupportsInference()) {
    setStatus('unavailable');
    return Promise.reject(new Error('unsupported browser'));
  }

  setStatus('loading', 0);
  pipelinePromise = (async () => {
    const { pipeline } = await import('@huggingface/transformers');
    const device = await pickDevice();
    const pipe = await pipeline('text2text-generation', MODEL_ID, {
      device,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      progress_callback: (info: any) => {
        if (typeof info?.progress === 'number') setStatus('loading', Math.round(info.progress));
      },
    });
    setStatus('ready', 100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return pipe as unknown as Pipe;
  })();

  pipelinePromise.catch(() => {
    setStatus('unavailable');
    pipelinePromise = null;
  });

  return withTimeout(pipelinePromise, LOAD_TIMEOUT_MS, 'model load timed out');
}

/** Drops the loaded pipeline (e.g. the user disabled the assistant in Settings). */
export function resetPipeline(): void {
  pipelinePromise = null;
  setStatus('idle', 0);
}

async function runGeneration(inputText: string): Promise<string> {
  const pipe = await loadPipeline();
  const out = await withTimeout(
    pipe(inputText, { max_new_tokens: MAX_NEW_TOKENS }),
    GENERATION_TIMEOUT_MS,
    'generation timed out',
  );
  const first = Array.isArray(out) ? out[0] : out;
  const text = first?.generated_text ?? first?.text ?? '';
  return typeof text === 'string' ? text : '';
}

// ───────────────────────── prefixed input formatting (mirrors ml/schema.py) ─────────────────────────

function dumpsCompact(value: unknown): string {
  return JSON.stringify(value);
}

export function formatInput(
  taskType: 'breakdown' | 'clarify' | 'refine',
  task: ModelTaskJson,
  steps?: string[],
  answers?: Answer[],
): string {
  let text = `${taskType}: ${dumpsCompact(task)}`;
  if (steps !== undefined) text += ` steps: ${dumpsCompact(steps)}`;
  if (answers !== undefined) text += ` answers: ${dumpsCompact(answers)}`;
  return text;
}

// ───────────────────────── output validation (mirrors ml/schema.py) ─────────────────────────

const MIN_STEPS = 3;
const MAX_STEPS = 8;
const MAX_QUESTIONS = 3;

// Deliberately strict, 1:1 with ml/schema.py's _GENERIC_STEP_RE — filler
// phrasing the model must never emit as a "concrete" step.
const GENERIC_STEP_RE =
  /^(research( it| this| the topic)?|review (your |the )?notes|do (the|your|some) work|work on (it|this|the task)|complete the task|finish (it|the work)|study|get started|plan ahead|think about it|write the (essay|report|paper|code)|do (some|the) research|read (about it|more)|prepare|practice)\.?$/i;

export function isGenericStep(step: string): boolean {
  const s = step.trim();
  if (s.split(/\s+/).filter(Boolean).length < 3) return true;
  return GENERIC_STEP_RE.test(s);
}

export function parseBreakdownOutput(raw: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  if (parsed.length < MIN_STEPS || parsed.length > MAX_STEPS) return null;
  for (const s of parsed) {
    if (typeof s !== 'string' || !s.trim()) return null;
    if (isGenericStep(s)) return null;
  }
  const steps = parsed as string[];
  const uniq = new Set(steps.map((s) => s.trim().toLowerCase()));
  if (uniq.size !== steps.length) return null;
  return steps;
}

export function parseClarifyOutput(raw: string, steps: string[]): ClarifyQuestion[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  if (parsed.length > MAX_QUESTIONS) return null;
  for (const q of parsed) {
    if (!q || typeof q !== 'object') return null;
    const question = (q as Record<string, unknown>).question;
    const targetStepIndex = (q as Record<string, unknown>).targetStepIndex;
    const targetStepText = (q as Record<string, unknown>).targetStepText;
    if (typeof question !== 'string' || !question.trim()) return null;
    if (typeof targetStepIndex !== 'number' || targetStepIndex < 0 || targetStepIndex >= steps.length) return null;
    if (targetStepText !== steps[targetStepIndex]) return null;
  }
  return parsed as ClarifyQuestion[];
}

export function parseRefineOutput(raw: string, oldSteps: string[], answers: Answer[]): string[] | null {
  const steps = parseBreakdownOutput(raw);
  if (!steps) return null;

  const identical =
    steps.length === oldSteps.length &&
    steps.every((s, i) => s.trim().toLowerCase() === oldSteps[i].trim().toLowerCase());
  if (identical) return null;

  if (answers.length > 0) {
    const joined = steps.join(' ').toLowerCase();
    const answerReflected = answers.some(
      (a) => a.answer && a.answer.split(/\s+/).some((tok) => tok.length > 3 && joined.includes(tok.toLowerCase())),
    );
    if (!answerReflected) return null;
  }
  return steps;
}

// ───────────────────────── public API ─────────────────────────

export async function breakdown(task: ModelTaskJson): Promise<string[] | null> {
  if (!isOnDeviceAssistantEnabled()) return null;
  try {
    const raw = await runGeneration(formatInput('breakdown', task));
    return parseBreakdownOutput(raw);
  } catch {
    return null;
  }
}

export async function clarify(task: ModelTaskJson, steps: string[]): Promise<ClarifyQuestion[] | null> {
  if (!isOnDeviceAssistantEnabled()) return null;
  try {
    const raw = await runGeneration(formatInput('clarify', task, steps));
    return parseClarifyOutput(raw, steps);
  } catch {
    return null;
  }
}

export async function refine(task: ModelTaskJson, steps: string[], answers: Answer[]): Promise<string[] | null> {
  if (!isOnDeviceAssistantEnabled()) return null;
  try {
    const raw = await runGeneration(formatInput('refine', task, steps, answers));
    return parseRefineOutput(raw, steps, answers);
  } catch {
    return null;
  }
}
