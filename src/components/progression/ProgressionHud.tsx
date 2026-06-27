import { motion } from 'framer-motion';
import { Flame, ChevronRight } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { getRank, rankProgress } from '@/lib/progression';
import { LevelRing } from './LevelRing';
import { RankBadge, rankIcon } from './RankBadge';

/**
 * Hero progression HUD — the identity-and-progress anchor for the dashboard.
 * Replaces the "dashboard" feel with a rank/progression feel (spec §2).
 */
export function ProgressionHud() {
  const { state, xpProgress, xpToNextLevel } = useGame();
  const rank = getRank(state.level);
  const rp = rankProgress(state.level);
  const NextIcon = rp.next ? rankIcon(rp.next) : null;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center gap-4">
        <LevelRing level={state.level} progress={xpProgress} hsl={rank.hsl} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <RankBadge level={state.level} size="md" />
            <span className="inline-flex items-center gap-1 text-xs font-bold text-streak">
              <Flame className="h-3.5 w-3.5" /> {state.streak}-day streak
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {xpToNextLevel} XP to level {state.level + 1}
          </p>

          {/* progress toward next rank */}
          {rp.next ? (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>{rank.title}</span>
                <span className="inline-flex items-center gap-0.5">
                  {NextIcon && <NextIcon className="h-3 w-3" style={{ color: `hsl(${rp.next.hsl})` }} />}
                  {rp.next.title}
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-bold">{rp.levelsToNext} lvl</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: `hsl(${rp.next.hsl})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${rp.pct}%` }}
                  transition={{ duration: 0.7 }}
                />
              </div>
            </div>
          ) : (
            <p className="mt-2 text-[11px] font-bold" style={{ color: `hsl(${rank.hsl})` }}>
              Max rank reached — you are a Legend.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProgressionHud;
