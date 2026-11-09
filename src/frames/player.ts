/**
 * FramePlayer: owns the full-viewport <canvas>, the frame loader and the scroll map for the
 * current variant. Scroll progress in, pixels out. Handles resize / variant switching.
 */
import { FrameLoader } from './loader';
import { buildTimeline, type FramesManifest, type Timeline, type VariantName } from './manifest';
import { buildScrollMap, type ScrollMap, type ScrollMapOptions } from './scrollMap';
import {
  canvasPixelSize, computeFit, defaultFitMode, maxDprFor, pickVariant, type FitMode,
} from './variant';

export interface FramePlayerOptions {
  manifest: FramesManifest;
  /** Frames base URL (trailing slash). */
  base: string;
  scrollMap?: ScrollMapOptions;
  /** Override the per-variant default fit mode. */
  fitMode?: (variant: VariantName) => FitMode;
  resizeDebounceMs?: number;
}

export class FramePlayer {
  readonly canvas: HTMLCanvasElement;
  private readonly host: HTMLElement;
  private readonly opts: FramePlayerOptions;
  private readonly ctx: CanvasRenderingContext2D;
  private _variant: VariantName;
  private _timeline: Timeline;
  private _map: ScrollMap;
  private loader: FrameLoader;
  private unsubscribe: () => void;
  private progress = 0;
  private rafId = 0;
  private resizeTimer = 0;
  private drawnIndex = -1;
  private dirty = true;
  private disposed = false;
  private readonly variantListeners = new Set<(v: VariantName) => void>();
  private readonly resizeListeners = new Set<() => void>();

  constructor(host: HTMLElement, opts: FramePlayerOptions) {
    this.host = host;
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.className = 'stage__canvas';
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas is not available');
    this.ctx = ctx;
    host.appendChild(this.canvas);

    this._variant = this.currentVariant();
    ({ timeline: this._timeline, map: this._map } = this.build(this._variant));
    this.loader = this.startLoader();
    this.unsubscribe = this.loader.onFrameLoaded(() => this.schedule());

    this.applySize();
    window.addEventListener('resize', this.resizeHandler);
    window.addEventListener('orientationchange', this.resizeHandler);
    this.schedule();
  }

  get variant(): VariantName { return this._variant; }
  get timeline(): Timeline { return this._timeline; }
  get scrollMap(): ScrollMap { return this._map; }
  get background(): string { return this.opts.manifest.background; }

  /** Scroll progress 0..1. */
  setProgress(p: number): void {
    this.progress = Math.min(1, Math.max(0, Number.isFinite(p) ? p : 0));
    this.loader.prioritize(this._map.indexAt(this.progress));
    this.schedule();
  }

  /** Called after a debounced resize has been applied. */
  onResize(cb: () => void): () => void {
    this.resizeListeners.add(cb);
    return () => this.resizeListeners.delete(cb);
  }

  /** Called after the variant (and therefore timeline / scroll map) was rebuilt. */
  onVariantChange(cb: (v: VariantName) => void): () => void {
    this.variantListeners.add(cb);
    return () => this.variantListeners.delete(cb);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('orientationchange', this.resizeHandler);
    window.clearTimeout(this.resizeTimer);
    cancelAnimationFrame(this.rafId);
    this.unsubscribe();
    this.loader.dispose();
    this.variantListeners.clear();
    this.resizeListeners.clear();
    this.canvas.remove();
  }

  // -- internals -----------------------------------------------------------

  private currentVariant(): VariantName {
    return pickVariant({
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: window.devicePixelRatio || 1,
    });
  }

  private build(variant: VariantName): { timeline: Timeline; map: ScrollMap } {
    const timeline = buildTimeline(this.opts.manifest, variant);
    return { timeline, map: buildScrollMap(timeline, this.opts.scrollMap) };
  }

  private startLoader(): FrameLoader {
    const loader = new FrameLoader(this._timeline, this.opts.base);
    loader.prioritize(this._map.indexAt(this.progress));
    loader.start();
    return loader;
  }

  /** Stable reference for add/removeEventListener; debounced. */
  private readonly resizeHandler = (): void => {
    window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => this.handleResize(), this.opts.resizeDebounceMs ?? 150);
  };

  private handleResize(): void {
    if (this.disposed) return;
    const next = this.currentVariant();
    if (next !== this._variant) {
      // Keep relative progress: the scroll position is untouched, so just rebuild around it.
      this.unsubscribe();
      this.loader.dispose();
      this._variant = next;
      ({ timeline: this._timeline, map: this._map } = this.build(next));
      this.loader = this.startLoader();
      this.unsubscribe = this.loader.onFrameLoaded(() => this.schedule());
      this.drawnIndex = -1;
      for (const cb of [...this.variantListeners]) cb(next);
    }
    this.applySize();
    this.schedule();
    for (const cb of [...this.resizeListeners]) cb();
  }

  private applySize(): void {
    const cssW = this.host.clientWidth || window.innerWidth;
    const cssH = this.host.clientHeight || window.innerHeight;
    const { width, height } = canvasPixelSize(cssW, cssH, window.devicePixelRatio || 1, maxDprFor(this._variant));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.canvas.style.backgroundColor = this.opts.manifest.background;
    this.dirty = true;
  }

  private schedule(): void {
    if (this.rafId || this.disposed) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = 0;
      this.draw();
    });
  }

  private draw(): void {
    if (this.disposed) return;
    const target = this._map.indexAt(this.progress);
    const hit = this.loader.nearestLoaded(target);
    const { width: cw, height: ch } = this.canvas;
    if (!hit) {
      if (this.dirty) {
        this.ctx.fillStyle = this.opts.manifest.background;
        this.ctx.fillRect(0, 0, cw, ch);
        this.dirty = false;
      }
      return;
    }
    if (hit.index === this.drawnIndex && !this.dirty) return;

    const v = this.opts.manifest.clips[0]!.variants[this._variant];
    const mode = (this.opts.fitMode ?? defaultFitMode)(this._variant);
    const fit = computeFit(mode, v.width, v.height, cw, ch);
    this.ctx.fillStyle = this.opts.manifest.background;
    this.ctx.fillRect(0, 0, cw, ch);
    this.ctx.drawImage(hit.source, fit.dx, fit.dy, fit.dw, fit.dh);
    this.drawnIndex = hit.index;
    this.dirty = false;
  }
}
