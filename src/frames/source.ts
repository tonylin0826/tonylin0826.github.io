/**
 * Manifest loading. Resolves where frames live:
 *   1. VITE_FRAMES_BASE (if set)
 *   2. /assets/frames/ (if its manifest.json is present and valid)
 *   3. /placeholder-frames/ (generated fallback)
 */
import { parseManifest, type FramesManifest } from './manifest';

export interface FramesSource {
  /** Always ends with "/". */
  base: string;
  manifest: FramesManifest;
  isPlaceholder: boolean;
}

export const REAL_BASE = '/assets/frames/';
export const PLACEHOLDER_BASE = '/placeholder-frames/';

export function withTrailingSlash(s: string): string {
  return s.endsWith('/') ? s : `${s}/`;
}

async function fetchManifest(base: string): Promise<FramesManifest> {
  const res = await fetch(`${base}manifest.json`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${base}manifest.json: HTTP ${res.status}`);
  // Dev servers answer unknown paths with index.html (200); JSON parsing rejects that.
  return parseManifest(await res.json());
}

export async function loadFramesSource(): Promise<FramesSource> {
  const override = import.meta.env.VITE_FRAMES_BASE;
  if (override) {
    const base = withTrailingSlash(override);
    return { base, manifest: await fetchManifest(base), isPlaceholder: base === PLACEHOLDER_BASE };
  }
  try {
    return { base: REAL_BASE, manifest: await fetchManifest(REAL_BASE), isPlaceholder: false };
  } catch {
    return { base: PLACEHOLDER_BASE, manifest: await fetchManifest(PLACEHOLDER_BASE), isPlaceholder: true };
  }
}
