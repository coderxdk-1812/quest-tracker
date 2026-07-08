import { cn } from '@/lib/utils';

interface QuestMarkProps {
  size?: number;
  className?: string;
  /** Slow idle spin for the ring — used on the loading screen only, not persistent nav. */
  spin?: boolean;
}

/**
 * Signature motif (spec: personality redesign) — the "Q" mark with a thin partial
 * ring around it, visually rhyming with LevelRing (the app's core progression
 * symbol) so the brand mark and the leveling-up mechanic read as one idea rather
 * than an arbitrary logo. Used consistently wherever the app identifies itself:
 * sidebar, loading screen, auth page. Not a mascot — just a quiet recurring shape.
 */
export function QuestMark({ size = 40, className, spin = false }: QuestMarkProps) {
  const stroke = Math.max(2, Math.round(size * 0.055));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arcPct = 0.72;

  return (
    <div className={cn('relative shrink-0 inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className={cn('absolute inset-0 -rotate-90', spin && 'quest-mark-spin')}>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="hsl(var(--primary) / 0.3)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - arcPct * c}
        />
      </svg>
      <div
        className="rounded-xl xp-gradient flex items-center justify-center text-primary-foreground font-display font-bold shrink-0"
        style={{ width: size * 0.8, height: size * 0.8, fontSize: size * 0.4 }}
      >
        Q
      </div>
    </div>
  );
}

export default QuestMark;
