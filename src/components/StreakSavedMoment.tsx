import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useGame } from '@/context/GameContext';
import { isStreakSaveEvent } from '@/lib/streak';

/**
 * Streak-saved notice — a single toast. A streak freeze is only ever consumed
 * by CHECK_STREAK saving an at-risk streak (shop purchases only add freezes),
 * so watching state.streakFreezes for a decrease reliably catches exactly
 * that moment — distinct from StreakStatusBanner, which only warns *before*
 * a save, not after one actually happens.
 */
export function StreakSavedMoment() {
  const { state } = useGame();
  const prevFreezesRef = useRef<number | null>(null);

  useEffect(() => {
    if (!state.loaded) return;
    const prev = prevFreezesRef.current;
    prevFreezesRef.current = state.streakFreezes;
    if (prev === null) return;
    if (isStreakSaveEvent(prev, state.streakFreezes)) {
      toast.success(`Streak saved — ${state.streak} days and counting 🔥`);
    }
  }, [state.streakFreezes, state.loaded, state.streak]);

  return null;
}

export default StreakSavedMoment;
