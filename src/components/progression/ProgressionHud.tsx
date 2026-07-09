import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { getRank, rankProgress } from '@/lib/progression';
import { LevelRing } from './LevelRing';
import { rankIcon } from './RankBadge';
import { StreakFlame } from '@/components/StreakFlame';

/**
 * Hero progression HUD — the dashboard's showpiece, not a stat card (spec:
 * personality redesign). One focal point (the headline), an oversized ring as
 * a secondary anchor, and the streak folded into a small corner detail rather
 * than a fourth chip competing for the same attention.
 */
export function ProgressionHud() {
  const { state, xpProgress, xpToNextLevel } = useGame();
  const rank = getRank(state.level);
  const rp = rankProgress(state.level);
  const RankIcon = rankIcon(rank);
  const NextIcon = rp.next ? rankIcon(rp.next) : null;

  return (
    <div className="glass-card relative rounded-2xl p-6 md:p-9">
      <div className="absolute top-5 right-6 md:right-8 flex items-center gap-1.5 text-sm font-bold text-streak">
        <StreakFlame />
        <span className="tabular-nums">{state.streak}</span>
      </div>

      <div className="relative flex flex-col md:flex-row md:items-center gap-7 md:gap-10">
        <LevelRing level={state.level} progress={xpProgress} hsl={rank.hsl} size={140} />

        <div className="flex-1 min-w-0">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold mb-3"
            style={{
              color: `hsl(${rank.hsl})`,
              backgroundColor: `hsl(${rank.hsl} / 0.12)`,
              border: `1px solid hsl(${rank.hsl} / 0.35)`,
            }}
          >
            <RankIcon className="h-3.5 w-3.5" /> {rank.title}
          </div>

          {rp.next ? (
            <h2>
              {xpToNextLevel} XP to <span style={{ color: `hsl(${rp.next.hsl})` }}>{rp.next.title}</span>.
            </h2>
          ) : (
            <h2 style={{ color: `hsl(${rank.hsl})` }}>
              Max rank reached — you're a Legend.
            </h2>
          )}

          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            {state.streak > 0
              ? `${state.streak}-day streak — keep today's momentum going.`
              : "Complete a task today to start your streak."}
          </p>

          {rp.next && (
            <div className="mt-4 max-w-sm">
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: `hsl(${rp.next.hsl})` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${rp.pct}%` }}
                  transition={{ duration: 0.7 }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5">
                <span>{rank.title}</span>
                <span className="inline-flex items-center gap-0.5 font-semibold">
                  {NextIcon && <NextIcon className="h-3 w-3" style={{ color: `hsl(${rp.next.hsl})` }} />}
                  {rp.levelsToNext} lvl to {rp.next.title}
                  <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProgressionHud;
