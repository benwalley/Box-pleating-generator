/**
 * Tools turn pointer and keyboard input on the canvas into editor commands.
 * Each tool is a small stateful object; add a new one by implementing this
 * interface and registering it in tools/index.ts.
 */
import type { nothing, SVGTemplateResult } from 'lit';
import type { Point } from '../../core/geometry/point.ts';
import type { EditorController } from '../../state/editor.ts';
import type { AppState, ToolId } from '../../state/types.ts';
import type { Hit } from '../hit-test.ts';

export interface ToolPointer extends Point {
  readonly clientX: number;
  readonly clientY: number;
  readonly button: number;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

export interface ToolContext {
  readonly editor: EditorController;
  readonly state: AppState;
  /** Hit-test tolerance in grid units (depends on zoom). */
  readonly tolerance: number;
  hitTest(p: Point): Hit | null;
  panBy(dxPx: number, dyPx: number): void;
  /** Ask the canvas to redraw (e.g. after the tool's own preview state changed). */
  requestUpdate(): void;
}

export type Overlay = SVGTemplateResult | typeof nothing;

export interface Tool {
  readonly id: ToolId;
  readonly label: string;
  readonly shortcut: string;
  /** One-line instruction shown in the status bar. */
  readonly hint: string;
  onPointerDown(p: ToolPointer, ctx: ToolContext): void;
  onPointerMove(p: ToolPointer, ctx: ToolContext): void;
  onPointerUp(p: ToolPointer, ctx: ToolContext): void;
  onPointerLeave?(ctx: ToolContext): void;
  onDoubleClick?(p: ToolPointer, ctx: ToolContext): void;
  /** Return true if the key was handled. */
  onKeyDown?(e: KeyboardEvent, ctx: ToolContext): boolean;
  /** Abandon whatever the tool is doing (tool switch, Escape). */
  cancel?(ctx: ToolContext): void;
  cursor(hover: Hit | null, ctx: ToolContext): string;
  overlay?(ctx: ToolContext): Overlay;
}

/** Shared drag bookkeeping for tools that pan with a plain drag. */
export class PanDrag {
  private last: { x: number; y: number } | null = null;

  start(p: ToolPointer): void {
    this.last = { x: p.clientX, y: p.clientY };
  }

  move(p: ToolPointer, ctx: ToolContext): boolean {
    if (!this.last) return false;
    ctx.panBy(p.clientX - this.last.x, p.clientY - this.last.y);
    this.last = { x: p.clientX, y: p.clientY };
    return true;
  }

  end(): void {
    this.last = null;
  }

  get active(): boolean {
    return this.last !== null;
  }
}
