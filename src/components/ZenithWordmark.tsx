import { useId } from 'react';

interface ZenithWordmarkProps {
  height?: number;
  className?: string;
}

/**
 * Horizontal lockup (gradient tile + "Zenith" text). The text uses currentColor so it
 * stays legible across themes/light/dark — render this inside an element with the
 * text color you want (e.g. text-foreground). Gradient id is unique per instance via
 * useId so multiple mounts on one page never collide.
 */
export function ZenithWordmark({ height = 40, className }: ZenithWordmarkProps) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 920 260"
      height={height}
      className={className}
      role="img"
      aria-label="Zenith"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#F59E0B" />
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
      <text
        x="286"
        y="172"
        fontFamily="Inter, ui-sans-serif, system-ui, sans-serif"
        fontSize="150"
        fontWeight="700"
        letterSpacing="-4"
        fill="currentColor"
      >
        Zenith
      </text>
    </svg>
  );
}

export default ZenithWordmark;
