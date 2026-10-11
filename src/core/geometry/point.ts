/** Immutable 2D point in grid units. y grows downward (screen convention). */
export interface Point {
  readonly x: number;
  readonly y: number;
}

export const EPS = 1e-9;

export const pt = (x: number, y: number): Point => ({ x, y });

/** Chebyshev (L-infinity) distance: the metric box pleating uses instead of Euclidean. */
export const cheb = (a: Point, b: Point): number =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export const samePoint = (a: Point, b: Point, eps = EPS): boolean =>
  Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
/** z-component of the 2D cross product. */
export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;

/** Mirror across the vertical line x = axis (book symmetry). */
export const mirrorX = (p: Point, axis: number): Point => ({ x: 2 * axis - p.x, y: p.y });

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const isInteger = (v: number, eps = EPS): boolean => Math.abs(v - Math.round(v)) <= eps;
