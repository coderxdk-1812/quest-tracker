import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Wand2, CheckCircle2, Circle, Clock, Play, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  breakdownTask, formatMinutes, type QuestIntent, type TaskDifficulty,
} from '@/lib/questBreakdown';

/**
 * Renders a local, no-API "quest line" breakdown for a task.
 *
 * It is intentionally self-contained and side-effect-light:
 *   - step progress is persisted in localStorage keyed by the task id, so there is
 *     NO database migration required to ship this.
 *   - it optionally calls `onAllComplete` once (so the parent can grant a small XP
 *     bonus) and `onStartFocus` for the one-tap "Start" → focus flow.
 */
export interface QuestBreakdownProps {
  taskId: string;
  title: string;
  subject?: string;
  description?: string;
  priority?: TaskDifficulty;
  intent?: QuestIntent;
  /** Fires once, the first time all steps are checked. */
  onAllComplete?: () => void;
  /** Fires when the user taps "Start now". Defaults to navigating to /focus. */
  onStartFocus?: () => void;
}

const storageKey = (taskId: string) => `quest_steps_${taskId}`;

function loadDone(taskId: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(storageKey(taskId));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

export function QuestBreakdown({
  taskId, title, subject, description, priority, intent,
  onAllComplete, onStartFocus,
}: QuestBreakdownProps) {
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);

  const breakdown = useMemo(
    () => breakdownTask({ title, subject, description, priority, intent }),
    // version lets "regenerate" recompute even though inputs are unchanged
    [title, subject, description, priority, intent, version],
  );

  const [done, setDone] = useState<Record<string, boolean>>(() => loadDone(taskId));
  const [celebrated, setCelebrated] = useState(false);

  useEffect(() => { setDone(loadDone(taskId)); setCelebrated(false); }, [taskId]);

  const persist = useCallback((next: Record<string, boolean>) => {
    setDone(next);
    try { localStorage.setItem(storageKey(taskId), JSON.stringify(next)); } catch { /* ignore */ }
  }, [taskId]);

  const completedCount = breakdown.steps.filter(s => done[s.id]).length;
  const total = breakdown.steps.length;
  const pct = total ? Math.round((completedCount / total) * 100) : 0;
  const allDone = total > 0 && completedCount === total;

  useEffect(() => {
    if (allDone && !celebrated) {
      setCelebrated(true);
      onAllComplete?.();
    }
  }, [allDone, celebrated, onAllComplete]);

  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    persist(next);
  };

  const regenerate = () => { persist({}); setVersion(v => v + 1); setCelebrated(false); };

  const startFocus = () => {
    if (onStartFocus) onStartFocus();
    else navigate('/focus');
  };

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg xp-gradient flex items-center justify-center shrink-0">
            <Wand2 className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display font-bold text-sm leading-tight flex items-center gap-1">
              Quest breakdown
              {allDone && <Sparkles className="h-3.5 w-3.5 text-yellow-400 animate-pulse" />}
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {breakdown.intentLabel} · {formatMinutes(breakdown.totalEstMinutes)} est.
            </p>
          </div>
        </div>
        <button
          onClick={regenerate}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          title="Regenerate steps"
        >
          <RefreshCw className="h-3 w-3" /> Reset
        </button>
      </div>

      {/* progress bar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full xp-gradient"
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <span className="text-[11px] font-bold text-primary tabular-nums shrink-0">
          {completedCount}/{total}
        </span>
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {breakdown.steps.map((s, i) => {
            const isDone = !!done[s.id];
            return (
              <motion.button
                key={s.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => toggle(s.id)}
                className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition-colors ${
                  isDone ? 'bg-primary/10 border-primary/30' : 'bg-muted/40 border-border hover:border-primary/40'
                }`}
              >
                {isDone
                  ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isDone ? 'line-through text-muted-foreground' : ''}`}>
                    {s.label}
                  </p>
                  {s.isStarter && !isDone && (
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wide">
                      Start here
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 shrink-0">
                  <Clock className="h-3 w-3" /> {formatMinutes(s.estMinutes)}
                </span>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <Button onClick={startFocus} className="w-full mt-4 gap-2" size="sm">
        <Play className="h-4 w-4" />
        {completedCount === 0 ? 'Start step 1 in Focus Mode' : 'Continue in Focus Mode'}
      </Button>
    </div>
  );
}

export default QuestBreakdown;
