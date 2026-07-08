import { useRef, useState, type ReactNode, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { cn, prefersReducedMotion } from '@/lib/utils';

const MAX_PULL = 6;
const clamp = (v: number, max: number) => Math.max(-max, Math.min(max, v));

/**
 * Gentle magnetic pull toward the cursor (spec: personality redesign signature
 * component). Wraps a single prominent CTA — not applied broadly, since a
 * magnetic effect on every button would read as a gimmick rather than a
 * signature moment. Clamped to +/-6px regardless of the wrapped element's
 * size, so it stays subtle even on a large button. No-ops entirely under
 * prefers-reduced-motion.
 */
export function Magnetic({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const reduceMotion = prefersReducedMotion();

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;
    setPos({ x: clamp(relX * 0.2, MAX_PULL), y: clamp(relY * 0.2, MAX_PULL) });
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setPos({ x: 0, y: 0 })}
      animate={{ x: pos.x, y: pos.y }}
      transition={{ type: 'spring', stiffness: 250, damping: 18, mass: 0.4 }}
      className={cn('inline-block', className)}
    >
      {children}
    </motion.div>
  );
}

export default Magnetic;
