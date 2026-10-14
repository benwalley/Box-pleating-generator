/**
 * Contact detection: which elements touch, which overlap, and on which bank
 * of a river a contact happens. Touching elements share a tree node.
 *
 * A flap is a square in box pleating, but the square is only the grid's
 * approximation of the flap's true region, a circle of radius r. When two
 * squares overlap but the circles don't, the layout is still foldable with
 * creases off the grid (circle packing), so it is not an error: those flaps
 * are reported as circle contacts and get tangent sides in the crease field.
 */
import { closestPoints, flapRect, tipCheb, tipEuclid, tipRect } from '../geometry/flap-shape.ts';
import { euclid, type Point } from '../geometry/point.ts';
import { isAtCap, sideOf, stripSegments, type Side, type StripSegment } from '../geometry/polyline.ts';
import { rectContact } from '../geometry/rect.ts';
import { flapName, riverName } from '../model/naming.ts';
import { flapBasePort, riverPort, type PortKey } from '../model/ports.ts';
import type { Design, Flap, Id, River } from '../model/types.ts';
import type { Issue } from '../validation/issues.ts';

export interface RiverGeometry {
  readonly river: River;
  readonly segments: readonly StripSegment[];
}

/** A flap whose square crosses a river, though its circle clears the river at `point`. */
export interface CircleCorner {
  readonly flapId: Id;
  readonly riverId: Id;
  readonly point: Point;
}

export interface ContactResult {
  readonly unions: ReadonlyArray<readonly [PortKey, PortKey]>;
  readonly issues: readonly Issue[];
  readonly circleCorners: readonly CircleCorner[];
}

/** Tolerance for comparing Euclidean distances, which are irrational in general. */
export const CIRCLE_EPS = 1e-9;

export const riverGeometry = (river: River): RiverGeometry => ({
  river,
  segments: stripSegments(river.points, river.width / 2),
});

type BankContact = { kind: 'side'; side: Side } | { kind: 'cap' } | { kind: 'none' };

/** Classify where a contact point lies relative to one river segment. */
function bankAt(seg: StripSegment, p: { x: number; y: number }): BankContact {
  if (isAtCap(seg, p)) return { kind: 'cap' };
  const side = sideOf(seg, p);
  return side ? { kind: 'side', side } : { kind: 'none' };
}

