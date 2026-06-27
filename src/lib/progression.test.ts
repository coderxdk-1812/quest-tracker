import { describe, it, expect } from 'vitest';
import { getRank, getNextRank, rankProgress, levelFromXp, RANKS } from './progression';

describe('progression', () => {
  it('maps levels to the correct rank band', () => {
    expect(getRank(1).id).toBe('novice');
    expect(getRank(4).id).toBe('novice');
    expect(getRank(5).id).toBe('apprentice');
    expect(getRank(10).id).toBe('adept');
    expect(getRank(20).id).toBe('expert');
    expect(getRank(35).id).toBe('master');
    expect(getRank(50).id).toBe('grandmaster');
    expect(getRank(80).id).toBe('legend');
  });

  it('derives level from xp consistently with GameContext', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(450)).toBe(5);
  });

  it('reports next rank and caps at legend', () => {
    expect(getNextRank(1)?.id).toBe('apprentice');
    expect(getNextRank(80)).toBeNull();
  });

  it('computes monotonic, bounded rank progress', () => {
    const a = rankProgress(5);   // start of apprentice
    const b = rankProgress(9);   // end of apprentice band
    expect(a.pct).toBeLessThan(b.pct);
    expect(a.pct).toBeGreaterThanOrEqual(0);
    expect(b.pct).toBeLessThanOrEqual(100);
    expect(rankProgress(80).pct).toBe(100);
    expect(rankProgress(80).levelsToNext).toBe(0);
  });

  it('every rank has a unique ascending minLevel', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minLevel).toBeGreaterThan(RANKS[i - 1].minLevel);
    }
  });
});
