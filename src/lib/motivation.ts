/**
 * Motivation — pure, testable helpers.
 *  - rollSurpriseReward: variable-ratio bonus on task completion (the strongest
 *    "pull-back" mechanic — anticipation, not obligation).
 *  - subjectMastery: per-subject competence ("you're getting better at X").
 *  - dailyCueState: drives a positive daily nudge + a zero-shame comeback flow.
 * No grades, no API. rng is injectable for deterministic tests.
 */

export interface SurpriseReward {
  coins: number;
  xp: number;
  label: string;
  emoji: string;
}

/**
 * ~15% of completions yield a surprise bonus. Weighted: mostly small coins,
 * sometimes an XP spark, rarely a jackpot. Returns null when no surprise.
 */
export function rollSurpriseReward(rng: () => number = Math.random): SurpriseReward | null {
  if (rng() >= 0.15) return null;
  const r = rng();
  if (r < 0.6) {
    const coins = 10 + Math.floor(rng() * 16); // 10–25
    return { coins, xp: 0, label: `Surprise! +${coins} bonus coins`, emoji: '🎁' };
  }
  if (r < 0.85) {
    const xp = 15;
    return { coins: 0, xp, label: `Lucky XP! +${xp} bonus XP`, emoji: '⚡' };
  }
  const coins = 50 + Math.floor(rng() * 51); // 50–100
  return { coins, xp: 0, label: `JACKPOT! +${coins} coins`, emoji: '🎉' };
}

/* ---------------- per-subject mastery ---------------- */

export interface MasteryTask {
  subject?: string;
  completed: boolean;
}

export interface SubjectMastery {
  subject: string;
  completed: number;
  level: number;
  title: string;
  pct: number; // progress toward next level (0..100)
}

const MASTERY_TITLES = ['Novice', 'Apprentice', 'Skilled', 'Strong', 'Sharp', 'Master'];
const PER_LEVEL = 5; // completed tasks per mastery level

export function masteryTitle(level: number): string {
  return MASTERY_TITLES[Math.min(level - 1, MASTERY_TITLES.length - 1)] || 'Novice';
}

/** Mastery per subject, derived from completed tasks in that subject. Busiest first. */
export function subjectMastery(tasks: MasteryTask[]): SubjectMastery[] {
  const map = new Map<string, number>();
  for (const t of tasks) {
    const s = (t.subject || '').trim();
    if (t.completed && s) map.set(s, (map.get(s) || 0) + 1);
  }
  return [...map.entries()]
    .map(([subject, completed]) => {
      const level = Math.floor(completed / PER_LEVEL) + 1;
      const pct = Math.round(((completed % PER_LEVEL) / PER_LEVEL) * 100);
      return { subject, completed, level, title: masteryTitle(level), pct };
    })
    .sort((a, b) => b.completed - a.completed);
}

/* ---------------- daily cue + comeback ---------------- */

export type DailyCue = 'set' | 'streak_active' | 'comeback' | 'fresh';

/**
 * What nudge to show today:
 *  - 'set'           → already did a task today (no nudge)
 *  - 'streak_active' → has a live streak but not done today (StreakStatusBanner owns this)
 *  - 'comeback'      → lapsed after prior activity (warm welcome-back, no shame)
 *  - 'fresh'         → brand new / no streak yet (gentle start)
 */
export function dailyCueState(opts: {
  lastActiveDate: string;
  streak: number;
  totalCompleted: number;
  now?: Date;
}): DailyCue {
  const now = opts.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  if (opts.lastActiveDate === today) return 'set';
  if (opts.streak > 0) return 'streak_active';
  return opts.totalCompleted > 0 ? 'comeback' : 'fresh';
}
