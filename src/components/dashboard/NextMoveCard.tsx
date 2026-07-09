import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, ArrowRight, AlertTriangle, CalendarClock, BookOpen, Sparkles, Flame, Plus } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { recommendNextMove, type NMTask, type MoveKind } from '@/lib/nextMove';
import { Button } from '@/components/ui/button';

const KIND_ICON: Record<MoveKind, typeof Compass> = {
  overdue: AlertTriangle,
  due_today: CalendarClock,
  scheduled_subject: BookOpen,
  breakdown_big: Sparkles,
  focus_streak: Flame,
  plan_ahead: CalendarClock,
  add_first_task: Plus,
};

const todayStr = () => new Date().toISOString().split('T')[0];

/**
 * Surfaces the single most valuable next action (spec §4). Always relevant, never blank.
 */
export function NextMoveCard() {
  const { state } = useGame();
  const navigate = useNavigate();

  const move = useMemo(() => {
    const tasks: NMTask[] = state.tasks.map(t => ({
      id: t.id, title: t.title, completed: t.completed,
      priority: t.priority, subject: t.subject, deadline: t.deadline,
    }));
    return recommendNextMove({
      tasks,
      timetable: state.timetable.map(e => ({ subject: e.subject, day: e.day, days: e.days })),
      streakSafeToday: state.lastActiveDate === todayStr(),
    });
  }, [state.tasks, state.timetable, state.lastActiveDate]);

  const Icon = KIND_ICON[move.kind] ?? Compass;
  const urgent = move.kind === 'overdue';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-5 border-l-4 ${urgent ? 'border-l-hard' : 'border-l-primary'}`}
      style={{ borderRadius: 'var(--radius)' }}
    >
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${urgent ? 'bg-hard/15 text-hard' : 'bg-primary/15 text-primary'}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1">
            <Compass className="h-3 w-3" /> Your next move
          </p>
          <h3 className="leading-tight mt-0.5">{move.title}</h3>
          <p className="text-sm text-muted-foreground mt-1">{move.reason}</p>
          <Button size="sm" className="gap-1.5 mt-3" onClick={() => navigate(move.route)}>
            {move.cta} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default NextMoveCard;
