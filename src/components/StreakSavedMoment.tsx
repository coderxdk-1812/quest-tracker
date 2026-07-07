import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { isStreakSaveEvent } from '@/lib/streak';
import { prefersReducedMotion } from '@/lib/utils';

const AUTO_DISMISS_MS = 4000;

/**
 * Streak-saved delight moment (spec: personality layer 3c). A streak freeze is
 * only ever consumed by CHECK_STREAK saving an at-risk streak (shop purchases
 * only add freezes), so watching state.streakFreezes for a decrease reliably
 * catches exactly that moment — distinct from StreakStatusBanner, which only
 * warns *before* a save, not after one actually happens.
 */
export function StreakSavedMoment() {
  const { state } = useGame();
  const prevFreezesRef = useRef<number | null>(null);
  const [saved, setSaved] = useState<{ streak: number } | null>(null);
  const reduceMotion = prefersReducedMotion();

  useEffect(() => {
    if (!state.loaded) return;
    const prev = prevFreezesRef.current;
    prevFreezesRef.current = state.streakFreezes;
    if (prev === null) return;
    if (isStreakSaveEvent(prev, state.streakFreezes)) {
      setSaved({ streak: state.streak });
    }
  }, [state.streakFreezes, state.loaded, state.streak]);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(null), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [saved]);

  return (
    <AnimatePresence>
      {saved && (
        <motion.div
          className="fixed bottom-6 left-1/2 z-[150] -translate-x-1/2 cursor-pointer"
          initial={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
          transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => setSaved(null)}
          role="status"
        >
          <div className="streak-gradient rounded-xl px-5 py-3 shadow-lg flex items-center gap-3 text-white">
            <Flame className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-display font-bold text-sm leading-tight">Streak saved!</p>
              <p className="text-xs opacity-90">A freeze covered you — {saved.streak} days and counting 🔥</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default StreakSavedMoment;
