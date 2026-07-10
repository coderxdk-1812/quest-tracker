import { ReactNode, useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { prefersReducedMotion } from '@/lib/utils';

interface MagneticProps {
  children: ReactNode;
  className?: string;
  /** Max pull toward the cursor, in px. Kept small — a hint of tactility, not a toy. */
  strength?: number;
}

/**
 * Wraps a button/card so it leans gently toward the cursor on hover and springs
 * back on leave. A no-op passthrough under prefers-reduced-motion.
 */
export function Magnetic({ children, className, strength = 10 }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.5 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.5 });

  if (prefersReducedMotion()) return <div className={className}>{children}</div>;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const relX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const relY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    x.set(relX * strength);
    y.set(relY * strength);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
}

export default Magnetic;
