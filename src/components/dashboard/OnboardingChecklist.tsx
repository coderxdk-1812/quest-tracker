import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, CheckCircle2, Circle, ArrowRight, X } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { computeOnboarding } from '@/lib/onboarding';
import { Button } from '@/components/ui/button';

const DISMISS_KEY = 'onboarding_dismissed';

function hasBrokenDownTask(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('quest_steps_')) {
        const v = localStorage.getItem(k);
        if (v && v !== '{}') return true;
      }
    }
  } catch { /* ignore */ }
  return false;
}

/**
 * First-run checklist that seeds the core loop (spec §7). Auto-hides once complete or
 * dismissed. Reduces the "blank app" friction the survey flagged.
 */
export function OnboardingChecklist() {
  const { state } = useGame();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  const onboarding = useMemo(() => computeOnboarding({
    hasTask: state.tasks.length > 0 || state.totalTasksCompleted > 0,
    hasBrokenDownTask: hasBrokenDownTask(),
    hasFocusSession: state.focusSessionsCompleted > 0,
  }), [state.tasks.length, state.totalTasksCompleted, state.focusSessionsCompleted]);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  if (dismissed || onboarding.allDone) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className="glass-card p-5 border border-primary/30"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" /> Get started
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">
              {onboarding.completedCount}/{onboarding.total}
            </span>
            <button onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
          <motion.div className="h-full xp-gradient" initial={{ width: 0 }}
            animate={{ width: `${onboarding.pct}%` }} transition={{ duration: 0.5 }} />
        </div>

        <div className="space-y-2">
          {onboarding.steps.map(step => {
            const isNext = onboarding.nextStep?.id === step.id;
            return (
              <div key={step.id}
                className={`flex items-center gap-3 p-2.5 rounded-lg ${isNext ? 'bg-primary/10' : ''}`}>
                {step.done
                  ? <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  : <Circle className="h-5 w-5 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${step.done ? 'line-through text-muted-foreground' : ''}`}>
                    {step.label}
                  </p>
                  {!step.done && <p className="text-[11px] text-muted-foreground">{step.hint}</p>}
                </div>
                {isNext && (
                  <Button size="sm" className="gap-1 shrink-0" onClick={() => navigate(step.route)}>
                    {step.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default OnboardingChecklist;
