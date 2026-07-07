import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';
import { prefersReducedMotion } from '@/lib/utils';

/**
 * Numbers that feel earned (spec: personality layer 3d) — animates the displayed
 * value from whatever it last was toward `value` whenever it changes, instead of
 * snapping instantly. Collapses to an instant snap under prefers-reduced-motion.
 */
export function useCountUp(value: number, duration = 0.6): number {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prefersReducedMotion()) {
      prevRef.current = value;
      setDisplay(value);
      return;
    }
    const from = prevRef.current;
    prevRef.current = value;
    if (from === value) return;

    const controls = animate(from, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, duration]);

  return display;
}
