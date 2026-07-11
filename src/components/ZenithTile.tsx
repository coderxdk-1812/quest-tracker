import { useId } from 'react';

interface ZenithTileProps {
  size?: number;
  className?: string;
}

/**
 * Standalone square logo mark (gradient tile, no wordmark) — for spots that
 * show just the icon, like the collapsed sidebar or the loading screen. The
 * gradient reads live from the active theme's --primary/--accent tokens, so
 * it recolors with every theme switch. Gradient id is unique per instance
 * via useId so multiple mounts on one page never collide.
 */
export function ZenithTile({ size = 40, className }: ZenithTileProps) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 260 260"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Zenith"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(var(--primary))" />
          <stop offset="1" stopColor="hsl(var(--accent))" />
        </linearGradient>
      </defs>
      <rect x="20" y="20" width="220" height="220" rx="60" fill={`url(#${gradientId})`} />
      <g transform="translate(20 20) scale(0.4297)">
        <path
          d="M120 380 L256 188 L392 380"
          fill="none"
          stroke="#ffffff"
          strokeWidth="50"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M192 380 L256 286 L320 380"
          fill="none"
          stroke="#ffffff"
          strokeOpacity="0.42"
          strokeWidth="30"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M256 64 Q268 108 312 120 Q268 132 256 176 Q244 132 200 120 Q244 108 256 64 Z" fill="#ffffff" />
      </g>
    </svg>
  );
}

export default ZenithTile;
