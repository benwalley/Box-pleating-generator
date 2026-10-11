/**
 * EditorController is the single entry point for changing the app.
 *
 * Components read `state` and call commands; they never build designs
 * themselves. Every design change goes through `apply` (one undo step) or a
 * gesture (begin -> preview many times -> end, recorded as one undo step).
 * The analysis is recomputed whenever the design changes.
 */
import { analyze } from '../core/analyze.ts';
import { createDesign } from '../core/model/design.ts';
import { flapTipPort, type PortKey } from '../core/model/ports.ts';
import * as ops from '../core/model/operations.ts';
import { parseDesign, serializeDesign } from '../core/model/serialize.ts';
import type { Design, ElementRef, Id } from '../core/model/types.ts';
import { findPreset } from '../core/presets.ts';
import type { TreeLayoutMode } from '../core/tree/layout.ts';
import type { NodeKey } from '../core/tree/types.ts';
import { History } from './history.ts';
import { Store } from './store.ts';
import { DEFAULT_UI, type AppState, type LayerId, type Selection, type ToolId, type UiState, type ViewMode } from './types.ts';

export type DesignOp = (design: Design) => Design;

export class EditorController {
  readonly store: Store<AppState>;
  private readonly history = new History<Design>(250);
  private gestureBase: Design | null = null;

  constructor(initial: Design, ui: Partial<UiState> = {}) {
    this.store = new Store<AppState>({
      design: initial,
      analysis: analyze(initial),
      ui: { ...DEFAULT_UI, ...ui },
      canUndo: false,
      canRedo: false,
    });
  }

  get state(): AppState {
    return this.store.state;
  }

  get design(): Design {
    return this.store.state.design;
  }

  subscribe(listener: (state: AppState, previous: AppState) => void): () => void {
    return this.store.subscribe(listener);
  }

  // ------------------------------------------------------------ plumbing

  private setDesign(design: Design): void {
    const s = this.store.state;
    if (design === s.design) return;
    const analysis = analyze(design);
    this.store.set({
      ...s,
      design,
      analysis,
      ui: { ...s.ui, selection: this.validSelection(s.ui.selection, design, analysis) },
      canUndo: this.history.canUndo,
      canRedo: this.history.canRedo,
    });
  }

  private validSelection(sel: Selection | null, d: Design, a: AppState['analysis']): Selection | null {
    if (!sel) return null;
    if (sel.kind === 'flap') return d.flaps.some((f) => f.id === sel.id) ? sel : null;
    if (sel.kind === 'river') return d.rivers.some((r) => r.id === sel.id) ? sel : null;
    return a.tree.nodes.some((n) => n.key === sel.key) ? sel : null;
  }

  private setUi(patch: Partial<UiState>): void {
    const s = this.store.state;
    this.store.set({ ...s, ui: { ...s.ui, ...patch } });
  }

  /** Apply an edit as one undoable step. */
  apply(op: DesignOp): void {
    if (this.gestureBase) {
      // Inside a drag, edits join the gesture's single undo step.
      this.setDesign(op(this.design));
      return;
    }
    const before = this.design;
    const after = op(before);
    if (after === before) return;
    this.history.record(before);
    this.setDesign(after);
  }

  /** Start a drag. Previews are applied to the design as it was when the drag began. */
  beginGesture(): void {
    this.gestureBase = this.design;
  }

  previewGesture(op: DesignOp): void {
    if (!this.gestureBase) this.beginGesture();
    this.setDesign(op(this.gestureBase!));
  }

  /** Finish a drag, optionally tidying the result, as a single undo step. */
  endGesture(finalize?: DesignOp): void {
    const base = this.gestureBase;
    this.gestureBase = null;
    if (!base) return;
    const final = finalize ? finalize(this.design) : this.design;
    if (final !== base) this.history.record(base);
    this.setDesign(final);
    // Make sure undo availability is refreshed even if the design object didn't change here.
    const s = this.store.state;
    this.store.set({ ...s, canUndo: this.history.canUndo, canRedo: this.history.canRedo });
  }

  cancelGesture(): void {
    const base = this.gestureBase;
    this.gestureBase = null;
    if (base) this.setDesign(base);
  }

  get inGesture(): boolean {
    return this.gestureBase !== null;
  }

  undo(): void {
    if (this.gestureBase) return;
    const prev = this.history.undo(this.design);
    if (prev) this.setDesign(prev);
  }

  redo(): void {
    if (this.gestureBase) return;
    const next = this.history.redo(this.design);
    if (next) this.setDesign(next);
  }

  // ------------------------------------------------------------ ui

  setTool(tool: ToolId): void {
    this.setUi({ tool });
  }

  select(selection: Selection | null): void {
    this.setUi({ selection, focusPoint: null });
  }

  focusPoint(x: number, y: number): void {
    this.setUi({ selection: null, focusPoint: { x, y } });
  }

  setViewMode(viewMode: ViewMode): void {
    this.setUi({ viewMode });
  }

  toggleLayer(layer: LayerId): void {
    const layers = this.state.ui.layers;
    this.setUi({ layers: { ...layers, [layer]: !layers[layer] } });
  }

  setRiverDrawWidth(width: number): void {
    this.setUi({ riverWidth: Math.max(1, Math.min(this.design.gridSize, Math.round(width))) });
  }

