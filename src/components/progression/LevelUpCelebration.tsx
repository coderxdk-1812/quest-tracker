import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useGame } from '@/context/GameContext';
import { getRank, detectLevelUpEvent, type LevelUpEvent } from '@/lib/progression';
import { rankIcon } from '@/components/progression/RankBadge';
import { prefersReducedMotion } from '@/lib/utils';

const AUTO_DISMISS_MS = 1400;

/**
 * Level-up / rank-up delight moment (spec: personality layer 3b). Brief, skippable
 * (click/tap anywhere or Esc), theme-colored glow behind the rank icon + the new
 * level/rank revealed in Playfair Display. No confetti, no rainbow particles —
 * glow + typography, kept calm on purpose.
 *
 * Under prefers-reduced-motion this still appears (leveling up is information the
 * user wants, not just decoration) but instantly, with no glow pulse or slide-in.
 */
export function LevelUpCelebration() {
  const { state } = useGame();
  const prevLevelRef = useRef<number | null>(null);
  const [celebration, setCelebration] = useState<LevelUpEvent | null>(null);
  const reduceMotion = prefersReducedMotion();

  useEffect(() => {
    if (!state.loaded) return;
    const prevLevel = prevLevelRef.current;
    prevLevelRef.current = state.level;
    // Guard: only celebrate a real in-session level-up, not the initial DB load
    // (where state.level jumps from the initial 1 to whatever was saved).
    if (prevLevel === null) return;
    const event = detectLevelUpEvent(prevLevel, state.level);
    if (event) setCelebration(event);
  }, [state.level, state.loaded]);

  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [celebration]);

  useEffect(() => {
    if (!celebration) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCelebration(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [celebration]);

  const dur = (s: number) => (reduceMotion ? 0 : s);

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center cursor-pointer"
          style={{ background: 'hsl(var(--background) / 0.45)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur(0.25) }}
          onClick={() => setCelebration(null)}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="absolute rounded-full blur-3xl"
            style={{ background: `hsl(${celebration.rankHsl})`, width: 380, height: 380 }}
            initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.6 }}
            animate={{ opacity: 0.35, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: dur(0.5), ease: 'easeOut' }}
          />

          <motion.div
            className="relative flex flex-col items-center text-center px-8"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
            transition={{ duration: dur(0.4), ease: [0.22, 1, 0.36, 1], delay: dur(0.08) }}
          >
            {(() => {
              const Icon = rankIcon(getRank(celebration.level));
              return (
                <Icon className="h-12 w-12 mb-3" style={{ color: `hsl(${celebration.rankHsl})` }} />
              );
            })()}
            <p className="text-xs font-semibold tracking-[3px] uppercase text-muted-foreground mb-1">
              {celebration.isRankUp ? 'Rank up' : 'Level up'}
            </p>
            <p className="font-extrabold text-5xl" style={{ color: `hsl(${celebration.rankHsl})` }}>
              Level {celebration.level}
            </p>
            {celebration.isRankUp && (
              <p className="text-2xl mt-2 text-foreground">{celebration.rankTitle}</p>
            )}
            <p className="text-xs text-muted-foreground mt-4">Tap anywhere to continue</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LevelUpCelebration;
