/**
 * Select tool: click to select, drag to move, drag handles to resize.
 * Dragging empty paper pans the view.
 */
import * as ops from '../../core/model/operations.ts';
import { tipCenter, tipCheb } from '../../core/geometry/flap-shape.ts';
import type { Design, Flap, Id } from '../../core/model/types.ts';
import { widthFromHandle } from '../handles.ts';
import type { Hit } from '../hit-test.ts';
import { PanDrag, type Tool, type ToolContext, type ToolPointer } from './tool.ts';

type Drag =
  | { kind: 'move-flap'; id: Id; startX: number; startY: number; fx: number; fy: number }
  | { kind: 'resize-flap'; id: Id; tip: Flap }
  | { kind: 'stretch-flap'; id: Id; tip: Flap; sx: -1 | 0 | 1; sy: -1 | 0 | 1 }
  | { kind: 'move-river'; id: Id; startX: number; startY: number }
  | { kind: 'river-segment'; id: Id; index: number; horizontal: boolean; startX: number; startY: number }
  | { kind: 'river-end'; id: Id; index: number; horizontal: boolean; startX: number; startY: number }
  | { kind: 'river-width'; id: Id; segment: number };

export class SelectTool implements Tool {
  readonly id = 'select' as const;
  readonly label = 'Select';
  readonly shortcut = 'V';
  readonly hint = 'Drag to move. Drag the handles of a selected flap or river to resize it; Shift-drag a flap handle to stretch it into a box.';

  private drag: Drag | null = null;
  private readonly pan = new PanDrag();

  onPointerDown(p: ToolPointer, ctx: ToolContext): void {
    const hit = ctx.hitTest(p);
    const { editor } = ctx;
    if (!hit) {
      editor.select(null);
      this.pan.start(p);
      return;
    }
    this.drag = this.startDrag(hit, p, ctx.state.design);
    if (hit.kind.startsWith('flap')) editor.select({ kind: 'flap', id: hit.id });
    else editor.select({ kind: 'river', id: hit.id });
    if (this.drag) editor.beginGesture();
  }

  private startDrag(hit: Hit, p: ToolPointer, design: Design): Drag | null {
    switch (hit.kind) {
      case 'flap-tip':
      case 'flap-body': {
        const f = design.flaps.find((q) => q.id === hit.id)!;
        return { kind: 'move-flap', id: f.id, startX: p.x, startY: p.y, fx: f.x, fy: f.y };
      }
      case 'flap-resize': {
        const f = design.flaps.find((q) => q.id === hit.id)!;
        if (!p.shiftKey) return { kind: 'resize-flap', id: f.id, tip: f };
        // Shift: stretch the side (or corner) being dragged, keeping the flap length.
        const c = tipCenter(f);
        const side = (v: number, mid: number): -1 | 1 => (v < mid ? -1 : 1);
        const sx = hit.cursor === 'ns-resize' ? 0 : side(p.x, c.x);
        const sy = hit.cursor === 'ew-resize' ? 0 : side(p.y, c.y);
        return { kind: 'stretch-flap', id: f.id, tip: f, sx, sy };
      }
      case 'river-body':
        return { kind: 'move-river', id: hit.id, startX: p.x, startY: p.y };
      case 'river-segment':
        return { kind: 'river-segment', id: hit.id, index: hit.index, horizontal: hit.horizontal, startX: p.x, startY: p.y };
      case 'river-end':
        return { kind: 'river-end', id: hit.id, index: hit.index, horizontal: hit.horizontal, startX: p.x, startY: p.y };
      case 'river-width':
        return { kind: 'river-width', id: hit.id, segment: hit.segment };
    }
  }

  onPointerMove(p: ToolPointer, ctx: ToolContext): void {
    if (this.pan.move(p, ctx)) return;
    const d = this.drag;
    if (!d) return;
    const { editor } = ctx;
    switch (d.kind) {
      case 'move-flap':
        editor.previewGesture((base) => ops.moveFlap(base, d.id, d.fx + Math.round(p.x - d.startX), d.fy + Math.round(p.y - d.startY)));
        break;
      case 'resize-flap':
        editor.previewGesture((base) => ops.resizeFlap(base, d.id, tipCheb(p, d.tip)));
        break;
      case 'stretch-flap': {
        // The dragged edge of the box follows the pointer; the opposite edge stays put.
        const { x, y, w, h, r } = d.tip;
        let [x0, x1, y0, y1] = [x, x + w, y, y + h];
        if (d.sx > 0) x1 = Math.max(x0, Math.round(p.x - r));
        if (d.sx < 0) x0 = Math.min(x1, Math.round(p.x + r));
        if (d.sy > 0) y1 = Math.max(y0, Math.round(p.y - r));
        if (d.sy < 0) y0 = Math.min(y1, Math.round(p.y + r));
        editor.previewGesture((base) => ops.setFlapTip(base, d.id, x0, y0, x1 - x0, y1 - y0));
        break;
      }
      case 'move-river':
        editor.previewGesture((base) => ops.translateRiver(base, d.id, p.x - d.startX, p.y - d.startY));
        break;
      case 'river-segment': {
        // A horizontal segment moves up/down; a vertical one left/right.
        const dx = d.horizontal ? 0 : Math.round(p.x - d.startX);
        const dy = d.horizontal ? Math.round(p.y - d.startY) : 0;
        editor.previewGesture((base) => ops.moveRiverVertices(base, d.id, [d.index, d.index + 1], dx, dy));
        break;
      }
      case 'river-end': {
        // An end slides along its own segment.
        const dx = d.horizontal ? Math.round(p.x - d.startX) : 0;
        const dy = d.horizontal ? 0 : Math.round(p.y - d.startY);
        editor.previewGesture((base) => ops.moveRiverVertices(base, d.id, [d.index], dx, dy));
        break;
      }
      case 'river-width':
        editor.previewGesture((base) => {
          const r = base.rivers.find((q) => q.id === d.id);
          return r ? ops.setRiverWidth(base, d.id, Math.max(1, Math.round(widthFromHandle(r, d.segment, p)))) : base;
        });
        break;
    }
  }

  onPointerUp(_p: ToolPointer, ctx: ToolContext): void {
    this.pan.end();
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const tidy = d.kind.startsWith('river') || d.kind === 'move-river';
    ctx.editor.endGesture(tidy && 'id' in d ? (des) => ops.normalizeRiverById(des, d.id) : undefined);
  }

  cancel(ctx: ToolContext): void {
    this.pan.end();
    if (this.drag) ctx.editor.cancelGesture();
    this.drag = null;
  }

  cursor(hover: Hit | null): string {
    if (this.pan.active) return 'grabbing';
    if (this.drag?.kind === 'move-flap' || this.drag?.kind === 'move-river') return 'grabbing';
    if (!hover) return 'default';
    switch (hover.kind) {
      case 'flap-resize':
        return hover.cursor;
      case 'river-segment':
        return hover.horizontal ? 'ns-resize' : 'ew-resize';
      case 'river-end':
        return hover.horizontal ? 'ew-resize' : 'ns-resize';
      case 'river-width':
        return hover.horizontal ? 'ns-resize' : 'ew-resize';
      default:
        return 'grab';
    }
  }
}
