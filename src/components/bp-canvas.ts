/**
 * The editing canvas: paper on a cutting mat, the layout, the generated
 * crease pattern and the active tool's overlay. Pointer input is routed to
 * the active tool; the canvas itself only owns pan/zoom.
 */
import { LitElement, html, svg, nothing, type PropertyValues } from 'lit';
import type { Point } from '../core/geometry/point.ts';
import { hitTest, type Hit } from '../editor/hit-test.ts';
import { createTools, type Tool, type ToolContext, type ToolPointer } from '../editor/tools/index.ts';
import { PanDrag } from '../editor/tools/tool.ts';
import { fitViewport, panBy, viewBox, zoomAt, type Viewport } from '../editor/viewport.ts';
import type { EditorController } from '../state/editor.ts';
import type { AppState } from '../state/types.ts';
import {
  ambiguousLayer,
  circlesLayer,
  creaseLayer,
  elementsLayer,
  gridLayer,
  handlesLayer,
  labelsLayer,
  markersLayer,
  paperLayer,
  symmetryAxisLayer,
} from './canvas/layers.ts';
import { canvasStyles } from './canvas/canvas-styles.ts';
import { icons } from './icons.ts';
import { controlStyles } from './shared-styles.ts';

export class BpCanvas extends LitElement {
  static properties = {
    state: { attribute: false },
    editor: { attribute: false },
    viewport: { state: true },
    hover: { state: true },
    pointerGrid: { state: true },
    spaceHeld: { state: true },
  };

  declare state: AppState;
  declare editor: EditorController;
  declare viewport: Viewport | null;
  declare hover: Hit | null;
  declare pointerGrid: Point | null;
  declare spaceHeld: boolean;

  private readonly tools: Record<string, Tool> = createTools();
  private readonly pan = new PanDrag();
  private size = { w: 800, h: 600 };
  private resizeObserver: ResizeObserver | null = null;
  private lastGridSize = 0;

  constructor() {
    super();
    this.viewport = null;
    this.hover = null;
    this.pointerGrid = null;
    this.spaceHeld = false;
  }

  static styles = [controlStyles, canvasStyles];

  // ------------------------------------------------------------ lifecycle

