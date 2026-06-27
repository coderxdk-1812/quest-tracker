/**
 * Milestones (Phase 4, spec §2/§5) — lifetime achievement tracks with progress bars.
 * Always shows the *next* target so progress is visible and motivating. Pure & testable.
 */

export type MilestoneTrack = 'tasks' | 'focus' | 'streak' | 'level';

export interface MilestoneStats {
  totalTasksCompleted: number;
  focusSessionsCompleted: number;
  streak: number;
  bestStreak?: number;
  level: number;
}

export interface MilestoneTier {
  track: MilestoneTrack;
  label: string;
  target: number;
  icon: string;   // lucide key, resolved in React
}

export interface MilestoneProgress extends MilestoneTier {
  current: number;
  reached: boolean;
  pct: number;          // 0..100 toward this tier
}

const TIERS: MilestoneTier[] = [
  // tasks completed
  { track: 'tasks', label: 'Getting started',   target: 10,  icon: 'check' },
  { track: 'tasks', label: 'Task slayer',        target: 50,  icon: 'check' },
  { track: 'tasks', label: 'Century',            target: 100, icon: 'check' },
  { track: 'tasks', label: 'Unstoppable',        target: 500, icon: 'check' },
  // focus sessions
  { track: 'focus', label: 'First focus',        target: 1,   icon: 'brain' },
  { track: 'focus', label: 'Deep worker',        target: 25,  icon: 'brain' },
  { track: 'focus', label: 'Focus master',       target: 100, icon: 'brain' },
  // streak days
  { track: 'streak', label: 'Warming up',        target: 3,   icon: 'flame' },
  { track: 'streak', label: 'On fire',           target: 7,   icon: 'flame' },
  { track: 'streak', label: 'Habit formed',      target: 30,  icon: 'flame' },
  { track: 'streak', label: 'Iron will',         target: 100, icon: 'flame' },
  // levels
  { track: 'level', label: 'Level 5',            target: 5,   icon: 'zap' },
  { track: 'level', label: 'Level 20',           target: 20,  icon: 'zap' },
  { track: 'level', label: 'Level 50',           target: 50,  icon: 'zap' },
];

function valueFor(track: MilestoneTrack, s: MilestoneStats): number {
  switch (track) {
    case 'tasks': return s.totalTasksCompleted;
    case 'focus': return s.focusSessionsCompleted;
    case 'streak': return Math.max(s.streak, s.bestStreak ?? 0);
    case 'level': return s.level;
  }
}

/** All tiers annotated with current progress. */
export function computeMilestones(s: MilestoneStats): MilestoneProgress[] {
  return TIERS.map(t => {
    const current = valueFor(t.track, s);
    const reached = current >= t.target;
    const pct = Math.min(100, Math.round((current / t.target) * 100));
    return { ...t, current, reached, pct };
  });
}

/** The next unreached tier per track (what to chase). */
export function nextMilestones(s: MilestoneStats): MilestoneProgress[] {
  const all = computeMilestones(s);
  const tracks: MilestoneTrack[] = ['tasks', 'focus', 'streak', 'level'];
  return tracks
    .map(tr => all.filter(m => m.track === tr && !m.reached).sort((a, b) => a.target - b.target)[0])
    .filter(Boolean) as MilestoneProgress[];
}

export function totalReached(s: MilestoneStats): number {
  return computeMilestones(s).filter(m => m.reached).length;
}
