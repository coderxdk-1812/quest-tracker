/**
 * Progression & rank system (Phase 2 of the product spec, §2).
 *
 * Pure and dependency-free so it is unit-testable and can be reused anywhere
 * (HUD, profile, share card, leaderboard). Icons are referenced by string key and
 * mapped to components in the React layer, keeping this module React-free.
 *
 * Level math matches GameContext: XP_PER_LEVEL = 100, level = floor(xp / 100) + 1.
 */

export const XP_PER_LEVEL = 100;

export type RankId =
  | 'novice' | 'apprentice' | 'adept' | 'expert'
  | 'master' | 'grandmaster' | 'legend';

export interface Rank {
  id: RankId;
  title: string;
  /** Inclusive minimum level for this rank. */
  minLevel: number;
  /** Lucide icon key, resolved in the React layer. */
  icon: string;
  /** HSL triplet used for inline color (works in light & dark). */
  hsl: string;
}

/** Ordered low → high. The last rank has no upper bound. */
export const RANKS: Rank[] = [
  { id: 'novice',      title: 'Novice',      minLevel: 1,  icon: 'sprout',    hsl: '145 45% 55%' },
  { id: 'apprentice',  title: 'Apprentice',  minLevel: 5,  icon: 'leaf',      hsl: '160 55% 45%' },
  { id: 'adept',       title: 'Adept',       minLevel: 10, icon: 'star',      hsl: '200 75% 52%' },
  { id: 'expert',      title: 'Expert',      minLevel: 20, icon: 'award',     hsl: '265 70% 60%' },
  { id: 'master',      title: 'Master',      minLevel: 35, icon: 'crown',     hsl: '38 92% 52%' },
  { id: 'grandmaster', title: 'Grandmaster', minLevel: 50, icon: 'gem',       hsl: '330 75% 58%' },
  { id: 'legend',      title: 'Legend',      minLevel: 75, icon: 'flame',     hsl: '12 85% 56%' },
];

export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

/** The rank a given level currently sits in. */
export function getRank(level: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) current = r;
    else break;
  }
  return current;
}

/** The next rank up, or null if already at the top rank. */
export function getNextRank(level: number): Rank | null {
  const current = getRank(level);
  const idx = RANKS.findIndex(r => r.id === current.id);
  return idx >= 0 && idx < RANKS.length - 1 ? RANKS[idx + 1] : null;
}

export interface RankProgress {
  current: Rank;
  next: Rank | null;
  /** Levels completed within the current rank band. */
  levelsIntoRank: number;
  /** Total levels in the current rank band (Infinity for the top rank). */
  bandSize: number;
  /** 0..100 progress toward the next rank (100 when maxed). */
  pct: number;
  /** Levels remaining until promotion (0 when maxed). */
  levelsToNext: number;
}

export function rankProgress(level: number): RankProgress {
  const current = getRank(level);
  const next = getNextRank(level);
  if (!next) {
    return { current, next: null, levelsIntoRank: 0, bandSize: Infinity, pct: 100, levelsToNext: 0 };
  }
  const bandSize = next.minLevel - current.minLevel;
  const levelsIntoRank = level - current.minLevel;
  const levelsToNext = Math.max(0, next.minLevel - level);
  const pct = Math.min(100, Math.round((levelsIntoRank / bandSize) * 100));
  return { current, next, levelsIntoRank, bandSize, pct, levelsToNext };
}

/** XP needed to reach a given level from 0. */
export function xpForLevel(level: number): number {
  return Math.max(0, (level - 1) * XP_PER_LEVEL);
}
