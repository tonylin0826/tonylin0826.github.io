/**
 * Frames manifest (schema v1): types, runtime validator and pure helpers.
 * Contract: docs/asset-contract.md. No DOM access here; safe in Node/Vitest.
 */

export type VariantName = 'desktop' | 'mobile';
/** A 1-based frame number, or 'last' (= frameCount). */
export type HeroFrame = number | 'last';

export const VARIANT_NAMES: readonly VariantName[] = ['desktop', 'mobile'];
export const MANIFEST_VERSION = 1;

export interface Variant {
  frameCount: number;
  width: number;
  height: number;
  /** Relative to the manifest folder. Contains exactly one `{frame}` / `{frame:0N}` token. */
  pathPattern: string;
}

export interface Clip {
  id: string;
  from: string;
  to: string;
  variants: Record<VariantName, Variant>;
  heroFrames: { start: HeroFrame; end: HeroFrame };
  poster: Record<VariantName, string>;
}

export interface FramesManifest {
  version: 1;
  format: 'webp';
  fps: number;
  background: string;
  heroes: string[];
  clips: Clip[];
}

export class ManifestError extends Error {
  readonly problems: readonly string[];
  constructor(problems: readonly string[]) {
    super(`Invalid frames manifest (${problems.length} problem${problems.length === 1 ? '' : 's'}):\n` +
      problems.map((p) => `  - ${p}`).join('\n'));
    this.name = 'ManifestError';
    this.problems = problems;
  }
}

// ---------------------------------------------------------------------------
// Path pattern helpers
// ---------------------------------------------------------------------------

/** Matches `{frame}` or `{frame:0N}` (N = zero-pad width), e.g. `{frame:04}`. */
const TOKEN_RE = /\{frame(?::0(\d+))?\}/;
const TOKEN_RE_G = new RegExp(TOKEN_RE.source, 'g');

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isPosInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1;
}

/** Expand a variant's pathPattern for a 1-based frame number. */
export function framePath(variant: Pick<Variant, 'pathPattern' | 'frameCount'>, frame: number): string {
  if (!Number.isInteger(frame) || frame < 1 || frame > variant.frameCount) {
    throw new RangeError(`frame ${frame} out of range 1..${variant.frameCount}`);
  }
  return variant.pathPattern.replace(TOKEN_RE_G, (_m, width: string | undefined) =>
    String(frame).padStart(width ? Number(width) : 0, '0'));
}

/** Resolve a heroFrames value ('last' or 1-based number) to a concrete frame number. */
export function resolveHeroFrame(h: HeroFrame, frameCount: number): number {
  if (h === 'last') return frameCount;
  if (!Number.isInteger(h) || h < 1 || h > frameCount) {
    throw new RangeError(`hero frame ${String(h)} out of range 1..${frameCount}`);
  }
  return h;
}

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

function checkPattern(pattern: string, at: string, out: string[]): boolean {
  const tokens = pattern.match(TOKEN_RE_G) ?? [];
  if (tokens.length !== 1) {
    out.push(`${at}: pathPattern must contain exactly one {frame} / {frame:0N} token (found ${tokens.length}) in "${pattern}"`);
    return false;
  }
  if (pattern.replace(TOKEN_RE_G, '').match(/[{}]/)) {
    out.push(`${at}: pathPattern has a malformed "{...}" token in "${pattern}"`);
    return false;
  }
  if (pattern.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(pattern) || pattern.split('/').includes('..')) {
    out.push(`${at}: pathPattern must be relative to the manifest folder (no leading "/", scheme or "..") in "${pattern}"`);
    return false;
  }
  return true;
}

function checkVariant(v: unknown, at: string, out: string[]): Variant | null {
  if (!isRecord(v)) {
    out.push(`${at}: must be an object`);
    return null;
  }
  let ok = true;
  if (!isPosInt(v.frameCount)) {
    out.push(`${at}.frameCount: must be an integer >= 1 (got ${JSON.stringify(v.frameCount)})`);
    ok = false;
  }
  for (const k of ['width', 'height'] as const) {
    const n = v[k];
    if (!isPosInt(n)) {
      out.push(`${at}.${k}: must be a positive integer (got ${JSON.stringify(n)})`);
      ok = false;
    } else if (n % 2 !== 0) {
      out.push(`${at}.${k}: must be even (got ${n})`);
      ok = false;
    }
  }
  if (typeof v.pathPattern !== 'string') {
    out.push(`${at}.pathPattern: must be a string`);
    ok = false;
  } else if (!checkPattern(v.pathPattern, `${at}.pathPattern`, out)) {
    ok = false;
  }
  return ok ? (v as unknown as Variant) : null;
}

