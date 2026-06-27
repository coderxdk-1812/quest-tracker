import { describe, it, expect } from 'vitest';
import { buildShareText, buildShareSvg, type ShareStats } from './shareCard';

const s: ShareStats = {
  displayName: 'Alex', level: 12, rankTitle: 'Adept', rankHsl: '200 75% 52%',
  streak: 14, tasksCompleted: 120, focusSessions: 33, milestonesReached: 6,
};

describe('shareCard', () => {
  it('builds a text blurb containing the headline stats', () => {
    const t = buildShareText(s);
    expect(t).toContain('Adept');
    expect(t).toContain('Level 12');
    expect(t).toContain('14-day streak');
  });
  it('builds valid self-contained SVG markup', () => {
    const svg = buildShareSvg(s);
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect(svg).toContain('Adept');
    expect(svg).toContain('120');
  });
  it('escapes unsafe characters in the name', () => {
    const svg = buildShareSvg({ ...s, displayName: 'A<b>&c' });
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&amp;');
  });
});
