/**
 * The ownership field. Every point of the paper belongs to the flap whose
 * shape boundary is nearest. In box pleating the shape is the flap's square
 * and "nearest" is the L-infinity metric; a flap that only fits as a circle
 * next to a neighbour has extra tangent sides (see geometry/flap-shape.ts).
 *
 * The owner decides which way axis-parallel creases (contours) run at that
 * point, along the normal of the owner's nearest side, and their elevation,
 * the distance from the axis line through the owner's tip in that direction
 * (for a segment tip, measured from one end of it; see tipElevation).
 * For a square the directions are horizontal and vertical; a tangent side
 * facing a neighbour gives contours parallel to the line between the tips.
 */
import { sideNormals, support, tipElevation, tipRect } from '../geometry/flap-shape.ts';
import { EPS, cross, type Point } from '../geometry/point.ts';
import { containsOpen, type Rect } from '../geometry/rect.ts';
import type { Flap, Id } from '../model/types.ts';
import type { RiverGeometry } from '../tree/contacts.ts';

export interface Owner {
  readonly flap: Flap;
  /** Unit direction contours run in here (the normal of the owner's nearest side). */
  readonly dir: Point;
  /** True if another flap is equally near and disagrees on direction. */
  readonly ambiguous: boolean;
}

const TIE = 1e-9;

export const parallel = (a: Point, b: Point): boolean => Math.abs(cross(a, b)) < 1e-9;

/** Elevation of p under its owner: see tipElevation (the distance from the axis for a point tip). */
export const elevationAt = (o: Owner, p: Point): number => tipElevation(tipRect(o.flap), o.dir, p);

export class OwnershipField {
  private readonly shapes: ReadonlyArray<{ flap: Flap; normals: readonly Point[]; tip: Rect; supports: Float64Array }>;
  private readonly riverRects: ReadonlyArray<{ id: string; rect: Rect }>;
  /** Scratch space for ownerAt: each flap's gauge value and nearest side. */
  private readonly values: Float64Array;
  private readonly sides: Int32Array;

  constructor(flaps: readonly Flap[], rivers: readonly RiverGeometry[], circleNormals: ReadonlyMap<Id, readonly Point[]> = new Map()) {
    this.shapes = flaps.map((flap) => {
      const normals = sideNormals(circleNormals.get(flap.id));
      const tip = tipRect(flap);
      return { flap, normals, tip, supports: Float64Array.from(normals, (n) => support(tip, n)) };
    });
    this.riverRects = rivers.flatMap((g) => g.segments.map((s) => ({ id: `r:${g.river.id}`, rect: s.rect })));
    this.values = new Float64Array(flaps.length);
    this.sides = new Int32Array(flaps.length);
  }

  /** Side normals of each flap, for building candidate crease lines. */
  get flapShapes(): ReadonlyArray<{ flap: Flap; normals: readonly Point[]; tip: Rect }> {
    return this.shapes;
  }

  /** gauge() without allocating: stores the value and side index in the scratch arrays. */
  private evaluate(i: number, x: number, y: number): number {
    const { flap, normals, supports } = this.shapes[i]!;
    let side = 0;
    let best = x * normals[0]!.x + y * normals[0]!.y - supports[0]!;
    for (let k = 1; k < normals.length; k++) {
      const v = x * normals[k]!.x + y * normals[k]!.y - supports[k]!;
      if (v > best + EPS) {
        best = v;
        side = k;
      }
    }
    this.sides[i] = side;
    return (this.values[i] = best - flap.r);
  }

  ownerAt(x: number, y: number): Owner | null {
    let best = -1;
    let bestValue = Infinity;
    for (let i = 0; i < this.shapes.length; i++) {
      const v = this.evaluate(i, x, y);
      if (v < bestValue - TIE) {
        bestValue = v;
        best = i;
      }
    }
    if (best < 0) return null;
    const dir = this.shapes[best]!.normals[this.sides[best]!]!;
    let ambiguous = false;
    for (let i = 0; i < this.shapes.length; i++) {
      if (i === best || Math.abs(this.values[i]! - bestValue) >= TIE) continue;
      if (!parallel(this.shapes[i]!.normals[this.sides[i]!]!, dir)) {
        ambiguous = true;
        break;
      }
    }
    return { flap: this.shapes[best]!.flap, dir, ambiguous };
  }

  /**
   * Which element covers a point: "t:<id>" inside a rectangular tip (the flat
   * top of the box), "f:<id>" elsewhere in a flap's shape, "r:<id>" in a
   * river, or null for open paper.
   */
  elementAt(x: number, y: number): string | null {
    const p = { x, y };
    for (const s of this.shapes) if (containsOpen(s.tip, p)) return `t:${s.flap.id}`;
    for (let i = 0; i < this.shapes.length; i++) if (this.evaluate(i, x, y) < -TIE) return `f:${this.shapes[i]!.flap.id}`;
    for (const r of this.riverRects) if (containsOpen(r.rect, p)) return r.id;
    return null;
  }
}
