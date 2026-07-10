import { ReactNode, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { prefersReducedMotion } from '@/lib/utils';

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  /** Max tilt in degrees. Kept subtle — a hint of depth, not a gimmick. */
  maxTilt?: number;
}

/** Hero-only cursor tilt. One signature "responds to you" moment, not a pattern to repeat everywhere. */
export function TiltCard({ children, className, maxTilt = 4 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const springPx = useSpring(px, { stiffness: 250, damping: 25 });
  const springPy = useSpring(py, { stiffness: 250, damping: 25 });
  const rotateX = useTransform(springPy, [0, 1], [maxTilt, -maxTilt]);
  const rotateY = useTransform(springPx, [0, 1], [-maxTilt, maxTilt]);

  if (prefersReducedMotion()) return <div className={className}>{children}</div>;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  };

  const handleMouseLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
}

export default TiltCard;
