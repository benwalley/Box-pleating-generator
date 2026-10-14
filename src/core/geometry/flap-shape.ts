/**
 * The shape a flap claims on the paper. Its tip is a point or a rectangle T
 * (from (x, y) to (x + w, y + h)), and in box pleating the shape is every
 * point within r of T in the L-infinity metric: a square of side 2r for a
 * point tip, a (w + 2r) x (h + 2r) box for a rectangular one.
 *
 * A flap that only fits as a circle next to some neighbour gets an extra
 * side for each such neighbour: the line tangent to its circle (the points
 * at Euclidean distance r from T), facing that neighbour. The shape is the
 * polygon with those side normals, and its "gauge" generalizes the
 * Chebyshev distance:
 *
 *   gauge(p) = max over side normals n of (p . n - support(T, n))  -  r
 *
 * where support(T, n) is the largest t . n over points t of the tip. With
 * only the four axis normals this is the L-infinity distance from p to T,
 * minus r (cheb(p, tip) - r for a point tip).
 */
import { EPS, cross, dot, normalize, sub, type Point } from './point.ts';
import { rect, type Rect } from './rect.ts';

/** Anything with a tip: a flap, or a bare point (a point tip). */
export interface TipLike {
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly h?: number;
}

export const tipRect = (t: TipLike): Rect => rect(t.x, t.y, t.x + (t.w ?? 0), t.y + (t.h ?? 0));

/** The box a flap claims in box pleating: its tip grown by r on every side. */
export const flapRect = (f: TipLike & { readonly r: number }): Rect => {
  const t = tipRect(f);
  return rect(t.x0 - f.r, t.y0 - f.r, t.x1 + f.r, t.y1 + f.r);
};

export const tipCenter = (t: TipLike): Point => ({ x: t.x + (t.w ?? 0) / 2, y: t.y + (t.h ?? 0) / 2 });

/** Gaps between two tips along x and along y (0 where their extents overlap). */
export function tipGaps(a: TipLike, b: TipLike): { dx: number; dy: number } {
  const ra = tipRect(a);
  const rb = tipRect(b);
  return {
    dx: Math.max(0, rb.x0 - ra.x1, ra.x0 - rb.x1),
    dy: Math.max(0, rb.y0 - ra.y1, ra.y0 - rb.y1),
  };
}

/** L-infinity distance between two tips: the box-pleating distance. */
export function tipCheb(a: TipLike, b: TipLike): number {
  const { dx, dy } = tipGaps(a, b);
  return Math.max(dx, dy);
}

/** Euclidean distance between two tips: the circle-packing distance. */
export function tipEuclid(a: TipLike, b: TipLike): number {
  const { dx, dy } = tipGaps(a, b);
  return Math.hypot(dx, dy);
}

/** A closest pair of points between two rectangles (midpoints of overlapping extents). */
export function closestPoints(a: Rect, b: Rect): [Point, Point] {
  const axis = (a0: number, a1: number, b0: number, b1: number): [number, number] => {
    if (b0 > a1) return [a1, b0];
    if (a0 > b1) return [a0, b1];
    const m = (Math.max(a0, b0) + Math.min(a1, b1)) / 2;
    return [m, m];
  };
  const [ax, bx] = axis(a.x0, a.x1, b.x0, b.x1);
  const [ay, by] = axis(a.y0, a.y1, b.y0, b.y1);
  return [{ x: ax, y: ay }, { x: bx, y: by }];
}

/** Largest t . n over points t of the tip rectangle. */
export const support = (t: Rect, n: Point): number => (n.x > 0 ? t.x1 : t.x0) * n.x + (n.y > 0 ? t.y1 : t.y0) * n.y;

/**
 * The corner of the tip that supports side normal n (largest t . n), and
 * its distance along the tip's edges from the anchor corner (x0, y0). Ties
 * (a side parallel to a tip edge) go to the corner nearest the anchor.
 */
