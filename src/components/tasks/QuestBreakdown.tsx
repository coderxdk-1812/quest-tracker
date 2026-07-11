import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wand2, Trash2, Plus, RefreshCw, Play, CheckCircle2, Circle, Sparkles, HelpCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  breakdownTask, classifyIntent, clarifyingQuestions,
  type TaskDifficulty, type SlotAnswers, type QuestIntent,
} from '@/lib/questBreakdown';
import {
  breakdown as modelBreakdown, clarify as modelClarify, refine as modelRefine,
  isOnDeviceAssistantEnabled, subscribeModelStatus, getModelStatus,
  type ModelTaskJson, type ClarifyQuestion,
} from '@/lib/localModel';
import type { Subtask } from '@/context/GameContext';

/**
 * Controlled, editable subtask editor.
 * The parent owns the subtasks (so they save with the task); this component
 * generates, edits, deletes, clears, and regenerates them — and asks clarifying
 * questions when the task is too vague for specific steps.
 *
 * When the on-device assistant (src/lib/localModel.ts) is enabled, every
 * action tries it first: breakdown() for initial generation, clarify() to
 * find genuinely vague steps, refine() to sharpen using the user's answers.
 * Any failure there (unsupported browser, load failure, timeout, invalid
 * output) transparently falls back to the deterministic rule engine
 * (src/lib/questBreakdown.ts) — the UX is identical either way, just the
 * source of the steps differs.
 */
export interface QuestBreakdownProps {
  title: string;
  description?: string;
  subject?: string;
  priority?: TaskDifficulty;
  tags?: string[];
  deadline?: string;
  value: Subtask[];
  onChange: (subtasks: Subtask[]) => void;
  /** Optional: one-tap "Start" jumps into Focus Mode. Defaults to /focus. */
  onStartFocus?: () => void;
}

