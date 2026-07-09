import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useGame } from '@/context/GameContext';
import { detectLevelUpEvent } from '@/lib/progression';

/**
 * Level-up / rank-up notice — a single quiet toast, not a takeover. The
 * information still surfaces (leveling up matters), it just doesn't stage a
 * production for it.
 */
export function LevelUpCelebration() {
  const { state } = useGame();
  const prevLevelRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state.loaded) return;
    const prevLevel = prevLevelRef.current;
    prevLevelRef.current = state.level;
    // Guard: only notify on a real in-session level-up, not the initial DB load
    // (where state.level jumps from the initial 1 to whatever was saved).
    if (prevLevel === null) return;
    const event = detectLevelUpEvent(prevLevel, state.level);
    if (!event) return;
    toast.success(
      event.isRankUp ? `Level ${event.level} — ${event.rankTitle}!` : `Level ${event.level}!`
    );
  }, [state.level, state.loaded]);

  return null;
}

export default LevelUpCelebration;
