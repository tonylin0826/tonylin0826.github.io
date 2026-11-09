import { describe, expect, it } from 'vitest';
import sample from '../../docs/manifest.sample.json';
import {
  buildTimeline,
  framePath,
  ManifestError,
  parseManifest,
  resolveHeroFrame,
  type FramesManifest,
} from './manifest';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
const clone = (): Json => structuredClone(sample);

function problems(mutate: (m: Json) => void): string[] {
  const m = clone();
  mutate(m);
  try {
    parseManifest(m);
  } catch (e) {
    expect(e).toBeInstanceOf(ManifestError);
    return [...(e as ManifestError).problems];
  }
  throw new Error('expected parseManifest to throw');
}

const has = (list: string[], needle: string) => list.some((p) => p.includes(needle));

describe('parseManifest', () => {
  it('accepts the sample manifest', () => {
    const m = parseManifest(sample);
    expect(m.clips).toHaveLength(3);
    expect(m.heroes).toEqual(['badminton', 'golf', 'dogs', 'engineer']);
  });

  it('rejects non-objects', () => {
    expect(() => parseManifest(null)).toThrow(ManifestError);
    expect(() => parseManifest([])).toThrow(ManifestError);
  });

  it('rejects wrong version', () => {
    expect(has(problems((m) => { m.version = 2; }), '$.version')).toBe(true);
  });

  it('rejects bad format', () => {
    expect(has(problems((m) => { m.format = 'png'; }), '$.format')).toBe(true);
  });

  it('rejects bad fps and background', () => {
    const p = problems((m) => { m.fps = 0; m.background = 'grey'; });
    expect(has(p, '$.fps')).toBe(true);
    expect(has(p, '$.background')).toBe(true);
  });

  it('rejects zero, negative, fractional and odd dimensions', () => {
    const p = problems((m) => {
      m.clips[0].variants.desktop.width = 0;
      m.clips[0].variants.desktop.height = 1081;
      m.clips[0].variants.mobile.width = 810.5;
    });
    expect(has(p, 'clips[0].variants.desktop.width')).toBe(true);
    expect(p.find((x) => x.includes('desktop.height'))).toMatch(/even/);
    expect(has(p, 'clips[0].variants.mobile.width')).toBe(true);
  });

  it('rejects frameCount < 1', () => {
    const p = problems((m) => { m.clips[1].variants.mobile.frameCount = 0; });
    expect(has(p, '$.clips[1].variants.mobile.frameCount')).toBe(true);
  });

  it('rejects patterns without (or with malformed/multiple) frame tokens', () => {
    const p = problems((m) => {
      m.clips[0].variants.desktop.pathPattern = 'a/b.webp';
      m.clips[0].variants.mobile.pathPattern = 'a/{frame}/{frame:04}.webp';
      m.clips[1].variants.desktop.pathPattern = 'a/{frame:4}.webp';
      m.clips[1].variants.mobile.pathPattern = '../x/{frame:04}.webp';
    });
    expect(has(p, 'clips[0].variants.desktop.pathPattern')).toBe(true);
    expect(has(p, 'clips[0].variants.mobile.pathPattern')).toBe(true);
    expect(has(p, 'clips[1].variants.desktop.pathPattern')).toBe(true);
    expect(has(p, 'clips[1].variants.mobile.pathPattern')).toBe(true);
  });

  it('rejects a chain mismatch between clips', () => {
    const p = problems((m) => { m.clips[1].from = 'tennis'; });
    expect(has(p, '$.clips[1].from')).toBe(true);
  });

  it('rejects heroes that differ from the clip chain', () => {
    const p = problems((m) => { m.heroes = ['badminton', 'golf', 'oreo', 'engineer']; });
    expect(has(p, '$.heroes: must equal')).toBe(true);
  });

  it('rejects duplicate clip ids', () => {
    const p = problems((m) => { m.clips[2].id = m.clips[0].id; });
    expect(has(p, '$.clips[2].id: duplicate')).toBe(true);
  });

  it('rejects posters that are not valid frame paths', () => {
    const p = problems((m) => {
      m.clips[0].poster.desktop = 'nope.webp';
      m.clips[0].poster.mobile = 't1-badminton-golf/mobile/0061.webp'; // beyond 60 frames
      m.clips[1].poster.desktop = 't2-golf-dogs/desktop/1.webp'; // wrong padding
    });
    expect(has(p, 'clips[0].poster.desktop')).toBe(true);
    expect(has(p, 'clips[0].poster.mobile')).toBe(true);
    expect(has(p, 'clips[1].poster.desktop')).toBe(true);
  });

  it('rejects unknown variants and missing variants', () => {
    const p = problems((m) => {
      m.clips[0].variants.tablet = m.clips[0].variants.mobile;
      delete m.clips[1].variants.mobile;
    });
    expect(has(p, 'clips[0].variants.tablet: unknown variant')).toBe(true);
    expect(has(p, 'clips[1].variants.mobile: missing')).toBe(true);
  });

  it('rejects bad heroFrames', () => {
    const p = problems((m) => {
      m.clips[0].heroFrames = { start: 0, end: 999 };
      m.clips[1].heroFrames = { start: 'last', end: 2 };
    });
    expect(has(p, 'clips[0].heroFrames.start')).toBe(true);
    expect(has(p, 'clips[0].heroFrames.end')).toBe(true);
    expect(has(p, 'clips[1].heroFrames: start must be <= end')).toBe(true);
  });

  it('reports ALL problems at once', () => {
    const p = problems((m) => {
      m.version = 9;
      m.format = 'gif';
      m.clips[0].variants.desktop.frameCount = 0;
      m.clips[2].id = m.clips[1].id;
    });
    expect(p.length).toBeGreaterThanOrEqual(4);
    try {
      parseManifest({ ...clone(), version: 9, format: 'gif' });
    } catch (e) {
      expect((e as Error).message).toContain('$.version');
      expect((e as Error).message).toContain('$.format');
    }
  });
});