function checkPoster(poster: unknown, variant: Variant | null, at: string, out: string[]): void {
  if (typeof poster !== 'string' || poster === '') {
    out.push(`${at}: must be a non-empty string`);
    return;
  }
  if (!variant) return; // variant already reported
  const m = TOKEN_RE.exec(variant.pathPattern);
  if (!m) return;
  const prefix = variant.pathPattern.slice(0, m.index);
  const suffix = variant.pathPattern.slice(m.index + m[0].length);
  const mid = poster.startsWith(prefix) && poster.endsWith(suffix) && poster.length >= prefix.length + suffix.length
    ? poster.slice(prefix.length, poster.length - suffix.length)
    : null;
  const n = mid !== null && /^\d+$/.test(mid) ? Number(mid) : NaN;
  if (!Number.isInteger(n) || n < 1 || n > variant.frameCount || framePath(variant, n) !== poster) {
    out.push(`${at}: "${poster}" is not a valid frame path for pattern "${variant.pathPattern}" (frames 1..${variant.frameCount})`);
  }
}

function checkHeroFrame(h: unknown, frameCount: number | null, at: string, out: string[]): void {
  if (h === 'last') return;
  if (!isPosInt(h)) {
    out.push(`${at}: must be a 1-based integer or "last" (got ${JSON.stringify(h)})`);
  } else if (frameCount !== null && h > frameCount) {
    out.push(`${at}: ${h} exceeds frameCount ${frameCount}`);
  }
}

