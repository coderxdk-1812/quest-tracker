import { useId } from 'react';

/**
 * Haikei-style organic blob background for the dashboard hero (spec: personality
 * "premium redesign" — hero moment). Paths are plain geometry generated once via
 * the haikei-backgrounds skill's circularly-smoothed-noise technique; fills use
 * theme CSS vars (not baked-in hex) so this automatically matches whichever of
 * the 6 themes + light/dark mode is active, the same way AuroraBackground does.
 * Purely decorative (aria-hidden); drift animation is gated to
 * prefers-reduced-motion: no-preference the same way the rest of the app's
 * ambient motion is.
 */
export function HeroBlobBackground() {
  const uid = useId().replace(/[:]/g, '');
  const blurId = `hero-blob-blur-${uid}`;

  return (
    <svg
      viewBox="0 0 1200 420"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full"
      aria-hidden="true"
    >
      <defs>
        <filter id={blurId} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="46" />
        </filter>
      </defs>
      <g filter={`url(#${blurId})`}>
        <path
          className="hero-blob hero-blob-1"
          d="M 473.67,257.82 C 472.36,280.46 461.92,305.76 448.34,322.90 C 434.76,340.04 412.65,354.44 392.18,360.66 C 371.70,366.88 345.53,366.86 325.49,360.23 C 305.44,353.61 284.41,337.98 271.92,320.91 C 259.43,303.85 251.08,279.23 250.55,257.82 C 250.03,236.41 256.78,211.05 268.77,192.44 C 280.75,173.82 301.28,154.28 322.47,146.13 C 343.66,137.97 373.63,136.68 395.91,143.50 C 418.19,150.32 443.20,168.01 456.16,187.06 C 469.12,206.11 474.97,235.18 473.67,257.82 Z"
          style={{ fill: 'hsl(var(--primary))', opacity: 0.22 }}
        />
        <path
          className="hero-blob hero-blob-2"
          d="M 961.44,333.41 C 963.42,353.56 958.31,380.40 947.15,397.67 C 935.99,414.94 913.68,430.07 894.48,437.02 C 875.27,443.97 850.76,444.00 831.93,439.36 C 813.09,434.73 794.51,422.30 781.48,409.21 C 768.45,396.12 757.74,377.85 753.77,360.83 C 749.79,343.82 751.88,323.02 757.63,307.12 C 763.38,291.22 775.44,275.76 788.24,265.42 C 801.05,255.07 818.12,248.01 834.46,245.06 C 850.80,242.12 869.47,242.47 886.28,247.76 C 903.08,253.04 922.76,262.50 935.29,276.77 C 947.82,291.05 959.47,313.26 961.44,333.41 Z"
          style={{ fill: 'hsl(var(--ring))', opacity: 0.16 }}
        />
        <path
          className="hero-blob hero-blob-3"
          d="M 504.18,216.94 C 504.93,251.32 483.76,300.66 456.68,322.91 C 429.61,345.15 375.75,358.46 341.72,350.40 C 307.68,342.35 266.93,306.24 252.48,274.59 C 238.02,242.94 239.72,190.61 255.00,160.51 C 270.27,130.41 311.26,101.32 344.12,94.01 C 376.98,86.69 425.50,96.14 452.17,116.63 C 478.85,137.12 503.43,182.56 504.18,216.94 Z"
          style={{ fill: 'hsl(var(--accent))', opacity: 0.12 }}
        />
      </g>
    </svg>
  );
}

export default HeroBlobBackground;