describe('framePath', () => {
  const v = (pathPattern: string, frameCount = 120) => ({ pathPattern, frameCount });

  it('pads to 4 digits with {frame:04}', () => {
    expect(framePath(v('a/{frame:04}.webp'), 1)).toBe('a/0001.webp');
    expect(framePath(v('a/{frame:04}.webp'), 120)).toBe('a/0120.webp');
  });

  it('supports generic widths and unpadded {frame}', () => {
    expect(framePath(v('a/{frame:03}.webp'), 7)).toBe('a/007.webp');
    expect(framePath(v('a/{frame:06}.webp', 99999), 12345)).toBe('a/012345.webp');
    expect(framePath(v('a/{frame}.webp'), 7)).toBe('a/7.webp');
  });

  it('does not truncate numbers wider than the padding', () => {
    expect(framePath(v('a/{frame:02}.webp'), 100)).toBe('a/100.webp');
  });

  it('rejects out-of-range frames', () => {
    expect(() => framePath(v('a/{frame:04}.webp', 10), 0)).toThrow(RangeError);
    expect(() => framePath(v('a/{frame:04}.webp', 10), 11)).toThrow(RangeError);
    expect(() => framePath(v('a/{frame:04}.webp', 10), 1.5)).toThrow(RangeError);
  });
});

describe('resolveHeroFrame', () => {
  it('resolves "last" and numbers', () => {
    expect(resolveHeroFrame('last', 120)).toBe(120);
    expect(resolveHeroFrame(1, 120)).toBe(1);
    expect(resolveHeroFrame(60, 60)).toBe(60);
  });
  it('throws when out of range', () => {
    expect(() => resolveHeroFrame(0, 10)).toThrow(RangeError);
    expect(() => resolveHeroFrame(11, 10)).toThrow(RangeError);
  });
});

describe('buildTimeline', () => {
  const manifest = parseManifest(sample) as FramesManifest;

  it('de-duplicates shared boundary frames (desktop)', () => {
    const t = buildTimeline(manifest, 'desktop');
    expect(t.frames).toHaveLength(120 + 119 + 119);
    expect(t.frames[0]).toEqual({ clipId: 't1-badminton-golf', frame: 1, path: 't1-badminton-golf/desktop/0001.webp' });
    // boundary: last frame of t1 is followed directly by frame 2 of t2
    expect(t.frames[119]).toMatchObject({ clipId: 't1-badminton-golf', frame: 120 });
    expect(t.frames[120]).toMatchObject({ clipId: 't2-golf-dogs', frame: 2, path: 't2-golf-dogs/desktop/0002.webp' });
    expect(t.frames.at(-1)).toMatchObject({ clipId: 't3-dogs-engineer', frame: 120 });
    expect(t.frames.some((f) => f.clipId !== 't1-badminton-golf' && f.frame === 1)).toBe(false);
    expect(new Set(t.frames.map((f) => f.path)).size).toBe(t.frames.length);
  });

  it('uses the mobile variant paths and counts', () => {
    const t = buildTimeline(manifest, 'mobile');
    expect(t.variant).toBe('mobile');
    expect(t.frames).toHaveLength(60 + 59 + 59);
    expect(t.frames[0]?.path).toBe('t1-badminton-golf/mobile/0001.webp');
  });

  it('computes hero indices', () => {
    const t = buildTimeline(manifest, 'desktop');
    expect(t.heroIndex).toEqual({ badminton: 0, golf: 119, dogs: 238, engineer: 357 });
    for (const [id, idx] of Object.entries(t.heroIndex)) {
      expect(manifest.heroes).toContain(id);
      expect(t.frames[idx]).toBeDefined();
    }
    expect(Object.keys(t.heroIndex)).toEqual(expect.arrayContaining(manifest.heroes));
    // the shared boundary frame is the last frame of the previous clip
    expect(t.frames[t.heroIndex.golf!]).toMatchObject({ clipId: 't1-badminton-golf', frame: 120 });
  });

  it('honours custom heroFrames.end', () => {
    const m = clone();
    m.clips[0].heroFrames = { start: 1, end: 50 }; // must fit the smallest variant (mobile: 60)
    const t = buildTimeline(parseManifest(m), 'desktop');
    expect(t.heroIndex.golf).toBe(49);
  });

  it('handles a single clip', () => {
    const m = clone();
    m.clips = [m.clips[0]];
    m.heroes = ['badminton', 'golf'];
    const t = buildTimeline(parseManifest(m), 'mobile');
    expect(t.frames).toHaveLength(60);
    expect(t.heroIndex).toEqual({ badminton: 0, golf: 59 });
  });
});
