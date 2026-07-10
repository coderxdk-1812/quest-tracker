import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { prefersReducedMotion } from '@/lib/utils';
import { revealVariants, springReveal, type RevealDirection } from '@/lib/motion';

interface RevealProps {
  children: ReactNode;
  direction?: RevealDirection;
  className?: string;
  /** Extra delay (seconds) for hand-tuned stagger within a section. */
  delay?: number;
  /** Re-trigger every time it scrolls into view instead of once. */
  once?: boolean;
}

/**
 * Scroll-driven entrance: rises/slides/scales in as the element enters the viewport,
 * with a spring so it settles with a touch of weight instead of a flat fade.
 * Reduced-motion users get the content immediately, no transform.
 */
export function Reveal({ children, direction = 'up', className, delay = 0, once = true }: RevealProps) {
  if (prefersReducedMotion()) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: '0px 0px -80px 0px', amount: 0.2 }}
      variants={revealVariants(direction)}
      transition={{ ...springReveal, delay }}
    >
      {children}
    </motion.div>
  );
}

export default Reveal;
