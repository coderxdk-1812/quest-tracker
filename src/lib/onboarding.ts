/**
 * First-run onboarding (Phase 6, spec §7).
 *
 * Seeds the core loop — capture → break down → focus — so a new user reaches their
 * first win fast. Pure & testable; the React layer supplies the booleans and persists
 * dismissal.
 */

export type OnboardingStepId = 'add_task' | 'break_down' | 'focus_session';

export interface OnboardingFacts {
  hasTask: boolean;
  hasBrokenDownTask: boolean;
  hasFocusSession: boolean;
}

export interface OnboardingStep {
  id: OnboardingStepId;
  label: string;
  hint: string;
  cta: string;
  route: '/tasks' | '/focus';
  done: boolean;
}

export interface OnboardingState {
  steps: OnboardingStep[];
  completedCount: number;
  total: number;
  pct: number;
  allDone: boolean;
  /** The first incomplete step — the one to nudge next. */
  nextStep: OnboardingStep | null;
}

export function computeOnboarding(f: OnboardingFacts): OnboardingState {
  const steps: OnboardingStep[] = [
    { id: 'add_task', label: 'Add your first task', hint: 'Capture one thing you need to do.',
      cta: 'Add a task', route: '/tasks', done: f.hasTask },
    { id: 'break_down', label: 'Break a task into steps', hint: 'Beat “don’t know where to start”.',
      cta: 'Break it down', route: '/tasks', done: f.hasBrokenDownTask },
    { id: 'focus_session', label: 'Run a focus session', hint: 'Do the first step distraction-free.',
      cta: 'Start focus', route: '/focus', done: f.hasFocusSession },
  ];
  const completedCount = steps.filter(s => s.done).length;
  const total = steps.length;
  return {
    steps,
    completedCount,
    total,
    pct: Math.round((completedCount / total) * 100),
    allDone: completedCount === total,
    nextStep: steps.find(s => !s.done) ?? null,
  };
}
