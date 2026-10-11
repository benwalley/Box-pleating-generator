import { EPS, type Point } from './point.ts';

/** Axis-aligned rectangle, always normalized so x0 <= x1 and y0 <= y1. */
export interface Rect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export const rect = (x0: number, y0: number, x1: number, y1: number): Rect => ({
  x0: Math.min(x0, x1),
  y0: Math.min(y0, y1),
  x1: Math.max(x0, x1),
  y1: Math.max(y0, y1),
});

/** The L-infinity ball of radius r around c: a flap's square. */
export const squareAround = (c: Point, r: number): Rect => rect(c.x - r, c.y - r, c.x + r, c.y + r);

export const rectWidth = (r: Rect): number => r.x1 - r.x0;
export const rectHeight = (r: Rect): number => r.y1 - r.y0;

export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x0 = Math.max(a.x0, b.x0);
  const y0 = Math.max(a.y0, b.y0);
  const x1 = Math.min(a.x1, b.x1);
  const y1 = Math.min(a.y1, b.y1);
  if (x1 < x0 - EPS || y1 < y0 - EPS) return null;
  return { x0, y0, x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
}

export type Contact =
  | { readonly kind: 'none' }
  | { readonly kind: 'overlap'; readonly region: Rect }
  | { readonly kind: 'touch'; readonly region: Rect; readonly mid: Point };

/**
 * Classify how two closed rectangles meet: not at all, sharing only boundary
 * (an edge segment or a single corner point), or overlapping with positive area.
 */
export function rectContact(a: Rect, b: Rect): Contact {
  const i = intersectRect(a, b);
  if (!i) return { kind: 'none' };
  if (rectWidth(i) > EPS && rectHeight(i) > EPS) return { kind: 'overlap', region: i };
  return { kind: 'touch', region: i, mid: { x: (i.x0 + i.x1) / 2, y: (i.y0 + i.y1) / 2 } };
}

/** Strict interior test (boundary points are outside). */
export const containsOpen = (r: Rect, p: Point): boolean =>
  p.x > r.x0 + EPS && p.x < r.x1 - EPS && p.y > r.y0 + EPS && p.y < r.y1 - EPS;

export const containsClosed = (r: Rect, p: Point): boolean =>
  p.x >= r.x0 - EPS && p.x <= r.x1 + EPS && p.y >= r.y0 - EPS && p.y <= r.y1 + EPS;
