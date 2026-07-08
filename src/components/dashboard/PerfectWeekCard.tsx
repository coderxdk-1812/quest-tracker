import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarCheck2, PartyPopper } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { computePerfectWeek } from '@/lib/perfectWeek';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Perfect week (spec §4): progress toward completing >=1 task every day this
 * week, with a calm celebration once achieved. Never shames a missed day —
 * copy stays encouraging either way.
 */
export function PerfectWeekCard() {
  const { state } = useGame();

  // Same "day of activity" signal StudyHeatmap already uses (completed tasks'
  // createdAt), so the two cards agree with each other.
  const activityDates = useMemo(
    () => state.tasks.filter(t => t.completed).map(t => t.createdAt),
    [state.tasks],
  );
  const progress = useMemo(() => computePerfectWeek(activityDates), [activityDates]);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2">
          <CalendarCheck2 className="h-5 w-5 text-primary" /> Perfect Week
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-primary/15 text-primary font-bold">
          {progress.completedCount}/7
        </span>
      </div>

      <div className="flex items-center justify-between gap-1.5">
        {progress.days.map((d, i) => (
          <motion.div
            key={d.date}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: i * 0.04 }}
            className={`flex-1 aspect-square rounded-lg flex items-center justify-center text-xs font-bold ${
              d.completed
                ? 'xp-gradient text-primary-foreground'
                : d.isToday
                ? 'border-2 border-primary/50 text-primary'
                : d.isPast
                ? 'bg-muted text-muted-foreground'
                : 'border border-dashed border-border text-muted-foreground/50'
            }`}
            title={d.date}
          >
            {d.completed ? '✓' : DAY_LABELS[i]}
          </motion.div>
        ))}
      </div>

      <p className="text-sm text-center mt-4">
        {progress.achieved ? (
          <span className="font-semibold text-primary inline-flex items-center gap-1.5">
            <PartyPopper className="h-4 w-4" /> Perfect week! Every day counted. 🎉
          </span>
        ) : progress.onTrack ? (
          <span className="text-muted-foreground">{progress.completedCount}/7 so far — keep it going!</span>
        ) : (
          <span className="text-muted-foreground">{progress.completedCount}/7 this week. Every day is a fresh chance.</span>
        )}
      </p>
    </div>
  );
}

export default PerfectWeekCard;
