/**
 * Scroll engine. A tall #scroll-track holds a position:sticky stage (canvas) and a sticky
 * overlay of content panels. ScrollTrigger only supplies (smoothed) progress; it does not pin.
 * With prefers-reduced-motion, nothing is scrubbed: each hero still is shown as a normal <img>.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildTimeline, type VariantName } from '../frames/manifest';
import { FramePlayer } from '../frames/player';
import type { FramesSource } from '../frames/source';
import { pickVariant } from '../frames/variant';
import { isHeroActive, resolveHeroId, scrollYForProgress } from './panels';

gsap.registerPlugin(ScrollTrigger);

export interface EngineOptions {
  source: FramesSource;
  /** Track height per scroll segment, in viewport heights. Default 100. */
  vhPerSegment?: number;
  /** Hold length relative to the average transition. Default 0.8. */
  holdWeight?: number;
  /** ScrollTrigger scrub smoothing in seconds. Default 0.5. */
  scrub?: number;
}

export interface Engine {
  destroy(): void;
}

interface Panel {
  el: HTMLElement;
  hero: string | undefined;
  active: boolean;
}

const REDUCED = '(prefers-reduced-motion: reduce)';

export function createEngine(opts: EngineOptions): Engine | null {
  const track = document.querySelector<HTMLElement>('#scroll-track');
  const stage = track?.querySelector<HTMLElement>('.stage');
  if (!track || !stage) return null;
  const root = document.documentElement;
  const { source } = opts;
  const heroes = source.manifest.heroes;
  const panelEls = [...track.querySelectorAll<HTMLElement>('.panel')];
  const panels: Panel[] = panelEls.map((el) => ({
    el,
    hero: resolveHeroId({ hero: el.dataset.hero, at: el.dataset.at }, heroes),
    active: false,
  }));
  for (const p of panels) {
    if (!p.hero) console.warn('Panel has no matching hero in the manifest; it will not be shown while scrolling', p.el);
  }

  let teardown: (() => void) | null = null;

  // -- motion mode ---------------------------------------------------------
  function enterMotion(): () => void {
    clearStills();
    root.classList.remove('static-mode');
    root.classList.add('scroll-mode');
    stage!.style.removeProperty('display');

    const player = new FramePlayer(stage!, {
      manifest: source.manifest,
      base: source.base,
      scrollMap: { holdWeight: opts.holdWeight ?? 0.8 },
    });
    root.style.setProperty('--stage-bg', player.background);

    const setTrackHeight = () => {
      track!.style.setProperty('--segments', String(player.scrollMap.segments.length));
      track!.style.setProperty('--vh-per-segment', String(opts.vhPerSegment ?? 100));
    };
    setTrackHeight();

    const state = { p: 0 };
    const apply = (): void => {
      player.setProgress(state.p);
      for (const panel of panels) {
        const on = isHeroActive(player.scrollMap, panel.hero, state.p);
        if (on !== panel.active) {
          panel.active = on;
          panel.el.classList.toggle('is-active', on);
        }
      }
    };

    const tween = gsap.to(state, {
      p: 1,
      ease: 'none',
      onUpdate: apply,
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: opts.scrub ?? 0.5,
      },
    });
    // Start from the real scroll position (reloads / anchors) instead of easing in from 0.
    const st = tween.scrollTrigger;
    if (st) tween.progress(st.progress);
    state.p = tween.progress();
    // Sync with whatever the static HTML marked active, so apply() toggles correctly.
    for (const panel of panels) panel.active = panel.el.classList.contains('is-active');
    apply();

    // Keyboard: focusing a link inside an inactive panel scrolls to that panel's hold.
    const onFocusIn = (e: FocusEvent): void => {
      const target = e.target as Element | null;
      const panel = panels.find((p) => p.el.contains(target));
      if (!panel?.hero || isHeroActive(player.scrollMap, panel.hero, st?.progress ?? state.p)) return;
      const p = player.scrollMap.progressForHero(panel.hero);
      if (p === undefined) return;
      const top = track!.getBoundingClientRect().top + window.scrollY;
      window.scrollTo(0, scrollYForProgress(top, track!.offsetHeight, window.innerHeight, p));
    };
    track!.addEventListener('focusin', onFocusIn);

    const refresh = (): void => {
      setTrackHeight();
      ScrollTrigger.refresh();
    };
    const offResize = player.onResize(refresh);
    const offVariant = player.onVariantChange(() => apply());
    window.addEventListener('load', refresh, { once: true });

    return () => {
      window.removeEventListener('load', refresh);
      track!.removeEventListener('focusin', onFocusIn);
      offResize();
      offVariant();
      tween.scrollTrigger?.kill();
      tween.kill();
      player.dispose();
      for (const panel of panels) {
        panel.active = false;
        panel.el.classList.remove('is-active');
      }
      root.classList.remove('scroll-mode');
      track!.style.removeProperty('--segments');
      track!.style.removeProperty('--vh-per-segment');
    };
  }

  // -- static (reduced motion) mode ---------------------------------------
  function enterStatic(): () => void {
    root.classList.remove('scroll-mode');
    root.classList.add('static-mode');
    stage!.style.display = 'none';

    const variant: VariantName = pickVariant({
      width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1,
    });
    const timeline = buildTimeline(source.manifest, variant);
    const dims = source.manifest.clips[0]!.variants[variant];
    for (const panel of panels) {
      if (!panel.hero) continue;
      const idx = timeline.heroIndex[panel.hero];
      const frame = idx === undefined ? undefined : timeline.frames[idx];
      if (!frame) continue;
      const fig = document.createElement('figure');
      fig.className = 'panel__still';
      const img = new Image();
      img.src = source.base + frame.path;
      img.alt = panel.el.dataset.stillAlt ?? '';
      img.width = dims.width;
      img.height = dims.height;
      img.decoding = 'async';
      img.loading = 'lazy';
      fig.appendChild(img);
      panel.el.prepend(fig);
    }
    root.style.setProperty('--stage-bg', source.manifest.background);
    return () => {
      clearStills();
      root.classList.remove('static-mode');
      stage!.style.removeProperty('display');
    };
  }

  function clearStills(): void {
    track!.querySelectorAll('.panel__still').forEach((n) => n.remove());
  }

  // -- mode switching ------------------------------------------------------
  const mq = window.matchMedia(REDUCED);
  const syncMode = (): void => {
    teardown?.();
    teardown = mq.matches ? enterStatic() : enterMotion();
  };
  syncMode();
  mq.addEventListener('change', syncMode);

  return {
    destroy() {
      mq.removeEventListener('change', syncMode);
      teardown?.();
      teardown = null;
    },
  };
}
