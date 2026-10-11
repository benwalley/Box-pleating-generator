/**
 * Flap tool: press on a grid point and drag outward to set the flap length.
 * Pressing an existing flap's tip moves it instead.
 */
import { svg, nothing } from 'lit';
import * as ops from '../../core/model/operations.ts';
import type { Design, Id } from '../../core/model/types.ts';
import { clamp } from '../../core/geometry/point.ts';
import type { Hit } from '../hit-test.ts';
import type { Overlay, Tool, ToolContext, ToolPointer } from './tool.ts';

type Drag =
  | { kind: 'create'; id: Id; created: Design; cx: number; cy: number }
  | { kind: 'move'; id: Id; startX: number; startY: number; fx: number; fy: number };

export class FlapTool implements Tool {
  readonly id = 'flap' as const;
  readonly label = 'Flap';
  readonly shortcut = 'F';
  readonly hint = 'Press on a grid point and drag outward to size the new flap.';

  private drag: Drag | null = null;
  private hover: { x: number; y: number } | null = null;
  private previewR = 1;

  onPointerDown(p: ToolPointer, ctx: ToolContext): void {
    const { editor, state } = ctx;
    const hit = ctx.hitTest(p);
    if (hit?.kind === 'flap-tip') {
      const f = state.design.flaps.find((q) => q.id === hit.id)!;
      editor.select({ kind: 'flap', id: f.id });
      editor.beginGesture();
      this.drag = { kind: 'move', id: f.id, startX: p.x, startY: p.y, fx: f.x, fy: f.y };
      return;
    }
    const n = state.design.gridSize;
    const cx = clamp(Math.round(p.x), 0, n);
    const cy = clamp(Math.round(p.y), 0, n);
    editor.beginGesture();
    const res = ops.addFlap(state.design, cx, cy, 1);
    if (!res.id) return;
    this.drag = { kind: 'create', id: res.id, created: res.design, cx, cy };
    this.previewR = 1;
    editor.previewGesture(() => res.design);
    editor.select({ kind: 'flap', id: res.id });
  }

  onPointerMove(p: ToolPointer, ctx: ToolContext): void {
    const d = this.drag;
    if (!d) {
      const n = ctx.state.design.gridSize;
      this.hover = { x: clamp(Math.round(p.x), 0, n), y: clamp(Math.round(p.y), 0, n) };
      ctx.requestUpdate();
      return;
    }
    if (d.kind === 'create') {
      const r = Math.max(1, Math.round(Math.max(Math.abs(p.x - d.cx), Math.abs(p.y - d.cy))));
      if (r === this.previewR) return;
      this.previewR = r;
      ctx.editor.previewGesture(() => ops.resizeFlap(d.created, d.id, r));
    } else {
      ctx.editor.previewGesture((base) => ops.moveFlap(base, d.id, d.fx + Math.round(p.x - d.startX), d.fy + Math.round(p.y - d.startY)));
    }
  }

  onPointerUp(_p: ToolPointer, ctx: ToolContext): void {
    if (!this.drag) return;
    this.drag = null;
    ctx.editor.endGesture();
  }

  onPointerLeave(ctx: ToolContext): void {
    this.hover = null;
    ctx.requestUpdate();
  }

  cancel(ctx: ToolContext): void {
    if (this.drag) ctx.editor.cancelGesture();
    this.drag = null;
  }

  cursor(hover: Hit | null): string {
    return hover?.kind === 'flap-tip' ? 'move' : 'crosshair';
  }

  overlay(): Overlay {
    if (this.drag || !this.hover) return nothing;
    const { x, y } = this.hover;
    return svg`<g class="ghost">
      <rect x=${x - 1} y=${y - 1} width="2" height="2"></rect>
      <circle cx=${x} cy=${y} r="0.12"></circle>
    </g>`;
  }
}
