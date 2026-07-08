import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Flame, Clock, ChevronUp, ChevronDown, Info } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { useLeague } from '@/hooks/useLeague';
import { getRank } from '@/lib/progression';
import { RankBadge } from '@/components/progression/RankBadge';
import {
  tierInfo, zoneFor, msUntilWeeklyReset, formatCountdown,
  PROMOTION_ZONE, RELEGATION_ZONE, MAX_TIER,
} from '@/lib/league';

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || 'S';
}

export default function Leaderboard() {
  const { state } = useGame();
  const { standings, myTier, loading, error } = useLeague();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const tier = tierInfo(myTier);
  const tierColor = `hsl(${tier.hsl})`;
  const total = standings.length;
  const reset = formatCountdown(msUntilWeeklyReset(new Date(now)));
  const rank = getRank(state.level);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="flex items-center gap-2">
            <Trophy className="h-7 w-7 text-primary" /> Weekly League
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Climb by your own XP this week. Top {PROMOTION_ZONE} move up — fresh start every Monday.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-full font-bold text-sm border"
            style={{ color: tierColor, borderColor: tierColor, backgroundColor: `hsl(${tier.hsl} / 0.12)` }}>
            {tier.name} League
          </span>
          <span className="text-xs px-2 py-1.5 rounded-full bg-muted text-muted-foreground font-mono inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> {reset}
          </span>
        </div>
      </div>

      {/* Personal progress — the safety net: even last place is still growing */}
      <div className="glass-card p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <RankBadge level={state.level} size="md" />
          <span className="text-sm text-muted-foreground">Level {state.level}</span>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-streak">
            <Flame className="h-4 w-4" /> {state.streak}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Info className="h-3 w-3" /> Your level, rank &amp; streak keep growing no matter where you place.
        </p>
      </div>

      {/* Standings */}
      <div className="glass-card p-4">
        {loading ? (
          <p className="text-center text-muted-foreground py-10 text-sm">Loading your league…</p>
        ) : error ? (
          <p className="text-center text-danger py-10 text-sm">{error}</p>
        ) : total === 0 ? (
          <p className="text-center text-muted-foreground py-10 text-sm">
            This week's league is wide open — complete a task and stake your claim! 🏁
          </p>
        ) : (
          <div className="space-y-1">
            {standings.map((row, i) => {
              const r = i + 1;
              const zone = zoneFor(r, total, myTier);
              const showPromoDivider = myTier < MAX_TIER && r === PROMOTION_ZONE && total > PROMOTION_ZONE;
              const showRelegDivider = myTier > 0 && r === total - RELEGATION_ZONE && total > RELEGATION_ZONE + PROMOTION_ZONE;
              return (
                <div key={row.user_id}>
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                      row.is_me ? 'bg-primary/10 border-primary/40' : 'border-transparent hover:bg-muted/40'
                    }`}
                  >
                    <div className={`w-7 text-center font-bold tabular-nums shrink-0 ${
                      zone === 'promote' ? 'text-success' : zone === 'demote' ? 'text-danger' : 'text-muted-foreground'
                    }`}>
                      {r}
                    </div>
                    <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold">
                      {row.avatar_url
                        ? <img src={row.avatar_url} alt="" className="h-full w-full object-cover" />
                        : initials(row.display_name)}
                    </div>
                    <p className={`flex-1 min-w-0 truncate text-sm ${row.is_me ? 'font-bold' : 'font-medium'}`}>
                      {row.display_name}{row.is_me && <span className="text-primary"> (you)</span>}
                    </p>
                    {zone === 'promote' && <ChevronUp className="h-4 w-4 text-success shrink-0" />}
                    {zone === 'demote' && <ChevronDown className="h-4 w-4 text-danger shrink-0" />}
                    <span className="text-sm font-bold tabular-nums shrink-0">{row.weekly_xp} XP</span>
                  </motion.div>

                  {showPromoDivider && (
                    <div className="flex items-center gap-2 my-1 px-2">
                      <div className="h-px flex-1 bg-success/40" />
                      <span className="text-[10px] font-bold text-success uppercase tracking-wide">Promotion</span>
                      <div className="h-px flex-1 bg-success/40" />
                    </div>
                  )}
                  {showRelegDivider && (
                    <div className="flex items-center gap-2 my-1 px-2">
                      <div className="h-px flex-1 bg-danger/40" />
                      <span className="text-[10px] font-bold text-danger uppercase tracking-wide">Relegation</span>
                      <div className="h-px flex-1 bg-danger/40" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Positive-sum: you only ever gain XP — no one can take it from you. {rank.title} · keep going!
      </p>
    </div>
  );
}
