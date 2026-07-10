/**
 * Shareable accomplishment card (Phase 5, spec §6).
 *
 * Pure builders for (a) a share text blurb and (b) a self-contained SVG users can
 * download and post externally. No dependencies, no fonts to load — renders anywhere.
 */

export interface ShareStats {
  displayName: string;
  level: number;
  rankTitle: string;
  rankHsl: string;       // "H S% L%"
  streak: number;
  tasksCompleted: number;
  focusSessions: number;
  milestonesReached: number;
}

/** A concise, proud one-liner for clipboard / social captions. */
export function buildShareText(s: ShareStats): string {
  return (
    `🏆 ${s.displayName} — ${s.rankTitle} (Level ${s.level}) on Zenith\n` +
    `🔥 ${s.streak}-day streak · ✅ ${s.tasksCompleted} tasks mastered · ` +
    `🧠 ${s.focusSessions} focus sessions · 🎯 ${s.milestonesReached} milestones`
  );
}

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A standalone 600×315 social card as an SVG string (downloadable, theme-independent). */
export function buildShareSvg(s: ShareStats): string {
  const accent = `hsl(${s.rankHsl})`;
  const name = esc(s.displayName).slice(0, 28);
  const stat = (label: string, value: string | number, x: number) => `
    <text x="${x}" y="232" fill="#fff" font-size="34" font-weight="700" text-anchor="middle" font-family="Arial, sans-serif">${value}</text>
    <text x="${x}" y="258" fill="#9aa0aa" font-size="14" text-anchor="middle" font-family="Arial, sans-serif">${label}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="315" viewBox="0 0 600 315">
  <rect width="600" height="315" rx="20" fill="#0e1116"/>
  <rect x="0" y="0" width="600" height="6" rx="3" fill="${accent}"/>
  <g transform="translate(40,40) scale(0.035)" fill="none" stroke="#ffffff">
    <path d="M120 380 L256 188 L392 380" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M192 380 L256 286 L320 380" stroke-opacity="0.42" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M256 64 Q268 108 312 120 Q268 132 256 176 Q244 132 200 120 Q244 108 256 64 Z" fill="#ffffff" stroke="none"/>
  </g>
  <text x="65" y="58" fill="#6b7280" font-size="15" letter-spacing="2" font-family="Arial, sans-serif">ZENITH</text>
  <text x="40" y="108" fill="#ffffff" font-size="40" font-weight="800" font-family="Arial, sans-serif">${name}</text>
  <g>
    <rect x="40" y="128" width="${Math.min(360, 150 + s.rankTitle.length * 16)}" height="40" rx="20" fill="${accent}" opacity="0.18"/>
    <text x="62" y="155" fill="${accent}" font-size="22" font-weight="700" font-family="Arial, sans-serif">${esc(s.rankTitle)} · Level ${s.level}</text>
  </g>
  <line x1="40" y1="190" x2="560" y2="190" stroke="#222831" stroke-width="1"/>
  ${stat('Day streak', s.streak, 110)}
  ${stat('Tasks', s.tasksCompleted, 250)}
  ${stat('Focus', s.focusSessions, 390)}
  ${stat('Milestones', s.milestonesReached, 525)}
  <text x="40" y="298" fill="#4b5563" font-size="13" font-family="Arial, sans-serif">Earned through consistent, focused study.</text>
</svg>`;
}
