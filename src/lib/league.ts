/**
 * Weekly XP League — pure helpers (no React, unit-testable).
 *
 * Design (evidence-based, see product notes):
 *  - Positive-sum: you climb by your OWN weekly XP; nobody can take XP from you.
 *  - Small skill-matched brackets (<=30) so anyone engaged can realistically place high.
 *  - Promotion (top 5) / relegation (bottom 5) with a soft floor at Bronze.
 *  - Fresh weekly reset (Monday) so a bad week is never permanent.
 *  - Default-on for everyone; the safety net for less-competitive students is the
 *    bracket design + always-visible personal progress, not an opt-out.
 */

export interface LeagueTier {
  id: number;
  name: string;
  hsl: string; // "H S% L%"
}

export const PROMOTION_ZONE = 5;
export const RELEGATION_ZONE = 5;

/** 10 tiers, Bronze (0) → Diamond (9). */
export const LEAGUE_TIERS: LeagueTier[] = [
  { id: 0, name: 'Bronze',    hsl: '25 60% 45%' },
  { id: 1, name: 'Silver',    hsl: '215 15% 60%' },
  { id: 2, name: 'Gold',      hsl: '45 90% 50%' },
  { id: 3, name: 'Sapphire',  hsl: '210 80% 55%' },
  { id: 4, name: 'Ruby',      hsl: '350 75% 52%' },
  { id: 5, name: 'Emerald',   hsl: '155 65% 42%' },
  { id: 6, name: 'Amethyst',  hsl: '270 60% 58%' },
  { id: 7, name: 'Pearl',     hsl: '190 30% 70%' },
  { id: 8, name: 'Obsidian',  hsl: '240 15% 35%' },
  { id: 9, name: 'Diamond',   hsl: '185 80% 55%' },
];

export const MAX_TIER = LEAGUE_TIERS.length - 1;

export function tierInfo(tier: number): LeagueTier {
  return LEAGUE_TIERS[Math.max(0, Math.min(MAX_TIER, tier))];
}

export type Zone = 'promote' | 'demote' | 'hold';

/**
 * Which zone a 1-based rank falls in, given bracket size and current tier.
 * Promotion only below the top tier; relegation only above the bottom tier.
 */
export function zoneFor(rank: number, total: number, tier: number): Zone {
  if (tier < MAX_TIER && rank <= PROMOTION_ZONE) return 'promote';
  if (tier > 0 && rank > total - RELEGATION_ZONE) return 'demote';
  return 'hold';
}

/** Milliseconds until the next Monday 00:00 local time (weekly reset). */
export function msUntilWeeklyReset(now: Date = new Date()): number {
  const next = new Date(now);
  const day = next.getDay();                 // 0=Sun..6=Sat
  const daysUntilMonday = (8 - day) % 7 || 7; // always 1..7 ahead
  next.setDate(next.getDate() + daysUntilMonday);
  next.setHours(0, 0, 0, 0);
  return Math.max(0, next.getTime() - now.getTime());
}

/** "2d 3h" / "3h 12m" / "12m" countdown. */
export function formatCountdown(ms: number): string {
  const totalMin = Math.floor(ms / 60000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