  setTreeLayout(treeLayout: TreeLayoutMode): void {
    this.setUi({ treeLayout });
  }

  // ------------------------------------------------------------ flaps

  addFlap(x: number, y: number, r = 1): Id | null {
    let id: Id | null = null;
    this.apply((d) => {
      const res = ops.addFlap(d, x, y, r);
      id = res.id;
      return res.design;
    });
    if (id) this.select({ kind: 'flap', id });
    return id;
  }

  moveFlap(id: Id, x: number, y: number): void {
    this.apply((d) => ops.moveFlap(d, id, x, y));
  }

  resizeFlap(id: Id, r: number): void {
    this.apply((d) => ops.resizeFlap(d, id, r));
  }

  setFlapLabel(id: Id, label: string): void {
    this.apply((d) => ops.setFlapLabel(d, id, label));
  }

  // ------------------------------------------------------------ rivers

  addRiver(points: { x: number; y: number }[], width = this.state.ui.riverWidth): Id | null {
    let id: Id | null = null;
    this.apply((d) => {
      const res = ops.addRiver(d, points, width);
      id = res.id;
      return res.design;
    });
    if (id) this.select({ kind: 'river', id });
    return id;
  }

  setRiverWidth(id: Id, width: number): void {
    this.apply((d) => ops.setRiverWidth(d, id, width));
  }

  setRiverLabel(id: Id, label: string): void {
    this.apply((d) => ops.setRiverLabel(d, id, label));
  }

  translateRiver(id: Id, dx: number, dy: number): void {
    this.apply((d) => ops.translateRiver(d, id, dx, dy));
  }

  // ------------------------------------------------------------ selection-wide

  deleteSelection(): void {
    const sel = this.state.ui.selection;
    if (!sel || sel.kind === 'node') return;
    const ref: ElementRef = sel;
    this.apply((d) => ops.deleteElements(d, [ref]));
    this.select(null);
  }

  /** Arrow-key nudge of the selected element. */
  nudgeSelection(dx: number, dy: number): void {
    const sel = this.state.ui.selection;
    if (!sel) return;
    if (sel.kind === 'flap') {
      const f = this.design.flaps.find((q) => q.id === sel.id);
      if (f) this.moveFlap(f.id, f.x + dx, f.y + dy);
    } else if (sel.kind === 'river') {
      this.translateRiver(sel.id, dx, dy);
    }
  }

  /** +/- on the selection: flap length or river width. */
  growSelection(delta: number): void {
    const sel = this.state.ui.selection;
    if (!sel) return;
    if (sel.kind === 'flap') {
      const f = this.design.flaps.find((q) => q.id === sel.id);
      if (f) this.resizeFlap(f.id, f.r + delta);
    } else if (sel.kind === 'river') {
      const r = this.design.rivers.find((q) => q.id === sel.id);
      if (r) this.setRiverWidth(r.id, r.width + delta);
    }
  }

  // ------------------------------------------------------------ tree

  /** Label a tree node. Leaves are flaps, so their label is the flap label. */
  setNodeLabel(key: NodeKey, label: string): void {
    const node = this.state.analysis.tree.nodes.find((n) => n.key === key);
    if (!node) return;
    if (node.kind === 'leaf' && node.flapId) this.setFlapLabel(node.flapId, label);
    else this.apply((d) => ops.setNodeLabel(d, node.ports, label));
  }

  setRoot(key: NodeKey | null): void {
    if (key === null) {
      this.apply((d) => ops.setRootPort(d, null));
      return;
    }
    const node = this.state.analysis.tree.nodes.find((n) => n.key === key);
    if (!node) return;
    const port: PortKey = node.kind === 'leaf' && node.flapId ? flapTipPort(node.flapId) : node.ports[0]!;
    this.apply((d) => ops.setRootPort(d, port));
  }

  // ------------------------------------------------------------ design

  setName(name: string): void {
    this.apply((d) => ops.setName(d, name));
  }

  setGridSize(size: number): void {
    this.apply((d) => ops.setGridSize(d, size));
  }

  setBookSymmetry(on: boolean): void {
    this.apply((d) => ops.setBookSymmetry(d, on));
  }

  makeSymmetric(): void {
    this.apply(ops.makeSymmetric);
  }

  /** Replace the whole design. Undoable unless `resetHistory` is set. */
  loadDesign(design: Design, resetHistory = false): void {
    this.gestureBase = null;
    if (resetHistory) {
      this.history.clear();
      this.setDesign(design);
      const s = this.store.state;
      this.store.set({ ...s, canUndo: false, canRedo: false, ui: { ...s.ui, selection: null } });
    } else {
      this.apply(() => design);
      this.select(null);
    }
  }

  newDesign(): void {
    this.loadDesign(createDesign());
  }

  loadPreset(id: string): void {
    const preset = findPreset(id);
    if (preset) this.loadDesign(preset.build());
  }

  /** Returns an error message, or null on success. */
  importJson(text: string): string | null {
    const res = parseDesign(text);
    if (!res.ok) return res.error;
    this.loadDesign(res.design);
    return null;
  }

  exportJson(): string {
    return serializeDesign(this.design);
  }
}