export function supportCorner(t: Rect, n: Point): { corner: Point; offset: number } {
  const corners = [
    { x: t.x0, y: t.y0 },
    { x: t.x1, y: t.y0 },
    { x: t.x0, y: t.y1 },
    { x: t.x1, y: t.y1 },
  ];
  let best = corners[0]!;
  for (const c of corners) if (dot(c, n) > dot(best, n) + 1e-9) best = c;
  return { corner: best, offset: best.x - t.x0 + (best.y - t.y0) };
}

/**
 * Elevation of p for contours running along n (the side normal nearest p).
 * A point tip folds to the flap's tip, so elevation is the distance from
 * the axis line through it. A segment tip of length L folds to an edge of
 * the flap spanning elevations 0 (at the anchor corner) to L, so elevation
 * is measured from the supporting end of the tip, plus that end's distance
 * along the tip:
 *
 *   elevation(p) = offset(S) + |cross(n, p - S)|,  S = supportCorner(T, n)
 *
 * For a horizontal segment that is |x - x0| above and below it and
 * w + |y - y0| to its right, so contours on either side of each corner
 * ridge meet at equal elevations.
 */
export function tipElevation(t: Rect, n: Point, p: Point): number {
  const { corner, offset } = supportCorner(t, n);
  return offset + Math.abs(cross(n, sub(p, corner)));
}

/**
 * The square's side normals. The order breaks ties: on a square's diagonal
 * the vertical normals win, matching the box-pleating convention that
 * contours there run vertically.
 */
export const AXIS_NORMALS: readonly Point[] = [
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
];

const sameDirection = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

/** All side normals of a flap: the four axis normals, then any tangent sides (deduplicated). */
export function sideNormals(extra: readonly Point[] = []): Point[] {
  const out = [...AXIS_NORMALS];
  for (const e of extra) {
    const n = normalize(e);
    if (!out.some((m) => sameDirection(m, n))) out.push(n);
  }
  return out;
}

/** Unit normal of the tangent side facing `toward`: from the nearest point of the tip toward it. */
export const tangentNormal = (tip: TipLike, toward: Point): Point => {
  const [from] = closestPoints(tipRect(tip), rect(toward.x, toward.y, toward.x, toward.y));
  return normalize(sub(toward, from));
};

export interface GaugeResult {
  readonly value: number;
  /** The side normal that attains the maximum: the side of the shape nearest p. */
  readonly normal: Point;
}

export function gauge(tip: TipLike, r: number, normals: readonly Point[], p: Point): GaugeResult {
  const t = tipRect(tip);
  let best = normals[0]!;
  let bestValue = dot(p, best) - support(t, best);
  for (let i = 1; i < normals.length; i++) {
    const v = dot(p, normals[i]!) - support(t, normals[i]!);
    if (v > bestValue + EPS) {
      bestValue = v;
      best = normals[i]!;
    }
  }
  return { value: bestValue - r, normal: best };
}

/** Normals sorted by angle, so consecutive ones are adjacent sides of the shape. */
export function normalsByAngle(normals: readonly Point[]): Point[] {
  return [...normals].sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
}

/** The corner of the shape between the sides with normals a and b. */
export function shapeCorner(tip: TipLike, r: number, a: Point, b: Point): Point {
  const t = tipRect(tip);
  // Solve v . a = support(a) + r and v . b = support(b) + r.
  const ca = support(t, a) + r;
  const cb = support(t, b) + r;
  const det = a.x * b.y - a.y * b.x;
  return { x: (ca * b.y - cb * a.y) / det, y: (a.x * cb - b.x * ca) / det };
}

/** Corners of the shape, in angular order around the tip. */
export function shapePolygon(tip: TipLike, r: number, normals: readonly Point[]): Point[] {
  const sorted = normalsByAngle(normals);
  return sorted.map((a, i) => shapeCorner(tip, r, a, sorted[(i + 1) % sorted.length]!));
}
