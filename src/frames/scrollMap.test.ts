import { describe, expect, it } from 'vitest';
import { buildTimeline, parseManifest, type Timeline } from './manifest';
import { buildScrollMap } from './scrollMap';
import sample from '../../docs/manifest.sample.json';

const manifest = parseManifest(sample);

function fakeTimeline(heroIndex: Record<string, number>, total: number): Timeline {
  return {
    variant: 'desktop',
    heroIndex,
    frames: Array.from({ length: total }, (_, i) => ({ clipId: 'c', frame: i + 1, path: `${i}.webp` })),
  };
}

describe('buildScrollMap (synthetic)', () => {
  // heroes at 0, 100, 200 -> two transitions of 100 frames; hold = 0.5 * 100 = 50 each
  const tl = fakeTimeline({ a: 0, b: 100, c: 200 }, 201);
  const map = buildScrollMap(tl, { holdWeight: 0.5 });

  it('alternates hold / transition and covers 0..1 contiguously', () => {
    expect(map.segments.map((s) => s.type)).toEqual(['hold', 'transition', 'hold', 'transition', 'hold']);
    expect(map.segments[0]!.startProgress).toBe(0);
    expect(map.segments.at(-1)!.endProgress).toBe(1);
    for (let i = 1; i < map.segments.length; i++) {
      expect(map.segments[i]!.startProgress).toBeCloseTo(map.segments[i - 1]!.endProgress, 12);
    }
  });

  it('weights holds vs transitions (3 holds of 50, 2 transitions of 100 => total 350)', () => {
    expect(map.segments[0]!.endProgress).toBeCloseTo(50 / 350, 10);
    expect(map.segments[1]!.endProgress).toBeCloseTo(150 / 350, 10);
  });

  it('holds at the hero frame, transitions interpolate', () => {
    expect(map.indexAt(0)).toBe(0);
    expect(map.indexAt(0.1)).toBe(0); // inside first hold
    const mid = (map.segments[1]!.startProgress + map.segments[1]!.endProgress) / 2;
    expect(map.indexAt(mid)).toBe(50);
    expect(map.indexAt(map.segments[2]!.startProgress + 0.01)).toBe(100);
    expect(map.indexAt(1)).toBe(200);
  });

  it('clamps out-of-range and non-finite progress', () => {
    expect(map.indexAt(-5)).toBe(0);
    expect(map.indexAt(7)).toBe(200);
    expect(map.indexAt(NaN)).toBe(0);
  });

  it('is monotonic', () => {
    let prev = -1;
    for (let i = 0; i <= 1000; i++) {
      const idx = map.indexAt(i / 1000);
      expect(idx).toBeGreaterThanOrEqual(prev);
      prev = idx;
    }
  });

  it('progressForHero is the centre of the hold', () => {
    const h = map.holdFor('b')!;
    expect(map.progressForHero('b')).toBeCloseTo((h.startProgress + h.endProgress) / 2, 12);
    expect(map.indexAt(map.progressForHero('b')!)).toBe(100);
    expect(map.progressForHero('nope')).toBeUndefined();
  });

  it('holdWeight 0 gives zero-length holds but still maps frames', () => {
    const m = buildScrollMap(tl, { holdWeight: 0 });
    expect(m.indexAt(0)).toBe(0);
    expect(m.indexAt(1)).toBe(200);
  });

  it('single hero: one hold', () => {
    const m = buildScrollMap(fakeTimeline({ solo: 3 }, 10));
    expect(m.segments).toHaveLength(1);
    expect(m.indexAt(0.5)).toBe(3);
  });

  it('orders heroes by frame index regardless of key order', () => {
    const m = buildScrollMap(fakeTimeline({ z: 20, y: 0, x: 10 }, 21));
    expect(m.segments.filter((s) => s.type === 'hold').map((s) => s.heroId)).toEqual(['y', 'x', 'z']);
  });
});

describe('buildScrollMap (sample manifest)', () => {
  for (const variant of ['desktop', 'mobile'] as const) {
    it(`${variant}: 4 heroes -> 7 segments, hero holds land on hero frames`, () => {
      const tl = buildTimeline(manifest, variant);
      const map = buildScrollMap(tl);
      expect(map.segments).toHaveLength(7);
      for (const [hero, idx] of Object.entries(tl.heroIndex)) {
        expect(map.indexAt(map.progressForHero(hero)!)).toBe(idx);
      }
      expect(map.indexAt(1)).toBe(tl.heroIndex[manifest.heroes.at(-1)!]);
    });
  }
});