  connectedCallback(): void {
    super.connectedCallback();
    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect;
      const first = !this.viewport;
      this.size = { w: Math.max(1, width), h: Math.max(1, height) };
      if (first) this.fitView();
      else this.requestUpdate();
    });
    this.resizeObserver.observe(this);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    const prev = changed.get('state') as AppState | undefined;
    if (prev && prev.ui.tool !== this.state.ui.tool) {
      this.tools[prev.ui.tool]?.cancel?.(this.context());
    }
    if (this.state && this.state.design.gridSize !== this.lastGridSize) {
      if (this.lastGridSize) this.fitView();
      this.lastGridSize = this.state.design.gridSize;
    }
  }

  // ------------------------------------------------------------ public API

  fitView(): void {
    if (!this.state) return;
    this.viewport = fitViewport(this.state.design.gridSize, this.size.w, this.size.h);
  }

  zoomBy(factor: number): void {
    if (!this.viewport) return;
    this.viewport = zoomAt(this.viewport, factor, { x: this.viewport.centerX, y: this.viewport.centerY });
  }

  /** Keyboard input routed from the app. Returns true if consumed. */
  handleKey(e: KeyboardEvent): boolean {
    if (e.key === ' ' && e.type === 'keydown') {
      this.spaceHeld = true;
      return true;
    }
    if (e.key === ' ' && e.type === 'keyup') {
      this.spaceHeld = false;
      return true;
    }
    if (e.type !== 'keydown') return false;
    return this.activeTool.onKeyDown?.(e, this.context()) ?? false;
  }

  cancelTool(): void {
    this.activeTool.cancel?.(this.context());
  }

  // ------------------------------------------------------------ tool plumbing

  private get activeTool(): Tool {
    return this.tools[this.state.ui.tool]!;
  }

  private get pxPerUnit(): number {
    return this.viewport?.scale ?? 1;
  }

  private context(): ToolContext {
    const tolerance = 8 / this.pxPerUnit;
    return {
      editor: this.editor,
      state: this.editor.state,
      tolerance,
      hitTest: (p) => hitTest(this.editor.state, p, tolerance),
      panBy: (dx, dy) => {
        if (this.viewport) this.viewport = panBy(this.viewport, dx, dy);
      },
      requestUpdate: () => this.requestUpdate(),
    };
  }

  private toGrid(e: PointerEvent | MouseEvent): ToolPointer {
    const rect = this.getBoundingClientRect();
    const v = this.viewport ?? { centerX: 0, centerY: 0, scale: 1 };
    return {
      x: v.centerX + (e.clientX - rect.left - this.size.w / 2) / v.scale,
      y: v.centerY + (e.clientY - rect.top - this.size.h / 2) / v.scale,
      clientX: e.clientX,
      clientY: e.clientY,
      button: e.button,
      shiftKey: e.shiftKey,
      altKey: e.altKey,
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const p = this.toGrid(e);
    if (e.button === 1 || this.spaceHeld) {
      e.preventDefault();
      this.pan.start(p);
      return;
    }
    if (e.button !== 0) return;
    this.activeTool.onPointerDown(p, this.context());
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.toGrid(e);
    const n = this.state.design.gridSize;
    const g = { x: Math.round(p.x), y: Math.round(p.y) };
    const inside = g.x >= 0 && g.y >= 0 && g.x <= n && g.y <= n;
    if (!inside) this.pointerGrid = null;
    else if (!this.pointerGrid || this.pointerGrid.x !== g.x || this.pointerGrid.y !== g.y) this.pointerGrid = g;
    const ctx = this.context();
    if (this.pan.move(p, ctx)) return;
    this.activeTool.onPointerMove(p, ctx);
    if (!this.editor.inGesture) {
      const h = ctx.hitTest(p);
      if (!sameHit(h, this.hover)) this.hover = h;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const p = this.toGrid(e);
    if (this.pan.active) {
      this.pan.end();
      return;
    }
    this.activeTool.onPointerUp(p, this.context());
  };

  private onPointerLeave = () => {
    this.pointerGrid = null;
    this.activeTool.onPointerLeave?.(this.context());
  };

  private onDoubleClick = (e: MouseEvent) => {
    this.activeTool.onDoubleClick?.(this.toGrid(e), this.context());
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.viewport) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    this.viewport = zoomAt(this.viewport, factor, this.toGrid(e));
  };

  // ------------------------------------------------------------ render

  private cursor(): string {
    if (this.pan.active) return 'grabbing';
    if (this.spaceHeld) return 'grab';
    return this.activeTool.cursor(this.hover, this.context());
  }

  render() {
    if (!this.state || !this.viewport) return html`<div class="mat"></div>`;
    const { design, analysis, ui } = this.state;
    const px = 1 / this.pxPerUnit;
    const layers = ui.layers;
    const flapsInError = new Set(
      analysis.issues.filter((i) => i.blocking || i.code === 'path-too-short').flatMap((i) => i.refs.filter((r) => r.kind === 'flap').map((r) => (r as { id: string }).id)),
    );
    const tool = this.activeTool;
    const ctx = this.context();

    return html`
      <div class="mat" style="--zoom:${this.pxPerUnit}"></div>
      <svg
        class="stage ${ui.viewMode}"
        viewBox=${viewBox(this.viewport, this.size.w, this.size.h)}
        style="cursor:${this.cursor()}"
        role="application"
        aria-label="Design canvas"
        @pointerdown=${this.onPointerDown}
        @pointermove=${this.onPointerMove}
        @pointerup=${this.onPointerUp}
        @pointercancel=${this.onPointerUp}
        @pointerleave=${this.onPointerLeave}
        @dblclick=${this.onDoubleClick}
        @wheel=${this.onWheel}
        @contextmenu=${(e: Event) => e.preventDefault()}
      >
        <defs>
          <clipPath id="paper-clip"><rect x="0" y="0" width=${design.gridSize} height=${design.gridSize}></rect></clipPath>
          <pattern id="hatch" width="0.5" height="0.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="0.5" class="hatch-line"></line>
          </pattern>
        </defs>
        ${paperLayer(design.gridSize)}
        <g clip-path="url(#paper-clip)">
          ${layers.elements ? elementsLayer(this.state, flapsInError) : nothing}
          ${layers.grid ? gridLayer(design.gridSize) : nothing}
          ${layers.circles ? circlesLayer(this.state) : nothing}
          ${layers.markers ? ambiguousLayer(analysis) : nothing}
          ${layers.creases ? creaseLayer(analysis, ui.viewMode) : nothing}
        </g>
        <rect class="paper-edge" x="0" y="0" width=${design.gridSize} height=${design.gridSize}></rect>
        ${symmetryAxisLayer(design)}
        ${layers.markers ? markersLayer(this.state, px) : nothing}
        ${layers.labels ? labelsLayer(this.state, px) : nothing}
        ${handlesLayer(this.state, px)}
        ${tool.overlay?.(ctx) ?? nothing}
      </svg>
      ${this.renderLegend()}
      <div class="zoom" role="group" aria-label="Zoom">
        <button class="icon" title="Zoom out" aria-label="Zoom out" @click=${() => this.zoomBy(1 / 1.25)}>${icons.minus}</button>
        <span class="zoom-value">${Math.round((this.pxPerUnit / fitViewport(design.gridSize, this.size.w, this.size.h).scale) * 100)}%</span>
        <button class="icon" title="Zoom in" aria-label="Zoom in" @click=${() => this.zoomBy(1.25)}>${icons.plus}</button>
        <button class="icon" title="Fit to screen" aria-label="Fit to screen" @click=${() => this.fitView()}>${icons.fit}</button>
      </div>
      <div class="status" aria-live="polite">
        <span class="coords">${this.pointerGrid ? `${this.pointerGrid.x}, ${this.pointerGrid.y}` : `${design.gridSize} × ${design.gridSize}`}</span>
        <span class="hint">${tool.hint}</span>
      </div>
    `;
  }

  private renderLegend() {
    const mode = this.state.ui.viewMode;
    const items =
      mode === 'mv'
        ? [
            ['m', 'Mountain'],
            ['v', 'Valley'],
            ['u', 'Unassigned'],
          ]
        : [
            ['hinge', 'Hinge'],
            ['ridge', 'Ridge'],
            ['axis', 'Axis'],
            ['axial', 'Contour'],
            ['conflict', 'Conflict'],
          ];
    return html`<div class="legend ${mode}">
      ${items.map(
        ([cls, label]) => html`<span class="key"><svg viewBox="0 0 22 6" aria-hidden="true">${svg`<line class="crease ${cls}" x1="1" y1="3" x2="21" y2="3"></line>`}</svg>${label}</span>`,
      )}
    </div>`;
  }
}

function sameHit(a: Hit | null, b: Hit | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.kind === b.kind && a.id === b.id && ('index' in a ? a.index === (b as typeof a).index : true);
}

customElements.define('bp-canvas', BpCanvas);

declare global {
  interface HTMLElementTagNameMap {
    'bp-canvas': BpCanvas;
  }
}
