import { describe, expect, it } from 'vitest';
import { buildLoadOrder, insertSorted, nearbyMissing, nearestIndex } from './loader';

describe('buildLoadOrder', () => {
  it('has no duplicates and covers every index', () => {
    const order = buildLoadOrder(100, [0, 40, 99, 70]);
    expect(order).toHaveLength(100);
    expect(new Set(order).size).toBe(100);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i));
  });
  it('puts first frame and heroes first (ascending)', () => {
    const order = buildLoadOrder(100, [99, 40, 70]);
    expect(order.slice(0, 4)).toEqual([0, 40, 70, 99]);
  });
  it('then strides 8 -> 4 -> 2 -> 1', () => {
    const order = buildLoadOrder(33, [0, 32]);
    // after heroes 0 and 32: multiples of 8 (8,16,24), then 4s (4,12,20,28), then 2s, then odds
    expect(order.slice(0, 2)).toEqual([0, 32]);
    expect(order.slice(2, 5)).toEqual([8, 16, 24]);
    expect(order.slice(5, 9)).toEqual([4, 12, 20, 28]);
    expect(order.slice(9, 9 + 8)).toEqual([2, 6, 10, 14, 18, 22, 26, 30]);
    expect(order.slice(17).every((i) => i % 2 === 1)).toBe(true);
  });
  it('ignores out-of-range / non-integer / duplicate heroes', () => {
    const order = buildLoadOrder(10, [-1, 3, 3, 99, 2.5]);
    expect(order).toHaveLength(10);
    expect(new Set(order).size).toBe(10);
    expect(order.slice(0, 2)).toEqual([0, 3]);
  });
  it('handles empty and tiny timelines', () => {
    expect(buildLoadOrder(0, [])).toEqual([]);
    expect(buildLoadOrder(1, [0])).toEqual([0]);
  });
});

describe('nearestIndex', () => {
  it('returns -1 when empty', () => {
    expect(nearestIndex([], 5)).toBe(-1);
  });
  it('exact hit', () => {
    expect(nearestIndex([1, 5, 9], 5)).toBe(5);
  });
  it('closest on either side, ties prefer lower', () => {
    expect(nearestIndex([0, 10], 4)).toBe(0);
    expect(nearestIndex([0, 10], 6)).toBe(10);
    expect(nearestIndex([0, 10], 5)).toBe(0);
  });
  it('clamps beyond the ends', () => {
    expect(nearestIndex([3, 7], -100)).toBe(3);
    expect(nearestIndex([3, 7], 100)).toBe(7);
  });
  it('single element', () => {
    expect(nearestIndex([4], 0)).toBe(4);
  });
});

describe('insertSorted', () => {
  it('keeps order and rejects duplicates', () => {
    const a: number[] = [];
    for (const v of [5, 1, 9, 5, 3, 0]) insertSorted(a, v);
    expect(a).toEqual([0, 1, 3, 5, 9]);
    expect(insertSorted(a, 3)).toBe(false);
    expect(insertSorted(a, 4)).toBe(true);
  });
});

describe('nearbyMissing', () => {
  it('lists missing indices nearest first, within bounds', () => {
    const have = new Set([5]);
    expect(nearbyMissing(5, 2, 100, (i) => !have.has(i))).toEqual([4, 6, 3, 7]);
  });
  it('clips to 0..total-1', () => {
    expect(nearbyMissing(0, 2, 3, () => true)).toEqual([0, 1, 2]);
  });
  it('rounds fractional targets', () => {
    expect(nearbyMissing(4.6, 0, 10, () => true)).toEqual([5]);
  });
});
