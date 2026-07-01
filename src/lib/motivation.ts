export interface SurpriseReward {
  coins: number;
  xp: number;
  label: string;
  emoji: string;
}

export function rollSurpriseReward(rng: () => number = Math.random): SurpriseReward | null {
  if (rng() >= 0.15) return null;
  const r = rng();
  if (r < 0.6) {
    const coins = 10 + Math.floor(rng() * 16);
    return { coins, xp: 0, label: `Surprise! +${coins} bonus coins`, emoji: '🎁' };
  }
  if (r < 0.85) {
    const xp = 15;
    return { coins: 0, xp, label: `Lucky XP! +${xp} bonus XP`, emoji: '⚡' };
  }
  const coins = 50 + Math.floor(rng() * 51);
  return { coins, xp: 0, label: `JACKPOT! +${coins} coins`, emoji: '🎉' };
}

export interface MasteryTask { subject?: string; completed: boolean; }
export interface SubjectMastery { subject: string; completed: number; level: number; title: string; pct: number; }

const MASTERY_TITLES = ['Novice', 'Apprentice', 'Skilled', 'Strong', 'Sharp', 'Master'];
const PER_LEVEL = 5;

export function masteryTitle(level: number): string {
  return MASTERY_TITLES[Math.min(level - 1, MASTERY_TITLES.length - 1)] || 'Novice';
}

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

export type DailyCue = 'set' | 'streak_active' | 'comeback' | 'fresh';

export function dailyCueState(opts: {
  lastActiveDate: string; streak: number; totalCompleted: number; now?: Date;
}): DailyCue {
  const now = opts.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  if (opts.lastActiveDate === today) return 'set';
  if (opts.streak > 0) return 'streak_active';
  return opts.totalCompleted > 0 ? 'comeback' : 'fresh';
}
