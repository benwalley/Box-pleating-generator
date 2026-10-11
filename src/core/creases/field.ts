/**
 * The ownership field. Every point of the paper belongs to the flap whose
 * square boundary is nearest in the L-infinity metric. The owner decides
 * which way axis-parallel creases run at that point (perpendicular to the
 * owner's nearest square edge) and their elevation (distance from the axis
 * line through the owner's tip).
 */
import { containsOpen, squareAround, type Rect } from '../geometry/rect.ts';
import type { Flap } from '../model/types.ts';
import type { RiverGeometry } from '../tree/contacts.ts';

/** H: axis-parallel creases run horizontally here. V: vertically. */
export type Orientation = 'H' | 'V';

export interface Owner {
  readonly flap: Flap;
  readonly orientation: Orientation;
  /** True if another flap is equally near and disagrees on orientation. */
  readonly ambiguous: boolean;
}

const TIE = 1e-9;

export class OwnershipField {
  private readonly flaps: readonly Flap[];
  private readonly squares: ReadonlyArray<{ id: string; rect: Rect }>;
  private readonly riverRects: ReadonlyArray<{ id: string; rect: Rect }>;

  constructor(flaps: readonly Flap[], rivers: readonly RiverGeometry[]) {
    this.flaps = flaps;
    this.squares = flaps.map((f) => ({ id: `f:${f.id}`, rect: squareAround(f, f.r) }));
    this.riverRects = rivers.flatMap((g) => g.segments.map((s) => ({ id: `r:${g.river.id}`, rect: s.rect })));
  }

  private static value(f: Flap, x: number, y: number): number {
    return Math.max(Math.abs(x - f.x), Math.abs(y - f.y)) - f.r;
  }

  private static orientation(f: Flap, x: number, y: number): Orientation {
    return Math.abs(x - f.x) > Math.abs(y - f.y) ? 'H' : 'V';
  }

  ownerAt(x: number, y: number): Owner | null {
    let best: Flap | null = null;
    let bestValue = Infinity;
    for (const f of this.flaps) {
      const v = OwnershipField.value(f, x, y);
      if (v < bestValue - TIE) {
        bestValue = v;
        best = f;
      }
    }
    if (!best) return null;
    const orientation = OwnershipField.orientation(best, x, y);
    let ambiguous = false;
    for (const f of this.flaps) {
      if (f === best) continue;
      if (Math.abs(OwnershipField.value(f, x, y) - bestValue) < TIE && OwnershipField.orientation(f, x, y) !== orientation) {
        ambiguous = true;
        break;
      }
    }
    return { flap: best, orientation, ambiguous };
  }

  /** Which element covers a point: "f:<id>", "r:<id>", or null for open paper. */
  elementAt(x: number, y: number): string | null {
    const p = { x, y };
    for (const s of this.squares) if (containsOpen(s.rect, p)) return s.id;
    for (const r of this.riverRects) if (containsOpen(r.rect, p)) return r.id;
    return null;
  }
}
