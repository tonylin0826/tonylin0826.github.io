/** Pure viewport / canvas math. No DOM access. */
import type { VariantName } from './manifest';

export interface Viewport {
  width: number;
  height: number;
  dpr: number;
}

export type FitMode = 'cover' | 'contain';

export interface Fit {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

export const MOBILE_MAX_WIDTH = 768;

/** Mobile frames for portrait-ish or narrow viewports, desktop otherwise. */
export function pickVariant({ width, height }: Viewport): VariantName {
  if (height > 0 && width / height < 1) return 'mobile';
  return width < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop';
}

/** Default DPR cap: 2 on desktop, 1.5 on mobile. */
export function maxDprFor(variant: VariantName): number {
  return variant === 'mobile' ? 1.5 : 2;
}

/** Backing-store size in device pixels for a CSS size, with the DPR capped. */
export function canvasPixelSize(
  cssW: number,
  cssH: number,
  dpr: number,
  maxDpr = 2,
): { width: number; height: number } {
  const ratio = Math.max(1, Math.min(Number.isFinite(dpr) ? dpr : 1, maxDpr));
  return {
    width: Math.max(1, Math.round(cssW * ratio)),
    height: Math.max(1, Math.round(cssH * ratio)),
  };
}

/** Default fit: desktop frames fill the screen (cover); mobile 3:4 frames are never cropped (contain). */
export function defaultFitMode(variant: VariantName): FitMode {
  return variant === 'mobile' ? 'contain' : 'cover';
}

/** Destination rectangle for drawing a src-sized image into a dst-sized canvas, centred. */
export function computeFit(mode: FitMode, srcW: number, srcH: number, dstW: number, dstH: number): Fit {
  if (srcW <= 0 || srcH <= 0) return { dx: 0, dy: 0, dw: dstW, dh: dstH };
  const sx = dstW / srcW;
  const sy = dstH / srcH;
  const scale = mode === 'cover' ? Math.max(sx, sy) : Math.min(sx, sy);
  const dw = srcW * scale;
  const dh = srcH * scale;
  return { dx: (dstW - dw) / 2, dy: (dstH - dh) / 2, dw, dh };
}
