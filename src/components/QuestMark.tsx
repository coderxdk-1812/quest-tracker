import { cn } from '@/lib/utils';

interface QuestMarkProps {
  size?: number;
  className?: string;
}

/**
 * Signature motif — the "Q" mark with a barely-there partial ring around it,
 * echoing LevelRing without calling attention to itself. Used consistently
 * wherever the app identifies itself: sidebar, loading screen, auth page.
 * Static — no spin, no pulse; personality here comes from the shape, not motion.
 */
export function QuestMark({ size = 40, className }: QuestMarkProps) {
  const stroke = Math.max(2, Math.round(size * 0.055));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arcPct = 0.72;

  return (
    <div className={cn('relative shrink-0 inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="hsl(var(--primary) / 0.12)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - arcPct * c}
        />
      </svg>
      <div
        className="rounded-xl xp-gradient flex items-center justify-center text-primary-foreground font-bold shrink-0"
        style={{ width: size * 0.8, height: size * 0.8, fontSize: size * 0.4 }}
      >
        Q
      </div>
    </div>
  );
}

export default QuestMark;
