/**
 * Positions of the drag handles shown on the selected element. Shared by the
 * renderer and the hit tester so they always agree.
 */
import { add, scale, sub, type Point } from '../core/geometry/point.ts';
import { direction, normalA } from '../core/geometry/polyline.ts';
import type { Flap, River } from '../core/model/types.ts';

export interface FlapHandle {
  readonly x: number;
  readonly y: number;
  /** Cursor hint: which way the handle drags. */
  readonly cursor: 'nwse-resize' | 'nesw-resize' | 'ew-resize' | 'ns-resize';
}

export function flapHandles(f: Flap): FlapHandle[] {
  const { x, y, r } = f;
  return [
    { x: x - r, y: y - r, cursor: 'nwse-resize' },
    { x: x + r, y: y + r, cursor: 'nwse-resize' },
    { x: x + r, y: y - r, cursor: 'nesw-resize' },
    { x: x - r, y: y + r, cursor: 'nesw-resize' },
    { x: x - r, y, cursor: 'ew-resize' },
    { x: x + r, y, cursor: 'ew-resize' },
    { x, y: y - r, cursor: 'ns-resize' },
    { x, y: y + r, cursor: 'ns-resize' },
  ];
}

export interface RiverHandles {
  /** One per segment, at its midpoint; drags the segment sideways. */
  readonly segments: ReadonlyArray<{ index: number; x: number; y: number; horizontal: boolean }>;
  /** The two ends; drag along their segment to lengthen or shorten. */
  readonly ends: ReadonlyArray<{ index: number; x: number; y: number; horizontal: boolean }>;
  /** On bank B of the longest segment; drags the width. */
  readonly width: { x: number; y: number; segment: number; horizontal: boolean };
}

export function riverHandles(r: River): RiverHandles {
  const pts = r.points;
  const segments = [];
  let longest = 0;
  let longestLen = -1;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
    if (len > longestLen) {
      longestLen = len;
      longest = i;
    }
    segments.push({ index: i, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, horizontal: a.y === b.y });
  }
  const last = pts.length - 1;
  const ends = [
    { index: 0, x: pts[0]!.x, y: pts[0]!.y, horizontal: pts[0]!.y === pts[1]!.y },
    { index: last, x: pts[last]!.x, y: pts[last]!.y, horizontal: pts[last]!.y === pts[last - 1]!.y },
  ];
  const s = segments[longest]!;
  const dir = direction(pts[longest]!, pts[longest + 1]!);
  const w = add({ x: s.x, y: s.y }, scale(normalA(dir), -r.width / 2));
  return { segments, ends, width: { x: w.x, y: w.y, segment: longest, horizontal: s.horizontal } };
}

/** Width implied by dragging the width handle to p (distance from bank A). */
export function widthFromHandle(r: River, segment: number, p: Point): number {
  const a = r.points[segment]!;
  const dir = direction(a, r.points[segment + 1]!);
  const na = normalA(dir);
  const bankA = add(a, scale(na, r.width / 2));
  const d = sub(p, bankA);
  return -(d.x * na.x + d.y * na.y);
}
