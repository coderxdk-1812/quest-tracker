import type { Transition, Variants } from 'framer-motion';

/** Spring with a touch of overshoot — the default "arrives with weight" feel. */
export const springReveal: Transition = { type: 'spring', stiffness: 260, damping: 22, mass: 0.9 };

/** Softer, no-overshoot spring for hover/press micro-interactions. */
export const springSoft: Transition = { type: 'spring', stiffness: 400, damping: 32 };

export type RevealDirection = 'up' | 'left' | 'right' | 'scale';

const OFFSET = 28;

export function revealVariants(direction: RevealDirection): Variants {
  const hidden =
    direction === 'up' ? { opacity: 0, y: OFFSET } :
    direction === 'left' ? { opacity: 0, x: -OFFSET } :
    direction === 'right' ? { opacity: 0, x: OFFSET } :
    { opacity: 0, scale: 0.94 };
  return {
    hidden,
    show: { opacity: 1, y: 0, x: 0, scale: 1 },
  };
}

/** Mount-time container: staggers children as a group of springs, not a flat fade. */
export const staggerContainer: Variants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.09, delayChildren: 0.02 } },
};
