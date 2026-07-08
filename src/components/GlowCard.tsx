import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  /** HSL triplet (e.g. "265 70% 58%"), defaults to the theme's --primary. */
  glowHsl?: string;
}

/**
 * Glass card with a radial glow anchored to one corner — visible at rest,
 * intensifying on hover/focus (spec: personality redesign signature
 * component). Used for milestone/mastery cards instead of a flat glass-card,
 * so progress feels a touch more alive without adding new motion to track.
 * The intensify transition is gated to prefers-reduced-motion: no-preference
 * (see .glow-card-blob in index.css); the resting glow itself is static, not
 * motion, so it stays visible either way.
 */
export function GlowCard({ children, className, glowHsl }: GlowCardProps) {
  return (
    <div className={cn('glass-card relative overflow-hidden group', className)}>
      <div
        className="glow-card-blob pointer-events-none absolute -top-14 -right-14 w-52 h-52 rounded-full blur-3xl opacity-20 group-hover:opacity-35 group-focus-within:opacity-35"
        style={{ background: glowHsl ? `hsl(${glowHsl})` : 'hsl(var(--primary))' }}
        aria-hidden="true"
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export default GlowCard;
