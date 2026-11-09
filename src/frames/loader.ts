/**
 * Prioritised, concurrency-limited frame loader.
 * Pure scheduling helpers (buildLoadOrder, nearestIndex, nearbyMissing, insertSorted) are exported for tests.
 */
import type { Timeline } from './manifest';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * Load order for `total` frames: hero frames and frame 0 first, then strided passes
 * (every 8th, 4th, 2nd, then everything else). No duplicates; covers 0..total-1.
 */
export function buildLoadOrder(total: number, heroIndices: readonly number[]): number[] {
  const order: number[] = [];
  const seen = new Uint8Array(Math.max(0, total));
  const push = (i: number) => {
    if (Number.isInteger(i) && i >= 0 && i < total && !seen[i]) {
      seen[i] = 1;
      order.push(i);
    }
  };
  push(0);
  [...heroIndices].sort((a, b) => a - b).forEach(push);
  for (const stride of [8, 4, 2, 1]) {
    for (let i = 0; i < total; i += stride) push(i);
  }
  return order;
}

/** Closest value to `target` in an ascending sorted array (ties prefer the lower). -1 if empty. */
export function nearestIndex(sorted: readonly number[], target: number): number {
  if (sorted.length === 0) return -1;
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < target) lo = mid + 1;
    else hi = mid;
  }
  // lo = first element >= target (or the last element)
  const upper = sorted[lo]!;
  const lower = lo > 0 ? sorted[lo - 1]! : undefined;
  if (lower === undefined) return upper;
  return target - lower <= upper - target ? lower : upper;
}

/** Insert into an ascending sorted array if absent. Returns true when inserted. */
export function insertSorted(sorted: number[], value: number): boolean {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! < value) lo = mid + 1;
    else hi = mid;
  }
  if (sorted[lo] === value) return false;
  sorted.splice(lo, 0, value);
  return true;
}

/** Indices within `radius` of `target` for which `isMissing` is true, nearest first (lower wins ties). */
export function nearbyMissing(
  target: number,
  radius: number,
  total: number,
  isMissing: (i: number) => boolean,
): number[] {
  const out: number[] = [];
  const t = Math.round(target);
  for (let d = 0; d <= radius; d++) {
    for (const i of d === 0 ? [t] : [t - d, t + d]) {
      if (i >= 0 && i < total && isMissing(i)) out.push(i);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export interface FrameLoaderOptions {
  /** Max parallel fetches. Default 6 (desktop) / 4 (mobile). */
  concurrency?: number;
  /** How many frames either side of the prioritised index get bumped. Default 6. */
  priorityRadius?: number;
}

const State = { Idle: 0, Loading: 1, Loaded: 2, Failed: 3 } as const;

export type FrameLoadedCallback = (index: number) => void;

export class FrameLoader {
  private readonly timeline: Timeline;
  private readonly base: string;
  private readonly concurrency: number;
  private readonly radius: number;
  private readonly order: number[];
  private cursor = 0;
  private readonly state: Uint8Array;
  private readonly images = new Map<number, CanvasImageSource>();
  private readonly loaded: number[] = []; // ascending
  private readonly listeners = new Set<FrameLoadedCallback>();
  private readonly abort = new AbortController();
  private inflight = 0;
  private focus: number | null = null;
  private started = false;
  private disposed = false;

  constructor(timeline: Timeline, base: string, opts: FrameLoaderOptions = {}) {
    this.timeline = timeline;
    this.base = base.endsWith('/') ? base : `${base}/`;
    this.concurrency = opts.concurrency ?? (timeline.variant === 'mobile' ? 4 : 6);
    this.radius = opts.priorityRadius ?? 6;
    this.order = buildLoadOrder(timeline.frames.length, Object.values(timeline.heroIndex));
    this.state = new Uint8Array(timeline.frames.length);
  }

  get total(): number {
    return this.timeline.frames.length;
  }

  get loadedCount(): number {
    return this.loaded.length;
  }

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    this.pump();
  }

  /** Subscribe to frame arrivals. Returns an unsubscribe function. */
  onFrameLoaded(cb: FrameLoadedCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  has(index: number): boolean {
    return this.images.has(index);
  }

  get(index: number): CanvasImageSource | undefined {
    return this.images.get(index);
  }

  /** Closest loaded frame to `index`, or null if nothing has loaded yet. */
  nearestLoaded(index: number): { index: number; source: CanvasImageSource } | null {
    const i = nearestIndex(this.loaded, index);
    if (i < 0) return null;
    return { index: i, source: this.images.get(i)! };
  }

  /** Bump frames around `index` (the current scroll target) ahead of the coarse pass. */
  prioritize(index: number): void {
    if (this.disposed) return;
    this.focus = index;
    if (this.started) this.pump();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.listeners.clear();
    for (const img of this.images.values()) {
      if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close();
    }
    this.images.clear();
    this.loaded.length = 0;
  }

  // -- internals -----------------------------------------------------------

  private next(): number | null {
    if (this.focus !== null) {
      const near = nearbyMissing(this.focus, this.radius, this.total, (i) => this.state[i] === State.Idle);
      if (near.length) return near[0]!;
    }
    while (this.cursor < this.order.length) {
      const i = this.order[this.cursor++]!;
      if (this.state[i] === State.Idle) return i;
    }
    return null;
  }

  private pump(): void {
    while (!this.disposed && this.inflight < this.concurrency) {
      const i = this.next();
      if (i === null) return;
      this.state[i] = State.Loading;
      this.inflight++;
      void this.load(i).finally(() => {
        this.inflight--;
        this.pump();
      });
    }
  }

  private async load(index: number): Promise<void> {
    const url = this.base + this.timeline.frames[index]!.path;
    try {
      const source = await decode(url, this.abort.signal);
      if (this.disposed) {
        if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) source.close();
        return;
      }
      this.images.set(index, source);
      insertSorted(this.loaded, index);
      this.state[index] = State.Loaded;
      for (const cb of [...this.listeners]) cb(index);
    } catch {
      // Aborted or failed: leave the gap; nearestLoaded covers it.
      this.state[index] = State.Failed;
    }
  }
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

async function decode(url: string, signal: AbortSignal): Promise<CanvasImageSource> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const blob = await res.blob();
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch {
      // fall through to <img> (some Safari versions reject certain WebP/option combos)
    }
  }
  return decodeWithImage(blob);
}

async function decodeWithImage(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = objectUrl;
    if (typeof img.decode === 'function') {
      await img.decode();
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image decode failed'));
      });
    }
    return img;
  } finally {
    // The decoded image stays usable after the URL is revoked.
    URL.revokeObjectURL(objectUrl);
  }
}