export function computeContacts(design: Design, rivers: readonly RiverGeometry[]): ContactResult {
  const unions: Array<readonly [PortKey, PortKey]> = [];
  const issues: Issue[] = [];
  const circleCorners: CircleCorner[] = [];
  const flaps = design.flaps;
  const fName = (f: Flap) => flapName(design, f.id);
  const rName = (r: River) => riverName(design, r.id);

  // Flap to flap: boxes overlap iff the Chebyshev distance between the tips
  // is less than r1 + r2; circles overlap iff the Euclidean distance is.
  for (let i = 0; i < flaps.length; i++) {
    for (let j = i + 1; j < flaps.length; j++) {
      const a = flaps[i]!;
      const b = flaps[j]!;
      const d = tipCheb(a, b);
      const need = a.r + b.r;
      if (d >= need) {
        if (d === need) unions.push([flapBasePort(a.id), flapBasePort(b.id)]);
        continue;
      }
      const e = tipEuclid(a, b);
      if (e < need - CIRCLE_EPS) {
        issues.push({
          code: 'flap-overlap',
          severity: 'error',
          blocking: true,
          message: `${fName(a)} and ${fName(b)} overlap even as circles (by ${formatLength(need - e)}). Move them apart or shorten one.`,
          refs: [{ kind: 'flap', id: a.id }, { kind: 'flap', id: b.id }],
        });
      } else if (e <= need + CIRCLE_EPS) {
        // Circles touching: the flaps share a hub, just as touching squares do.
        unions.push([flapBasePort(a.id), flapBasePort(b.id)]);
      }
    }
  }

  // Flap to river.
  for (const g of rivers) {
    for (const f of flaps) {
      const sq = flapRect(f);
      const tip = tipRect(f);
      let overlapped = false;
      let capTouch = false;
      const sides = new Set<Side>();
      for (const seg of g.segments) {
        const c = rectContact(sq, seg.rect);
        let mid = c.kind === 'touch' ? c.mid : null;
        if (c.kind === 'overlap') {
          // The square crosses the strip; the flap still fits if its circle clears it.
          const [t, q] = closestPoints(tip, seg.rect);
          const e = euclid(t, q);
          if (e < f.r - CIRCLE_EPS) {
            overlapped = true;
            continue;
          }
          circleCorners.push({ flapId: f.id, riverId: g.river.id, point: q });
          if (e <= f.r + CIRCLE_EPS) mid = q;
        }
        if (!mid) continue;
        const bank = bankAt(seg, mid);
        if (bank.kind === 'side') sides.add(bank.side);
        else if (bank.kind === 'cap') capTouch = true;
      }
      if (overlapped) {
        issues.push({
          code: 'flap-river-overlap',
          severity: 'error',
          blocking: true,
          message: `${fName(f)} overlaps river ${rName(g.river)}. A flap may touch a river bank but not cross it.`,
          refs: [{ kind: 'flap', id: f.id }, { kind: 'river', id: g.river.id }],
        });
        continue;
      }
      for (const side of sides) unions.push([flapBasePort(f.id), riverPort(g.river.id, side)]);
      if (sides.size === 2) {
        issues.push({
          code: 'river-self-loop',
          severity: 'error',
          message: `${fName(f)} touches both banks of river ${rName(g.river)}, so the river would connect a node to itself.`,
          refs: [{ kind: 'flap', id: f.id }, { kind: 'river', id: g.river.id }],
        });
      }
      if (capTouch && !sides.size) {
        issues.push({
          code: 'river-cap-contact',
          severity: 'warning',
          message: `${fName(f)} only touches the end of river ${rName(g.river)}. Ends don't connect anything; route the river along the flap instead.`,
          refs: [{ kind: 'flap', id: f.id }, { kind: 'river', id: g.river.id }],
        });
      }
    }
  }

  // River to river.
  for (let i = 0; i < rivers.length; i++) {
    for (let j = i + 1; j < rivers.length; j++) {
      const ga = rivers[i]!;
      const gb = rivers[j]!;
      let overlapped = false;
      let capTouch = false;
      const pairs = new Set<string>();
      for (const sa of ga.segments) {
        for (const sb of gb.segments) {
          const c = rectContact(sa.rect, sb.rect);
          if (c.kind === 'overlap') overlapped = true;
          if (c.kind !== 'touch') continue;
          const ba = bankAt(sa, c.mid);
          const bb = bankAt(sb, c.mid);
          if (ba.kind === 'side' && bb.kind === 'side') pairs.add(`${ba.side}${bb.side}`);
          else if (ba.kind === 'cap' || bb.kind === 'cap') capTouch = true;
        }
      }
      if (overlapped) {
        issues.push({
          code: 'river-overlap',
          severity: 'error',
          blocking: true,
          message: `Rivers ${rName(ga.river)} and ${rName(gb.river)} overlap. Rivers may run side by side but not cross.`,
          refs: [{ kind: 'river', id: ga.river.id }, { kind: 'river', id: gb.river.id }],
        });
        continue;
      }
      for (const key of pairs) {
        unions.push([riverPort(ga.river.id, key[0] as Side), riverPort(gb.river.id, key[1] as Side)]);
      }
      if (capTouch && !pairs.size) {
        issues.push({
          code: 'river-cap-contact',
          severity: 'warning',
          message: `Rivers ${rName(ga.river)} and ${rName(gb.river)} meet only at an end. Ends don't connect anything; run them side by side instead.`,
          refs: [{ kind: 'river', id: ga.river.id }, { kind: 'river', id: gb.river.id }],
        });
      }
    }
  }

  return { unions, issues, circleCorners };
}

/** Lengths are integers on the grid but irrational in circle packing. */
export const formatLength = (v: number): string => {
  const r = Math.round(v * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(2);
};
