/**
 * River tool: click to place bends, double-click (or Enter) to finish.
 * Segments are forced horizontal/vertical and snapped so both banks fall
 * on grid lines. [ and ] change the width while drawing.
 */
import { svg, nothing } from 'lit';
import { clamp, samePoint, type Point } from '../../core/geometry/point.ts';
import { normalizePolyline, orthogonalize, snapRiverPoints, snapToLattice, stripSegments } from '../../core/geometry/polyline.ts';
import type { Overlay, Tool, ToolContext, ToolPointer } from './tool.ts';

export class RiverTool implements Tool {
  readonly id = 'river' as const;
  readonly label = 'River';
  readonly shortcut = 'R';
  readonly hint = 'Click to place bends, double-click or press Enter to finish. [ and ] change the width.';

  private points: Point[] = [];
  private hover: Point | null = null;

  private snap(p: Point, ctx: ToolContext): Point {
    const w = ctx.state.ui.riverWidth;
    const n = ctx.state.design.gridSize;
    const s = { x: clamp(snapToLattice(p.x, w), 0, n), y: clamp(snapToLattice(p.y, w), 0, n) };
    const last = this.points[this.points.length - 1];
    return last ? orthogonalize(last, s) : s;
  }

  onPointerDown(p: ToolPointer, ctx: ToolContext): void {
    const q = this.snap(p, ctx);
    const last = this.points[this.points.length - 1];
    if (last && samePoint(last, q)) {
      this.finish(ctx);
      return;
    }
    this.points.push(q);
    ctx.requestUpdate();
  }

  onPointerMove(p: ToolPointer, ctx: ToolContext): void {
    this.hover = this.snap(p, ctx);
    ctx.requestUpdate();
  }

  onPointerUp(): void {}

  onDoubleClick(_p: ToolPointer, ctx: ToolContext): void {
    this.finish(ctx);
  }

  onPointerLeave(ctx: ToolContext): void {
    this.hover = null;
    ctx.requestUpdate();
  }

  onKeyDown(e: KeyboardEvent, ctx: ToolContext): boolean {
    if (e.key === 'Enter') {
      this.finish(ctx);
      return true;
    }
    if (e.key === 'Escape' && this.points.length) {
      this.cancel(ctx);
      return true;
    }
    if (e.key === 'Backspace' && this.points.length) {
      this.points.pop();
      ctx.requestUpdate();
      return true;
    }
    if (e.key === '[' || e.key === ']') {
      ctx.editor.setRiverDrawWidth(ctx.state.ui.riverWidth + (e.key === ']' ? 1 : -1));
      // Re-snap committed points for the new width parity.
      this.points = this.points.map((q) => ({ x: snapToLattice(q.x, ctx.editor.state.ui.riverWidth), y: snapToLattice(q.y, ctx.editor.state.ui.riverWidth) }));
      ctx.requestUpdate();
      return true;
    }
    return false;
  }

  private finish(ctx: ToolContext): void {
    const pts = normalizePolyline(this.points);
    this.points = [];
    if (pts.length >= 2) ctx.editor.addRiver(pts);
    ctx.requestUpdate();
  }

  cancel(ctx: ToolContext): void {
    this.points = [];
    ctx.requestUpdate();
  }

  cursor(): string {
    return 'crosshair';
  }

  overlay(ctx: ToolContext): Overlay {
    const w = ctx.state.ui.riverWidth;
    const pts = [...this.points];
    if (this.hover && (!pts.length || !samePoint(pts[pts.length - 1]!, this.hover))) pts.push(this.hover);
    if (!pts.length) return nothing;
    const clean = normalizePolyline(pts);
    const strip = clean.length >= 2 ? stripSegments(snapRiverPoints(clean, w), w / 2) : [];
    return svg`<g class="river-draft">
      ${strip.map((s) => svg`<rect x=${s.rect.x0} y=${s.rect.y0} width=${s.rect.x1 - s.rect.x0} height=${s.rect.y1 - s.rect.y0}></rect>`)}
      <polyline points=${clean.map((q) => `${q.x},${q.y}`).join(' ')}></polyline>
      ${this.points.map((q) => svg`<circle cx=${q.x} cy=${q.y} r="0.16"></circle>`)}
    </g>`;
  }
}
