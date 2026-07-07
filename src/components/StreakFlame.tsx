import { motion } from 'framer-motion';
import { streakTier } from '@/lib/streak';
import { prefersReducedMotion } from '@/lib/utils';

/**
 * A streak that feels alive (spec: personality layer 3c) — the header flame gets a
 * gentle idle "breathing" animation once a streak exists, growing a little more
 * intense per tier (matching milestones.ts's 3/7/30 streak tiers). Tier 0 (no
 * streak yet) and reduced-motion both render a plain, static emoji.
 */
export function StreakFlame({ streak }: { streak: number }) {
  const tier = streakTier(streak);

  if (tier === 0 || prefersReducedMotion()) {
    return <span className="text-lg">🔥</span>;
  }

  return (
    <motion.span
      className="text-lg inline-block"
      style={{ filter: `drop-shadow(0 0 ${2 + tier * 2}px hsl(var(--streak-fire) / ${0.3 + tier * 0.15}))` }}
      animate={{ scale: [1, 1.08 + tier * 0.03, 1] }}
      transition={{ duration: 1.8 - tier * 0.15, repeat: Infinity, ease: 'easeInOut' }}
    >
      🔥
    </motion.span>
  );
}

export default StreakFlame;
