import { describe, expect, it } from 'vitest';
import { buildScrollMap } from '../frames/scrollMap';
import type { Timeline } from '../frames/manifest';
import { isHeroActive, resolveHeroId, scrollYForProgress } from './panels';

const tl: Timeline = {
  variant: 'desktop',
  heroIndex: { a: 0, b: 10, c: 20 },
  frames: Array.from({ length: 21 }, (_, i) => ({ clipId: 'x', frame: i + 1, path: `${i}` })),
};
const map = buildScrollMap(tl);
const heroes = ['a', 'b', 'c'];

describe('resolveHeroId', () => {
  it('data-hero wins when known', () => {
    expect(resolveHeroId({ hero: 'b' }, heroes)).toBe('b');
    expect(resolveHeroId({ hero: 'zzz' }, heroes)).toBeUndefined();
  });
  it('data-at start/end', () => {
    expect(resolveHeroId({ at: 'start' }, heroes)).toBe('a');
    expect(resolveHeroId({ at: 'end' }, heroes)).toBe('c');
    expect(resolveHeroId({ at: 'middle' }, heroes)).toBeUndefined();
    expect(resolveHeroId({}, heroes)).toBeUndefined();
  });
});

describe('isHeroActive', () => {
  it('active only inside its hold', () => {
    expect(isHeroActive(map, 'a', 0)).toBe(true);
    expect(isHeroActive(map, 'b', 0)).toBe(false);
    expect(isHeroActive(map, 'b', map.progressForHero('b')!)).toBe(true);
    expect(isHeroActive(map, 'c', 1)).toBe(true);
    expect(isHeroActive(map, 'a', 1)).toBe(false);
  });
  it('exactly one hero active at each hold centre; none mid-transition', () => {
    for (const h of heroes) {
      const p = map.progressForHero(h)!;
      expect(heroes.filter((x) => isHeroActive(map, x, p))).toEqual([h]);
    }
    const t = map.segments.find((s) => s.type === 'transition')!;
    const mid = (t.startProgress + t.endProgress) / 2;
    expect(heroes.some((x) => isHeroActive(map, x, mid))).toBe(false);
  });
  it('unknown hero is never active', () => {
    expect(isHeroActive(map, undefined, 0.5)).toBe(false);
    expect(isHeroActive(map, 'nope', 0.5)).toBe(false);
  });
});

describe('scrollYForProgress', () => {
  it('maps progress across (trackHeight - viewport)', () => {
    expect(scrollYForProgress(100, 5000, 1000, 0)).toBe(100);
    expect(scrollYForProgress(100, 5000, 1000, 0.5)).toBe(2100);
    expect(scrollYForProgress(100, 5000, 1000, 1)).toBe(4100);
    expect(scrollYForProgress(0, 500, 1000, 1)).toBe(0);
  });
});
