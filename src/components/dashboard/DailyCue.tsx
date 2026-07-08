import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { dailyCueState } from '@/lib/motivation';
import { Button } from '@/components/ui/button';

export function DailyCue() {
  const { state } = useGame();
  const navigate = useNavigate();
  const cue = dailyCueState({
    lastActiveDate: state.lastActiveDate,
    streak: state.streak,
    totalCompleted: state.totalTasksCompleted,
  });
  if (cue === 'set' || cue === 'streak_active') return null;
  const isComeback = cue === 'comeback';
  const title = isComeback ? 'Welcome back 👋' : 'Start your streak today';
  const message = isComeback
    ? "No worries about the gap — one quick task restarts your momentum."
    : "Knock out one task to get the ball rolling. Small wins count.";
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
        className="glass-card p-4 border-l-4 border-l-primary">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground">{message}</p>
          </div>
          <Button size="sm" className="gap-1 shrink-0" onClick={() => navigate('/tasks')}>
            Quick win <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default DailyCue;
