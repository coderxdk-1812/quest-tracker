import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { subjectMastery } from '@/lib/motivation';
import { GlowCard } from '@/components/GlowCard';

export function MasteryCard() {
  const { state } = useGame();
  const mastery = useMemo(() => subjectMastery(state.tasks), [state.tasks]);
  if (mastery.length === 0) return null;
  return (
    <GlowCard className="p-5" glowHsl="var(--level-purple)">
      <h2 className="font-display font-bold text-lg mb-1 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" /> Mastery
      </h2>
      <p className="text-xs text-muted-foreground mb-4">You're getting better — level up each subject by finishing its tasks.</p>
      <div className="space-y-3">
        {mastery.slice(0, 6).map((m, i) => (
          <motion.div key={m.subject} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">{m.subject}</span>
              <span className="text-[11px] font-bold text-primary shrink-0">{m.title} · Lv {m.level}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full xp-gradient" initial={{ width: 0 }} animate={{ width: `${m.pct}%` }} transition={{ duration: 0.6 }} />
            </div>
          </motion.div>
        ))}
      </div>
    </GlowCard>
  );
}

export default MasteryCard;
