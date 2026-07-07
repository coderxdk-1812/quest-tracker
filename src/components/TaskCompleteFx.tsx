import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTaskCompleteFx } from '@/context/TaskCompleteFxContext';

/** Renders the flying "+XP" chips. Mounted once in AppLayout. */
export function TaskCompleteFx() {
  const { events, hudTargetRef, dismissEvent } = useTaskCompleteFx();

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden="true">
      <AnimatePresence>
        {events.map(ev => {
          const target = hudTargetRef.current?.getBoundingClientRect();
          const originCx = ev.originRect.x + ev.originRect.width / 2;
          const originCy = ev.originRect.y + ev.originRect.height / 2;
          const dx = target ? target.x + target.width / 2 - originCx : 0;
          const dy = target ? target.y + target.height / 2 - originCy : -36;
          return (
            <motion.div
              key={ev.id}
              initial={{ x: originCx, y: originCy, opacity: 0, scale: 0.85 }}
              animate={{ x: originCx + dx, y: originCy + dy, opacity: [0, 1, 1, 0], scale: 1 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => dismissEvent(ev.id)}
              className="fixed left-0 top-0 -translate-x-1/2 -translate-y-1/2 font-display font-bold text-sm text-primary whitespace-nowrap"
            >
              +{ev.xp} XP
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

export default TaskCompleteFx;
