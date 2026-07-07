/**
 * Streak status (Phase 4, spec §5) — loss aversion aimed at PERSONAL progress, not
 * public demotion. Surfaces an "at risk" state before the streak is lost, plus a
 * recovery state when a freeze can save it. Pure & testable.
 */

export type StreakState = 'none' | 'safe' | 'at_risk' | 'recoverable';

export interface StreakStatus {
  state: StreakState;
  streak: number;
  /** Whole hours remaining in the user's local day to act. */
  hoursLeft: number;
  canUseFreeze: boolean;
  message: string;
}

const todayKey = (d: Date) => d.toISOString().split('T')[0];

export function getStreakStatus(opts: {
  streak: number;
  lastActiveDate: string;  // YYYY-MM-DD
  streakFreezes?: number;
  now?: Date;
}): StreakStatus {
  const now = opts.now ?? new Date();
  const freezes = opts.streakFreezes ?? 0;
  const today = todayKey(now);
  const yesterday = todayKey(new Date(now.getTime() - 86_400_000));
  const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999);
  const hoursLeft = Math.max(0, Math.ceil((endOfDay.getTime() - now.getTime()) / 3_600_000));

  if (opts.streak <= 0) {
    return { state: 'none', streak: 0, hoursLeft, canUseFreeze: false,
      message: 'Complete a task today to start a streak.' };
  }
  if (opts.lastActiveDate === today) {
    return { state: 'safe', streak: opts.streak, hoursLeft, canUseFreeze: false,
      message: `Streak secured for today — ${opts.streak} days strong.` };
  }
  if (opts.lastActiveDate === yesterday) {
    return { state: 'at_risk', streak: opts.streak, hoursLeft, canUseFreeze: freezes > 0,
      message: `Your ${opts.streak}-day streak ends in ${hoursLeft}h. Do one task to keep it.` };
  }
  // Missed a day already — only a freeze can recover it.
  return { state: 'recoverable', streak: opts.streak, hoursLeft, canUseFreeze: freezes > 0,
    message: freezes > 0
      ? `You missed a day — use a streak freeze to save your ${opts.streak}-day streak.`
      : `Streak broken. Start a fresh one today — you've got this.` };
}

/**
 * Personality layer 3c: a streak freeze only ever gets consumed by CHECK_STREAK
 * saving an at-risk streak (shop purchases only ever add freezes) — so a plain
 * decrease reliably means "a save just happened," worth a warm moment in the UI.
 */
export function isStreakSaveEvent(prevFreezes: number, newFreezes: number): boolean {
  return newFreezes < prevFreezes;
}

/**
 * Streak-length tier used to scale the header flame's idle intensity (spec 3c).
 * Matches milestones.ts's existing streak tiers (3/7/30/100) so the flame's
 * "growth" lines up with the milestones the user is already chasing.
 */
export type StreakTier = 0 | 1 | 2 | 3;

export function streakTier(streak: number): StreakTier {
  if (streak >= 30) return 3;
  if (streak >= 7) return 2;
  if (streak >= 3) return 1;
  return 0;
}
