/** Find what is under the pointer, in priority order. */
import { cheb, type Point } from '../core/geometry/point.ts';
import { flapRect, tipCenter, tipCheb, tipGaps } from '../core/geometry/flap-shape.ts';
import { containsClosed } from '../core/geometry/rect.ts';
import type { Id } from '../core/model/types.ts';
import type { AppState } from '../state/types.ts';
import { flapHandles, riverHandles } from './handles.ts';

export type Hit =
  | { readonly kind: 'flap-tip'; readonly id: Id }
  | { readonly kind: 'flap-body'; readonly id: Id }
  | { readonly kind: 'flap-resize'; readonly id: Id; readonly cursor: string }
  | { readonly kind: 'river-body'; readonly id: Id }
  | { readonly kind: 'river-segment'; readonly id: Id; readonly index: number; readonly horizontal: boolean }
  | { readonly kind: 'river-end'; readonly id: Id; readonly index: number; readonly horizontal: boolean }
  | { readonly kind: 'river-width'; readonly id: Id; readonly segment: number; readonly horizontal: boolean };

const near = (p: Point, q: Point, tol: number) => cheb(p, q) <= tol;

export function hitTest(state: AppState, p: Point, tol: number): Hit | null {
  const { design, analysis, ui } = state;
  const sel = ui.selection;

  // 1. Handles of the selected element.
  if (sel?.kind === 'flap') {
    const f = design.flaps.find((q) => q.id === sel.id);
    if (f) {
      for (const h of flapHandles(f)) if (near(p, h, tol * 1.4)) return { kind: 'flap-resize', id: f.id, cursor: h.cursor };
      // Anywhere along the box's outline also resizes.
      const d = tipCheb(p, f);
      if (Math.abs(d - f.r) <= tol * 0.8) {
        const g = tipGaps(p, f);
        return { kind: 'flap-resize', id: f.id, cursor: g.dx > g.dy ? 'ew-resize' : 'ns-resize' };
      }
    }
  }
  if (sel?.kind === 'river') {
    const r = design.rivers.find((q) => q.id === sel.id);
    if (r && r.points.length >= 2) {
      const h = riverHandles(r);
      if (near(p, h.width, tol * 1.4)) return { kind: 'river-width', id: r.id, segment: h.width.segment, horizontal: h.width.horizontal };
      for (const e of h.ends) if (near(p, e, tol * 1.4)) return { kind: 'river-end', id: r.id, index: e.index, horizontal: e.horizontal };
      for (const s of h.segments) if (near(p, s, tol * 1.4)) return { kind: 'river-segment', id: r.id, index: s.index, horizontal: s.horizontal };
    }
  }

  // 2. Flap tips.
  let bestTip: { id: Id; d: number } | null = null;
  for (const f of design.flaps) {
    // A rectangular tip can be grabbed anywhere along it, or by its centre dot.
    const d = Math.min(tipCheb(p, f), cheb(p, tipCenter(f)));
    if (d <= Math.max(tol, 0.3) && (!bestTip || d < bestTip.d)) bestTip = { id: f.id, d };
  }
  if (bestTip) return { kind: 'flap-tip', id: bestTip.id };

  // 3. River strips (narrow, so they win over squares).
  for (const g of analysis.rivers) {
    if (g.segments.some((s) => containsClosed(s.rect, p))) return { kind: 'river-body', id: g.river.id };
  }

  // 4. Flap boxes, smallest first.
  let best: { id: Id; area: number } | null = null;
  for (const f of design.flaps) {
    const box = flapRect(f);
    const area = (box.x1 - box.x0) * (box.y1 - box.y0);
    if (containsClosed(box, p) && (!best || area < best.area)) best = { id: f.id, area };
  }
  return best ? { kind: 'flap-body', id: best.id } : null;
}
