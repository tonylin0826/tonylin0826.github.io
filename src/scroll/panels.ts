/** Pure helpers for content panels. No DOM access. */
import type { ScrollMap } from '../frames/scrollMap';

export interface PanelAttrs {
  hero?: string | undefined;
  at?: string | undefined;
}

/** Resolve a panel's hero id from data-hero or data-at="start|end". */
export function resolveHeroId(attrs: PanelAttrs, heroes: readonly string[]): string | undefined {
  if (attrs.hero) return heroes.includes(attrs.hero) ? attrs.hero : undefined;
  if (attrs.at === 'start') return heroes[0];
  if (attrs.at === 'end') return heroes[heroes.length - 1];
  return undefined;
}

/** True while progress lies in the hero's hold segment (end is inclusive only for the final segment). */
export function isHeroActive(map: ScrollMap, heroId: string | undefined, progress: number): boolean {
  if (!heroId) return false;
  const hold = map.holdFor(heroId);
  if (!hold) return false;
  const p = Math.min(1, Math.max(0, progress));
  return p >= hold.startProgress && (p < hold.endProgress || (hold.endProgress >= 1 && p <= 1));
}

/** Page scroll offset (px) at which the track reaches `progress`. */
export function scrollYForProgress(trackTop: number, trackHeight: number, viewportH: number, progress: number): number {
  const range = Math.max(0, trackHeight - viewportH);
  return trackTop + range * Math.min(1, Math.max(0, progress));
}