const uid = () =>
  (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : 's_' + Math.random().toString(36).slice(2);

const toSubtasks = (labels: string[]): Subtask[] => labels.map(label => ({ id: uid(), label, done: false }));

export function QuestBreakdown({
  title, description, subject, priority, tags, deadline,
  value, onChange, onStartFocus,
}: QuestBreakdownProps) {
  const navigate = useNavigate();
  const [clarifyOpen, setClarifyOpen] = useState(false);
  // Rule-engine mode: answers keyed by slot (see questBreakdown.ts's QuestionSlot).
  // Persisted across regenerates (not reset) so reopening the panel lets the
  // user add/adjust answers and sharpen further, rather than starting over.
  const [answers, setAnswers] = useState<SlotAnswers>({});
  // Model mode: the model's own targeted questions, and answers keyed by the
  // step index they target (stable-ish across regenerates, unlike array position).
  const [modelQuestions, setModelQuestions] = useState<ClarifyQuestion[] | null>(null);
  const [modelAnswers, setModelAnswers] = useState<Record<number, string>>({});
  const [usingModel, setUsingModel] = useState(false);

  const [thinking, setThinking] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState('Thinking…');
  const [justRegenerated, setJustRegenerated] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const combined = useMemo(
    () => [title, description, subject, (tags || []).join(' ')].filter(Boolean).join(' ').trim(),
    [title, description, subject, tags],
  );

  // Detect when there isn't enough context for specific steps (Tasks #6).
  const { intent, confidence } = useMemo(() => classifyIntent(combined), [combined]);
  const wordCount = combined ? combined.split(/\s+/).length : 0;
  const infoThin = wordCount < 4 || (intent === 'generic' && confidence < 0.5 && !description);

  const questions = useMemo(() => clarifyingQuestions(intent), [intent]);

  useEffect(() => {
    if (!justRegenerated) return;
    const t = setTimeout(() => setJustRegenerated(false), 1200);
    return () => clearTimeout(t);
  }, [justRegenerated]);

  // While thinking, surface download progress on first-ever model use rather
  // than a bare spinner — a multi-second wait needs more than "Thinking…".
  useEffect(() => {
    if (!thinking) return;
    const update = (status: string, progress: number) => {
      setThinkingLabel(status === 'loading' ? `Downloading on-device assistant… ${progress}%` : 'Thinking…');
    };
    const s = getModelStatus();
    update(s.status, s.progress);
    return subscribeModelStatus(update);
  }, [thinking]);

  const buildTaskJson = (lockedIntent?: QuestIntent): ModelTaskJson => ({
    title,
    description: description ?? null,
    subject: subject ?? null,
    intent: lockedIntent ?? intent,
    priority: priority ?? 'medium',
    deadline: deadline ?? null,
    tags: tags ?? [],
  });

  /** Fresh generation (empty state, or "Just regenerate") — model first, rule engine fallback. */
  const generate = async (structuredAnswers?: SlotAnswers, lockedIntent?: QuestIntent) => {
    if (isOnDeviceAssistantEnabled()) {
      setThinking(true);
      const modelSteps = await modelBreakdown(buildTaskJson(lockedIntent));
      setThinking(false);
      if (modelSteps) {
        onChange(toSubtasks(modelSteps));
        return;
      }
    }
    const r = breakdownTask({ title, description, subject, priority, tags, deadline, intent: lockedIntent, answers: structuredAnswers });
    onChange(r.steps.map(s => ({ id: uid(), label: s.label, done: false })));
  };

  const flashHighlight = () => {
    setJustRegenerated(false);
    requestAnimationFrame(() => setJustRegenerated(true));
  };

  /** "Regenerate" clicked — opens the clarify panel, asking the model to target real vague steps first. */
  const openClarifyPanel = async () => {
    if (isOnDeviceAssistantEnabled() && value.length > 0) {
      setThinking(true);
      const q = await modelClarify(buildTaskJson(), value.map(s => s.label));
      setThinking(false);
      if (q !== null) {
        setUsingModel(true);
        setModelQuestions(q);
        if (q.length === 0) {
          setHint(null);
          toast.success('Your steps already look specific — nothing to clarify!');
          return;
        }
        setClarifyOpen(true);
        return;
      }
    }
    setUsingModel(false);
    setClarifyOpen(true);
  };

  const regenerateWithModelAnswers = async () => {
    const currentLabels = value.map(s => s.label);
    const answerPairs = (modelQuestions || [])
      .map(q => ({ question: q.question, answer: (modelAnswers[q.targetStepIndex] || '').trim() }))
      .filter(a => a.answer);

    setClarifyOpen(false);

    if (answerPairs.length === 0) {
      toast.success('Steps updated');
      setHint(null);
      flashHighlight();
      return;
    }

    setThinking(true);
    const sharpened = await modelRefine(buildTaskJson(), currentLabels, answerPairs);
    setThinking(false);
    flashHighlight();

    if (sharpened) {
      onChange(toSubtasks(sharpened));
      toast.success('Sharpened with your answers');
      setHint(null);
    } else {
      toast.success('Steps updated');
      setHint('Try being more specific in your answers to sharpen the steps further.');
    }
  };

  const regenerateWithRuleEngineAnswers = () => {
    const hasAnyAnswer = Object.values(answers).some(v => v?.trim());

    const applyAndReport = (steps: { label: string }[]) => {
      onChange(steps.map(s => ({ id: uid(), label: s.label, done: false })));
      if (!hasAnyAnswer) {
        toast.success('Steps updated');
        setHint(null);
        return;
      }
      // Compare against an answer-less baseline (same locked intent) to tell
      // whether the answers actually changed anything visible.
      const baseline = breakdownTask({ title, description, subject, priority, tags, deadline, intent });
      const changed = JSON.stringify(steps.map(s => s.label))
        !== JSON.stringify(baseline.steps.map(s => s.label));
      if (changed) {
        toast.success('Sharpened with your answers');
        setHint(null);
      } else {
        toast.success('Steps updated');
        const unanswered = questions.find(q => !answers[q.key]?.trim());
        setHint(unanswered
          ? `Answering "${unanswered.question}" would sharpen this further.`
          : 'Try being more specific in your answers to sharpen the steps further.');
      }
    };

    const r = breakdownTask({ title, description, subject, priority, tags, deadline, intent, answers });
    applyAndReport(r.steps);
    setClarifyOpen(false);
    flashHighlight();
  };

  const regenerateWithAnswers = () => {
    if (usingModel && modelQuestions) {
      void regenerateWithModelAnswers();
      return;
    }
    regenerateWithRuleEngineAnswers();
  };

  const regenerateWithoutAnswers = () => {
    setClarifyOpen(false);
    setHint(null);
    void generate(undefined, intent).then(() => {
      toast.success('Steps updated');
      flashHighlight();
    });
  };

  const update = (id: string, patch: Partial<Subtask>) =>
    onChange(value.map(s => (s.id === id ? { ...s, ...patch } : s)));
  const remove = (id: string) => onChange(value.filter(s => s.id !== id));
  const addBlank = () => onChange([...value, { id: uid(), label: '', done: false }]);
  const clearAll = () => onChange([]);

  const done = value.filter(s => s.done).length;
  const allDone = value.length > 0 && done === value.length;

  /* ----- empty state: generate ----- */
  if (value.length === 0) {
    return (
      <div className="glass-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg xp-gradient flex items-center justify-center shrink-0">
            <Wand2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <p className="text-sm font-bold">Break it into steps</p>
        </div>
        {infoThin && (
          <p className="text-[11px] text-muted-foreground inline-flex items-start gap-1">
            <HelpCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            Add a bit more detail — notes, a tag, the type of work, or a deadline — and the steps get much more specific.
          </p>
        )}
        <div className="flex gap-2">
          <Button type="button" size="sm" className="gap-2 flex-1" disabled={thinking} onClick={() => void generate()}>
            {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {thinking ? thinkingLabel : 'Generate steps'}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={thinking} onClick={addBlank}>
            <Plus className="h-4 w-4" /> Add manually
          </Button>
        </div>
      </div>
    );
  }

  /* ----- list state: edit / delete / clear / regenerate ----- */
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold flex items-center gap-1.5">
          <Wand2 className="h-4 w-4 text-primary" /> Subtasks
          {allDone && <Sparkles className="h-3.5 w-3.5 text-yellow-400" />}
        </p>
        <span className="text-[11px] font-bold text-primary tabular-nums">{done}/{value.length}</span>
      </div>

      <div
        className={`space-y-1.5 rounded-lg p-1.5 -m-1.5 ring-2 transition-colors duration-700 ${
          justRegenerated ? 'ring-primary/40' : 'ring-transparent'
        }`}
      >
        {value.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button type="button" onClick={() => update(s.id, { done: !s.done })} className="shrink-0" aria-label="Toggle step">
              {s.done
                ? <CheckCircle2 className="h-5 w-5 text-primary" />
                : <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />}
            </button>
            <Input
              value={s.label}
              placeholder={`Step ${i + 1}`}
              onChange={e => update(s.id, { label: e.target.value })}
              className={`h-9 text-sm ${s.done ? 'line-through text-muted-foreground' : ''}`}
            />
            <button type="button" onClick={() => remove(s.id)} className="shrink-0 p-1.5 rounded hover:bg-destructive/10" aria-label="Delete step">
              <Trash2 className="h-4 w-4 text-destructive" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" size="sm" variant="outline" className="gap-1" disabled={thinking} onClick={addBlank}>
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
        <Button type="button" size="sm" variant="outline" className="gap-1" disabled={thinking} onClick={() => (clarifyOpen ? setClarifyOpen(false) : void openClarifyPanel())}>
          {thinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {thinking ? thinkingLabel : 'Regenerate'}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="gap-1 text-destructive" disabled={thinking} onClick={clearAll}>
          <Trash2 className="h-3.5 w-3.5" /> Clear all
        </Button>
        <Button type="button" size="sm" className="gap-1 ml-auto" disabled={thinking} onClick={() => (onStartFocus ? onStartFocus() : navigate('/focus'))}>
          <Play className="h-3.5 w-3.5" /> Start step 1
        </Button>
      </div>

      {/* Regenerate → clarify (Tasks #7); questions come from the on-device
          model when available (targeting real vague steps), otherwise the
          rule engine's fixed per-intent slots. */}
      {clarifyOpen && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <HelpCircle className="h-3.5 w-3.5 text-primary" /> Answer a couple of things for sharper steps (optional):
          </p>
          {usingModel && modelQuestions
            ? modelQuestions.map(q => (
              <div key={q.targetStepIndex}>
                <label className="text-[11px] font-medium block mb-0.5">{q.question}</label>
                <p className="text-[10px] text-muted-foreground mb-1 italic">re: "{q.targetStepText}"</p>
                <Input
                  value={modelAnswers[q.targetStepIndex] || ''}
                  onChange={e => setModelAnswers(a => ({ ...a, [q.targetStepIndex]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))
            : questions.map(q => (
              <div key={q.key}>
                <label className="text-[11px] font-medium block mb-0.5">{q.question}</label>
                <Input
                  value={answers[q.key] || ''}
                  placeholder={q.placeholder}
                  onChange={e => setAnswers(a => ({ ...a, [q.key]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" className="flex-1 gap-1.5" disabled={thinking} onClick={regenerateWithAnswers}>
              {thinking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {thinking ? thinkingLabel : 'Regenerate with this'}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={thinking} onClick={regenerateWithoutAnswers}>
              Just regenerate
            </Button>
          </div>
        </div>
      )}

      {hint && !clarifyOpen && (
        <p className="text-[11px] text-muted-foreground inline-flex items-start gap-1">
          <HelpCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" /> {hint}
        </p>
      )}
    </div>
  );
}

export default QuestBreakdown;
