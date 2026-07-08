import { motion } from 'framer-motion';
import { Trophy, Check, Brain, Flame, Zap, type LucideIcon } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { nextMilestones, totalReached, computeMilestones, type MilestoneProgress } from '@/lib/milestones';
import { GlowCard } from '@/components/GlowCard';

const ICONS: Record<string, LucideIcon> = { check: Check, brain: Brain, flame: Flame, zap: Zap };

export function MilestonesCard() {
  const { state } = useGame();
  const stats = {
    totalTasksCompleted: state.totalTasksCompleted,
    focusSessionsCompleted: state.focusSessionsCompleted,
    streak: state.streak,
    level: state.level,
  };
  const next = nextMilestones(stats);
  const reached = totalReached(stats);
  const total = computeMilestones(stats).length;

  return (
    <GlowCard className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" /> Milestones
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">
          {reached}/{total} reached
        </span>
      </div>
      <div className="space-y-3">
        {next.map((m: MilestoneProgress, i) => {
          const Icon = ICONS[m.icon] ?? Check;
          return (
            <div key={`${m.track}-${m.target}`} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate">{m.label}</p>
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 ml-2">
                    {m.current}/{m.target}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                  <motion.div className="h-full xp-gradient" initial={{ width: 0 }}
                    animate={{ width: `${m.pct}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} />
                </div>
              </div>
            </div>
          );
        })}
        {next.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Every milestone unlocked — you legend. 🏆
          </p>
        )}
      </div>
    </GlowCard>
  );
}

export default MilestonesCard;
