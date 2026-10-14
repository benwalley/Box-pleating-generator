/**
 * Book symmetry: the design is mirrored left/right about the vertical line
 * x = gridSize / 2. Elements are linked to their mirror image through
 * `mirrorId`; an element on the axis is linked to itself.
 */
import { mirrorPolyline, polylineBounds, samePolyline } from '../geometry/polyline.ts';
import { EPS } from '../geometry/point.ts';
import { createId } from '../model/ids.ts';
import { symmetryAxis } from '../model/design.ts';
import type { Design, ElementRef, Flap, River } from '../model/types.ts';

export const isSelfMirror = (e: Flap | River): boolean => e.mirrorId === e.id;

/** The mirror image of a flap's tip and length. A tip from x to x + w mirrors to n - x - w .. n - x. */
export const mirrorFlap = (f: Flap, gridSize: number): Pick<Flap, 'x' | 'y' | 'w' | 'h' | 'r'> => ({
  x: gridSize - f.x - f.w,
  y: f.y,
  w: f.w,
  h: f.h,
  r: f.r,
});

/** True when the flap's tip is centred on the axis (so it is its own mirror image). */
export const flapOnAxis = (f: Flap, gridSize: number): boolean => Math.abs(2 * f.x + f.w - gridSize) <= EPS;

/** True when mirroring the river reproduces it point for point (a river lying along the axis). */
export function mirrorsInPlace(points: River['points'], gridSize: number): boolean {
  return samePolyline(mirrorPolyline(points, gridSize / 2), points);
}

/** True when the mirrored river is the same strip, possibly traversed the other way. */
export function isMirrorImage(a: River, b: River, gridSize: number): boolean {
  if (a.width !== b.width) return false;
  const m = mirrorPolyline(a.points, gridSize / 2);
  return samePolyline(m, b.points) || samePolyline([...m].reverse(), b.points);
}

/** Recompute every mirror link from geometry. Idempotent. */
export function linkMirrors(d: Design): Design {
  if (!d.symmetry.book) {
    return {
      ...d,
      flaps: d.flaps.map((f) => (f.mirrorId ? { ...f, mirrorId: null } : f)),
      rivers: d.rivers.map((r) => (r.mirrorId ? { ...r, mirrorId: null } : r)),
    };
  }
  const flapLinks = new Map<string, string>();
  for (const f of d.flaps) {
    if (flapLinks.has(f.id)) continue;
    if (flapOnAxis(f, d.gridSize)) {
      flapLinks.set(f.id, f.id);
      continue;
    }
    const m = mirrorFlap(f, d.gridSize);
    const partner = d.flaps.find(
      (g) => g.id !== f.id && !flapLinks.has(g.id) && g.x === m.x && g.y === m.y && g.w === m.w && g.h === m.h && g.r === m.r,
    );
    if (partner) {
      flapLinks.set(f.id, partner.id);
      flapLinks.set(partner.id, f.id);
    }
  }
  const riverLinks = new Map<string, string>();
  for (const r of d.rivers) {
    if (riverLinks.has(r.id)) continue;
    if (isMirrorImage(r, r, d.gridSize)) {
      riverLinks.set(r.id, r.id);
      continue;
    }
    const partner = d.rivers.find(
      (q) => q.id !== r.id && !riverLinks.has(q.id) && isMirrorImage(r, q, d.gridSize),
    );
    if (partner) {
      riverLinks.set(r.id, partner.id);
      riverLinks.set(partner.id, r.id);
    }
  }
  return {
    ...d,
    flaps: d.flaps.map((f) => ({ ...f, mirrorId: flapLinks.get(f.id) ?? null })),
    rivers: d.rivers.map((r) => ({ ...r, mirrorId: riverLinks.get(r.id) ?? null })),
  };
}

export function unpairedElements(d: Design): ElementRef[] {
  if (!d.symmetry.book) return [];
  return [
    ...d.flaps.filter((f) => !f.mirrorId).map((f) => ({ kind: 'flap' as const, id: f.id })),
    ...d.rivers.filter((r) => !r.mirrorId).map((r) => ({ kind: 'river' as const, id: r.id })),
  ];
}

/**
 * Make the design symmetric: unpaired elements on the left half are copied
 * to the right, unpaired elements on the right half are removed.
 */
export function makeSymmetric(d: Design): Design {
  const linked = linkMirrors({ ...d, symmetry: { book: true } });
  const axis = symmetryAxis(linked);
  const flaps: Flap[] = [];
  for (const f of linked.flaps) {
    if (f.mirrorId) flaps.push(f);
    else if (f.x + f.w / 2 < axis) {
      flaps.push(f, { ...f, id: createId('f'), label: '', ...mirrorFlap(f, d.gridSize) });
    }
  }
  const rivers: River[] = [];
  for (const r of linked.rivers) {
    const b = polylineBounds(r.points);
    const cx = (b.x0 + b.x1) / 2;
    if (r.mirrorId) rivers.push(r);
    else if (cx < axis - EPS) {
      rivers.push(r, { ...r, id: createId('r'), label: '', points: mirrorPolyline(r.points, axis) });
    }
  }
  return linkMirrors({ ...linked, flaps, rivers });
}
