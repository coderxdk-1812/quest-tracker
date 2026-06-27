import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, ShieldAlert, ArrowRight } from 'lucide-react';
import { useGame } from '@/context/GameContext';
import { getStreakStatus } from '@/lib/streak';
import { Button } from '@/components/ui/button';

/**
 * Loss-aversion nudge (spec §5). Only renders when the personal streak is at risk or
 * recoverable — a gentle consequence for inactivity, never a public demotion.
 */
export function StreakStatusBanner() {
  const { state } = useGame();
  const navigate = useNavigate();
  const status = getStreakStatus({
    streak: state.streak,
    lastActiveDate: state.lastActiveDate,
    streakFreezes: state.streakFreezes,
  });

  const show = status.state === 'at_risk' || status.state === 'recoverable';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="glass-card p-4 border-l-4 border-l-streak overflow-hidden"
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-streak/15 text-streak flex items-center justify-center shrink-0">
              {status.state === 'at_risk' ? <Flame className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <p className="text-sm flex-1 min-w-0">{status.message}</p>
            <Button size="sm" variant="outline" className="gap-1 shrink-0"
              onClick={() => navigate(status.state === 'at_risk' ? '/tasks' : '/shop')}>
              {status.state === 'at_risk' ? 'Keep it alive' : 'Open shop'}
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default StreakStatusBanner;
