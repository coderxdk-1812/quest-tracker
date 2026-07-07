import { motion, AnimatePresence } from 'framer-motion';
import { useGame, computeTaskReward, type Task } from '@/context/GameContext';
import { useTaskCompleteFx } from '@/context/TaskCompleteFxContext';
import { prefersReducedMotion, cn } from '@/lib/utils';

interface TaskCheckboxProps {
  task: Task;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Task-complete delight moment (spec: personality layer 3a): the checkmark draws
 * in with a short stroke animation instead of just swapping icons, and — the
 * moment a task goes from incomplete to complete — a small "+XP" chip fires off
 * toward the header HUD via TaskCompleteFxContext. Both fully respect
 * prefers-reduced-motion (checkmark just appears; the XP chip doesn't fire at all).
 */
export function TaskCheckbox({ task, size = 'md', className }: TaskCheckboxProps) {
  const { state, toggleTask } = useGame();
  const { triggerXpFly } = useTaskCompleteFx();
  const reduceMotion = prefersReducedMotion();
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!task.completed) {
      const { xp } = computeTaskReward(task, state.activeBoosts);
      triggerXpFly(e.currentTarget, xp);
    }
    toggleTask(task.id);
  };

  return (
    <button
      onClick={handleClick}
      className={cn('shrink-0 group', className)}
      aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
    >
      <svg viewBox="0 0 24 24" className={dim}>
        <motion.circle
          cx="12" cy="12" r="9.5"
          strokeWidth="2"
          fill="transparent"
          className={cn(
            'transition-colors',
            task.completed ? 'stroke-primary' : 'stroke-muted-foreground group-hover:stroke-primary',
          )}
          initial={false}
          animate={{ fill: task.completed ? 'hsl(var(--primary))' : 'transparent' }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
        />
        <AnimatePresence>
          {task.completed && (
            <motion.path
              d="M7.5 12.5l3 3 6-6.5"
              stroke="hsl(var(--primary-foreground))"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.32, ease: 'easeOut' }}
            />
          )}
        </AnimatePresence>
      </svg>
    </button>
  );
}

export default TaskCheckbox;
