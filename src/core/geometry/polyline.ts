/**
 * Orthogonal polylines: the centerlines of rivers. Every segment is horizontal
 * or vertical. A river of width w occupies the strip within w/2 of its
 * centerline, with square corners at bends and flat caps at the two ends.
 */
import { EPS, add, cross, dot, isInteger, mirrorX, samePoint, scale, sub, type Point } from './point.ts';
import { rect, type Rect } from './rect.ts';

export type Polyline = readonly Point[];

/** The two banks of a river. Side "a" is to the left of travel in math coordinates. */
export type Side = 'a' | 'b';

export interface StripSegment {
  readonly index: number;
  readonly a: Point;
  readonly b: Point;
  /** Unit axis direction from a to b. */
  readonly dir: Point;
  /** Area this segment contributes to the river strip. */
  readonly rect: Rect;
  readonly isFirst: boolean;
  readonly isLast: boolean;
}

export const isAxisAligned = (a: Point, b: Point): boolean =>
  Math.abs(a.x - b.x) <= EPS || Math.abs(a.y - b.y) <= EPS;

export function direction(a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (Math.abs(dx) > EPS) return { x: Math.sign(dx), y: 0 };
  if (Math.abs(dy) > EPS) return { x: 0, y: Math.sign(dy) };
  return { x: 0, y: 0 };
}

/** Unit normal pointing toward side "a". */
export const normalA = (dir: Point): Point => ({ x: -dir.y, y: dir.x });

export function isOrthogonalPolyline(points: Polyline): boolean {
  if (points.length < 2) return false;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (samePoint(a, b) || !isAxisAligned(a, b)) return false;
  }
  return true;
}

/** Drop repeated points and interior points that don't change direction. */
export function normalizePolyline(points: Polyline): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    if (out.length && samePoint(out[out.length - 1]!, p)) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const d1 = direction(out[i - 1]!, out[i]!);
    const d2 = direction(out[i]!, out[i + 1]!);
    if (Math.abs(cross(d1, d2)) <= EPS && dot(d1, d2) > 0) out.splice(i, 1);
  }
  return out;
}

export function stripSegments(points: Polyline, halfWidth: number): StripSegment[] {
  const segs: StripSegment[] = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dir = direction(a, b);
    const isFirst = i === 0;
    const isLast = i === n - 2;
    // Extend along the axis only at bends, so the corner square is filled
    // but the two ends of the river stay flat.
    const pa = sub(a, scale(dir, isFirst ? 0 : halfWidth));
    const pb = add(b, scale(dir, isLast ? 0 : halfWidth));
    const r =
      dir.x !== 0
        ? rect(pa.x, a.y - halfWidth, pb.x, a.y + halfWidth)
        : rect(a.x - halfWidth, pa.y, a.x + halfWidth, pb.y);
    segs.push({ index: i, a, b, dir, rect: r, isFirst, isLast });
  }
  return segs;
}

/** Which bank of the segment a point lies on; null if it is on the centerline. */
export function sideOf(seg: StripSegment, p: Point): Side | null {
  const c = cross(seg.dir, sub(p, seg.a));
  if (c > EPS) return 'a';
  if (c < -EPS) return 'b';
  return null;
}

/**
 * Whether a point (typically the midpoint of a contact) sits against a flat
 * end cap of the river rather than along one of its banks.
 */
export function isAtCap(seg: StripSegment, p: Point): boolean {
  if (seg.isFirst && dot(sub(p, seg.a), seg.dir) <= EPS) return true;
  if (seg.isLast && dot(sub(p, seg.b), seg.dir) >= -EPS) return true;
  return false;
}

/**
 * Offset an orthogonal polyline toward side "a" by d (negative d moves toward
 * side "b"). Bends move diagonally so segments stay orthogonal; ends move
 * only perpendicular to their segment.
 */
export function offsetPolyline(points: Polyline, d: number): Point[] {
  const n = points.length;
  if (n < 2) return [...points];
  const normals: Point[] = [];
  for (let i = 0; i < n - 1; i++) normals.push(normalA(direction(points[i]!, points[i + 1]!)));
  return points.map((p, i) => {
    if (i === 0) return add(p, scale(normals[0]!, d));
    if (i === n - 1) return add(p, scale(normals[n - 2]!, d));
    return add(p, scale(add(normals[i - 1]!, normals[i]!), d));
  });
}

export const translatePolyline = (points: Polyline, dx: number, dy: number): Point[] =>
  points.map((p) => ({ x: p.x + dx, y: p.y + dy }));

export const mirrorPolyline = (points: Polyline, axis: number): Point[] =>
  points.map((p) => mirrorX(p, axis));

export function samePolyline(a: Polyline, b: Polyline): boolean {
  return a.length === b.length && a.every((p, i) => samePoint(p, b[i]!));
}

export function polylineBounds(points: Polyline): Rect {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return rect(x0, y0, x1, y1);
}

/**
 * Lattice of valid centerline coordinates for a river of width w. Banks must
 * fall on integer grid lines, so the centerline sits on integers for even
 * widths and on half-integers for odd widths.
 */
export function snapToLattice(v: number, width: number): number {
  return width % 2 === 0 ? Math.round(v) : Math.floor(v) + 0.5;
}

export const onLattice = (v: number, width: number): boolean =>
  width % 2 === 0 ? isInteger(v) : isInteger(v - 0.5);

/**
 * Snap a river's centerline so that both banks land on grid lines.
 * Bends sit on the lattice in both coordinates. The two ends sit on the lattice
 * across the river but on an integer along it, so each end cap is a grid line.
 */
export function snapRiverPoints(points: Polyline, width: number): Point[] {
  const n = points.length;
  return points.map((p, i) => {
    if (n < 2 || (i > 0 && i < n - 1)) {
      return { x: snapToLattice(p.x, width), y: snapToLattice(p.y, width) };
    }
    const other = i === 0 ? points[1]! : points[n - 2]!;
    const horizontal = Math.abs(other.y - p.y) <= Math.abs(other.x - p.x);
    // Round the free coordinate away from the neighbour so the river never shrinks.
    const roundAway = (v: number, towards: number): number =>
      isInteger(v) ? Math.round(v) : v > towards ? Math.ceil(v) : Math.floor(v);
    return horizontal
      ? { x: roundAway(p.x, other.x), y: snapToLattice(p.y, width) }
      : { x: snapToLattice(p.x, width), y: roundAway(p.y, other.y) };
  });
}

/** Force a freely drawn point to continue orthogonally from the previous one. */
export function orthogonalize(prev: Point, next: Point): Point {
  return Math.abs(next.x - prev.x) >= Math.abs(next.y - prev.y)
    ? { x: next.x, y: prev.y }
    : { x: prev.x, y: next.y };
}

/** Index of the point that mirrors point i within the same polyline, or -1. */
export function mirrorIndex(points: Polyline, i: number, axis: number): number {
  const m = mirrorX(points[i]!, axis);
  return points.findIndex((q) => samePoint(q, m));
}
