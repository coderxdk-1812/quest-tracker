interface ZenithMonoMarkProps {
  size?: number;
  className?: string;
}

/**
 * Flat currentColor mark — for surfaces where the gradient tile would clash
 * (dark cards, colored badges). Render inside an element with the text color
 * you want it drawn in.
 */
export function ZenithMonoMark({ size = 40, className }: ZenithMonoMarkProps) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Zenith"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M120 380 L256 188 L392 380"
        fill="none"
        stroke="currentColor"
        strokeWidth="50"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M192 380 L256 286 L320 380"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeWidth="30"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M256 64 Q268 108 312 120 Q268 132 256 176 Q244 132 200 120 Q244 108 256 64 Z" fill="currentColor" />
    </svg>
  );
}

export default ZenithMonoMark;
