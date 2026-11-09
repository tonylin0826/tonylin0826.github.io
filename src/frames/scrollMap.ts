/**
 * Maps scroll progress (0..1) to a timeline frame index, with hold segments at each hero.
 * Layout: hold(h0), transition(h0->h1), hold(h1), ..., hold(hLast).
 * Pure; no DOM.
 */
import type { Timeline } from './manifest';

export interface ScrollSegment {
  type: 'hold' | 'transition';
  /** Set for holds. */
  heroId?: string;
  /** Set for transitions: the heroes at either end. */
  fromHeroId?: string;
  toHeroId?: string;
  /** Clip the segment's frames belong to (for transitions: the clip of the first frame played). */
  clipId?: string;
  startProgress: number;
  endProgress: number;
  startIndex: number;
  endIndex: number;
}

export interface ScrollMapOptions {
  /** Hold length as a fraction of the average transition weight (frame count). Default 0.6. */
  holdWeight?: number;
}

export interface ScrollMap {
  segments: ScrollSegment[];
  /** Integer timeline frame index for a progress value (clamped to 0..1). */
  indexAt(progress: number): number;
  /** Segment containing the progress (last segment at exactly 1). */
  segmentAt(progress: number): ScrollSegment;
  /** Progress at the centre of the hero's hold segment, or undefined if unknown hero. */
  progressForHero(heroId: string): number | undefined;
  /** Hold segment for a hero. */
  holdFor(heroId: string): ScrollSegment | undefined;
}

export function buildScrollMap(timeline: Timeline, opts: ScrollMapOptions = {}): ScrollMap {
  const holdWeight = Math.max(0, opts.holdWeight ?? 0.6);
  // Heroes in scroll order = ascending frame index (stable for ties).
  const heroes = Object.entries(timeline.heroIndex)
    .map(([id, index], order) => ({ id, index, order }))
    .sort((a, b) => a.index - b.index || a.order - b.order);

  const transitions: { from: (typeof heroes)[number]; to: (typeof heroes)[number]; weight: number }[] = [];
  for (let i = 0; i + 1 < heroes.length; i++) {
    const from = heroes[i]!;
    const to = heroes[i + 1]!;
    transitions.push({ from, to, weight: to.index - from.index });
  }
  const transTotal = transitions.reduce((s, t) => s + t.weight, 0);
  const avg = transitions.length ? transTotal / transitions.length : 0;
  // Fall back to a unit weight so a single hero (or all-equal indices) still has a hold.
  const hold = avg > 0 ? avg * holdWeight : 1;

  type Raw = Omit<ScrollSegment, 'startProgress' | 'endProgress'> & { weight: number };
  const raw: Raw[] = [];
  heroes.forEach((h, i) => {
    raw.push({
      type: 'hold', heroId: h.id, weight: hold,
      startIndex: h.index, endIndex: h.index,
      clipId: timeline.frames[h.index]?.clipId,
    });
    const t = transitions[i];
    if (t && t.weight > 0) {
      raw.push({
        type: 'transition', fromHeroId: t.from.id, toHeroId: t.to.id, weight: t.weight,
        startIndex: t.from.index, endIndex: t.to.index,
        clipId: timeline.frames[t.from.index + 1]?.clipId ?? timeline.frames[t.from.index]?.clipId,
      });
    }
  });

  const total = raw.reduce((s, r) => s + r.weight, 0) || 1;
  let acc = 0;
  const segments: ScrollSegment[] = raw.map(({ weight, ...r }, i) => {
    const startProgress = acc / total;
    acc += weight;
    const endProgress = i === raw.length - 1 ? 1 : acc / total;
    return { ...r, startProgress, endProgress };
  });

  const clamp01 = (p: number) => (Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0);

  function segmentAt(progress: number): ScrollSegment {
    const p = clamp01(progress);
    // Few segments (<= ~7): linear scan is fine.
    for (const s of segments) if (p < s.endProgress) return s;
    return segments[segments.length - 1]!;
  }

  function indexAt(progress: number): number {
    const p = clamp01(progress);
    const s = segmentAt(p);
    if (s.type === 'hold') return s.startIndex;
    const span = s.endProgress - s.startProgress;
    const t = span > 0 ? (p - s.startProgress) / span : 0;
    return Math.round(s.startIndex + t * (s.endIndex - s.startIndex));
  }

  const holds = new Map<string, ScrollSegment>();
  for (const s of segments) if (s.type === 'hold' && s.heroId) holds.set(s.heroId, s);

  return {
    segments,
    indexAt,
    segmentAt,
    holdFor: (id) => holds.get(id),
    progressForHero: (id) => {
      const s = holds.get(id);
      return s ? (s.startProgress + s.endProgress) / 2 : undefined;
    },
  };
}