/** Validate unknown JSON as a v1 manifest. Throws ManifestError listing ALL problems. */
export function parseManifest(json: unknown): FramesManifest {
  const out: string[] = [];
  if (!isRecord(json)) throw new ManifestError(['$: must be an object']);

  if (json.version !== MANIFEST_VERSION) {
    out.push(`$.version: unsupported version ${JSON.stringify(json.version)} (expected ${MANIFEST_VERSION})`);
  }
  if (json.format !== 'webp') {
    out.push(`$.format: must be "webp" (got ${JSON.stringify(json.format)})`);
  }
  if (typeof json.fps !== 'number' || !Number.isFinite(json.fps) || json.fps <= 0) {
    out.push(`$.fps: must be a positive number (got ${JSON.stringify(json.fps)})`);
  }
  if (typeof json.background !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(json.background)) {
    out.push(`$.background: must be a hex colour like "#d9d9d9" (got ${JSON.stringify(json.background)})`);
  }

  let heroes: string[] | null = null;
  if (!Array.isArray(json.heroes) || json.heroes.length === 0 ||
      json.heroes.some((h) => typeof h !== 'string' || h === '')) {
    out.push('$.heroes: must be a non-empty array of non-empty strings');
  } else {
    heroes = json.heroes as string[];
    if (new Set(heroes).size !== heroes.length) out.push('$.heroes: ids must be unique');
  }

  if (!Array.isArray(json.clips) || json.clips.length === 0) {
    out.push('$.clips: must be a non-empty array');
  } else {
    const clips = json.clips as unknown[];
    const seen = new Set<string>();
    const chain: (string | null)[] = []; // from of clip 0, then each `to`
    clips.forEach((c, i) => {
      const at = `$.clips[${i}]`;
      if (!isRecord(c)) {
        out.push(`${at}: must be an object`);
        chain.push(null);
        if (i === 0) chain.unshift(null);
        return;
      }
      if (typeof c.id !== 'string' || c.id === '') out.push(`${at}.id: must be a non-empty string`);
      else if (seen.has(c.id)) out.push(`${at}.id: duplicate clip id "${c.id}"`);
      else seen.add(c.id);

      const from = typeof c.from === 'string' && c.from !== '' ? c.from : null;
      const to = typeof c.to === 'string' && c.to !== '' ? c.to : null;
      if (!from) out.push(`${at}.from: must be a non-empty string`);
      if (!to) out.push(`${at}.to: must be a non-empty string`);
      if (i === 0) chain.push(from);
      else if (chain[i] != null && from !== null && chain[i] !== from) {
        out.push(`${at}.from: "${from}" must equal previous clip's to "${chain[i]}"`);
      }
      chain.push(to);

      const variants: Partial<Record<VariantName, Variant | null>> = {};
      if (!isRecord(c.variants)) {
        out.push(`${at}.variants: must be an object`);
      } else {
        for (const k of Object.keys(c.variants)) {
          if (!(VARIANT_NAMES as readonly string[]).includes(k)) {
            out.push(`${at}.variants.${k}: unknown variant (allowed: ${VARIANT_NAMES.join(', ')})`);
          }
        }
        for (const name of VARIANT_NAMES) {
          if (!(name in c.variants)) out.push(`${at}.variants.${name}: missing`);
          else variants[name] = checkVariant(c.variants[name], `${at}.variants.${name}`, out);
        }
      }

      if (!isRecord(c.poster)) {
        out.push(`${at}.poster: must be an object`);
      } else {
        for (const k of Object.keys(c.poster)) {
          if (!(VARIANT_NAMES as readonly string[]).includes(k)) {
            out.push(`${at}.poster.${k}: unknown variant (allowed: ${VARIANT_NAMES.join(', ')})`);
          }
        }
        for (const name of VARIANT_NAMES) {
          if (!(name in c.poster)) out.push(`${at}.poster.${name}: missing`);
          else checkPoster(c.poster[name], variants[name] ?? null, `${at}.poster.${name}`, out);
        }
      }

      if (!isRecord(c.heroFrames)) {
        out.push(`${at}.heroFrames: must be an object with start and end`);
      } else {
        const counts = VARIANT_NAMES.map((n) => variants[n]?.frameCount ?? null);
        const minCount = counts.every((n): n is number => n !== null) ? Math.min(...counts) : null;
        checkHeroFrame(c.heroFrames.start, minCount, `${at}.heroFrames.start`, out);
        checkHeroFrame(c.heroFrames.end, minCount, `${at}.heroFrames.end`, out);
        const { start, end } = c.heroFrames;
        if (minCount !== null && isPosInt(start === 'last' ? minCount : start) &&
            isPosInt(end === 'last' ? minCount : end) &&
            (start === 'last' ? minCount : (start as number)) > (end === 'last' ? minCount : (end as number))) {
          out.push(`${at}.heroFrames: start must be <= end`);
        }
      }
    });

    if (heroes && chain.length === clips.length + 1 && chain.every((x): x is string => x !== null)) {
      const expected = chain as string[];
      if (expected.length !== heroes.length || expected.some((h, i) => h !== heroes![i])) {
        out.push(`$.heroes: must equal [clips[0].from, ...clips.map(c => c.to)] = ${JSON.stringify(expected)} (got ${JSON.stringify(heroes)})`);
      }
    }
  }

  if (out.length) throw new ManifestError(out);
  return json as unknown as FramesManifest;
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export interface TimelineFrame {
  clipId: string;
  /** 1-based frame number within the clip. */
  frame: number;
  /** Path relative to the manifest folder. */
  path: string;
}

export interface Timeline {
  variant: VariantName;
  frames: TimelineFrame[];
  /** hero id -> index into `frames`. */
  heroIndex: Record<string, number>;
}

/**
 * Flatten all clips into one ordered frame list. Each clip's last frame equals the next
 * clip's first frame, so frame 1 of every clip after the first is skipped.
 *
 * Hero indices: heroes[0] is clip 0's heroFrames.start; heroes[i>=1] is clip (i-1)'s
 * heroFrames.end (which, for the default "last", is the shared boundary frame).
 */
export function buildTimeline(manifest: FramesManifest, variantName: VariantName): Timeline {
  const frames: TimelineFrame[] = [];
  const heroIndex: Record<string, number> = {};
  const offsets: number[] = []; // index in `frames` of each clip's frame 1 (virtual for clips > 0)

  manifest.clips.forEach((clip, i) => {
    const variant = clip.variants[variantName];
    const first = i === 0 ? 1 : 2;
    offsets.push(frames.length - (first - 1));
    for (let f = first; f <= variant.frameCount; f++) {
      frames.push({ clipId: clip.id, frame: f, path: framePath(variant, f) });
    }
  });

  const indexOf = (clipIdx: number, h: HeroFrame): number => {
    const clip = manifest.clips[clipIdx]!;
    return offsets[clipIdx]! + resolveHeroFrame(h, clip.variants[variantName].frameCount) - 1;
  };

  const c0 = manifest.clips[0];
  if (c0) heroIndex[c0.from] = indexOf(0, c0.heroFrames.start);
  manifest.clips.forEach((clip, i) => {
    heroIndex[clip.to] = indexOf(i, clip.heroFrames.end);
  });

  return { variant: variantName, frames, heroIndex };
}
