import { motion } from 'framer-motion';
import { useCountUp } from '@/hooks/useCountUp';

interface LevelRingProps {
  level: number;
  /** 0..100 progress to next level. */
  progress: number;
  size?: number;
  /** HSL triplet for the ring fill. */
  hsl?: string;
}

/** Circular XP ring with the level number in the centre. */
export function LevelRing({ level, progress, size = 72, hsl = '145 63% 42%' }: LevelRingProps) {
  const stroke = Math.max(5, Math.round(size * 0.09));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, progress));
  const offset = c - (pct / 100) * c;
  const color = `hsl(${hsl})`;
  const displayLevel = useCountUp(level);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">Lvl</span>
        <span className="font-display font-bold leading-none tabular-nums" style={{ fontSize: size * 0.32 }}>{displayLevel}</span>
      </div>
    </div>
  );
}

export default LevelRing;
