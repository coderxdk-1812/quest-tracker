import { Sprout, Leaf, Star, Award, Crown, Gem, Flame, type LucideIcon } from 'lucide-react';
import { getRank, type Rank } from '@/lib/progression';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  sprout: Sprout, leaf: Leaf, star: Star, award: Award, crown: Crown, gem: Gem, flame: Flame,
};

export function rankIcon(rank: Rank): LucideIcon {
  return ICONS[rank.icon] ?? Star;
}

interface RankBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  showTitle?: boolean;
  className?: string;
}

/** A coloured pill showing the user's current rank (icon + optional title). */
export function RankBadge({ level, size = 'md', showTitle = true, className }: RankBadgeProps) {
  const rank = getRank(level);
  const Icon = rankIcon(rank);
  const color = `hsl(${rank.hsl})`;
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-3 py-1 text-xs';
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5';

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full font-bold border', pad, className)}
      style={{ color, borderColor: color, backgroundColor: `hsl(${rank.hsl} / 0.12)` }}
    >
      <Icon className={iconSize} />
      {showTitle && <span>{rank.title}</span>}
    </span>
  );
}

export default RankBadge;
