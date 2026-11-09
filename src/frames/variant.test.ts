import { describe, expect, it } from 'vitest';
import { canvasPixelSize, computeFit, defaultFitMode, maxDprFor, pickVariant } from './variant';

describe('pickVariant', () => {
  it('desktop for wide landscape', () => {
    expect(pickVariant({ width: 1440, height: 900, dpr: 2 })).toBe('desktop');
  });
  it('mobile for portrait', () => {
    expect(pickVariant({ width: 900, height: 1200, dpr: 1 })).toBe('mobile');
    expect(pickVariant({ width: 390, height: 844, dpr: 3 })).toBe('mobile');
  });
  it('mobile for narrow landscape (< 768)', () => {
    expect(pickVariant({ width: 700, height: 400, dpr: 1 })).toBe('mobile');
  });
  it('desktop at exactly 768 landscape, square counts as desktop', () => {
    expect(pickVariant({ width: 768, height: 500, dpr: 1 })).toBe('desktop');
    expect(pickVariant({ width: 1000, height: 1000, dpr: 1 })).toBe('desktop');
  });
  it('tolerates zero height', () => {
    expect(pickVariant({ width: 1000, height: 0, dpr: 1 })).toBe('desktop');
  });
});

describe('canvasPixelSize', () => {
  it('multiplies by dpr and rounds', () => {
    expect(canvasPixelSize(100, 50.5, 2)).toEqual({ width: 200, height: 101 });
  });
  it('caps dpr', () => {
    expect(canvasPixelSize(100, 100, 3)).toEqual({ width: 200, height: 200 });
    expect(canvasPixelSize(100, 100, 3, 1.5)).toEqual({ width: 150, height: 150 });
  });
  it('never goes below 1x or to zero', () => {
    expect(canvasPixelSize(100, 100, 0.5)).toEqual({ width: 100, height: 100 });
    expect(canvasPixelSize(0, 0, 2)).toEqual({ width: 1, height: 1 });
    expect(canvasPixelSize(10, 10, NaN)).toEqual({ width: 10, height: 10 });
  });
  it('maxDprFor', () => {
    expect(maxDprFor('desktop')).toBe(2);
    expect(maxDprFor('mobile')).toBe(1.5);
  });
});

describe('computeFit', () => {
  it('cover: same aspect fills exactly', () => {
    expect(computeFit('cover', 1920, 1080, 960, 540)).toEqual({ dx: 0, dy: 0, dw: 960, dh: 540 });
  });
  it('cover: crops the longer axis, centred', () => {
    // 16:9 into square: scale by height
    const f = computeFit('cover', 1920, 1080, 1000, 1000);
    expect(f.dh).toBe(1000);
    expect(f.dw).toBeCloseTo(1777.78, 1);
    expect(f.dx).toBeCloseTo(-388.89, 1);
    expect(f.dy).toBe(0);
  });
  it('contain: letterboxes, centred', () => {
    const f = computeFit('contain', 810, 1080, 1000, 1000);
    expect(f.dh).toBe(1000);
    expect(f.dw).toBeCloseTo(750, 5);
    expect(f.dx).toBeCloseTo(125, 5);
    expect(f.dy).toBe(0);
  });
  it('contain: wide dst -> pillarbox; tall dst -> letterbox', () => {
    const wide = computeFit('contain', 100, 100, 300, 100);
    expect(wide).toEqual({ dx: 100, dy: 0, dw: 100, dh: 100 });
    const tall = computeFit('contain', 100, 100, 100, 300);
    expect(tall).toEqual({ dx: 0, dy: 100, dw: 100, dh: 100 });
  });
  it('degenerate source falls back to full dst', () => {
    expect(computeFit('cover', 0, 0, 10, 20)).toEqual({ dx: 0, dy: 0, dw: 10, dh: 20 });
  });
  it('default modes', () => {
    expect(defaultFitMode('desktop')).toBe('cover');
    expect(defaultFitMode('mobile')).toBe('contain');
  });
});
