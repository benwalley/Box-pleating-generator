/**
 * The inferred tree, drawn from its root. Leaves are flaps, filled dots are
 * internal nodes, blue edges are rivers (dashed when implied by a gap).
 * Click a node or edge to select it; double-click a node to rename it.
 */
import { LitElement, html, svg, css, nothing } from 'lit';
import { layoutTree } from '../core/tree/layout.ts';
import { nodeDisplayName, type TreeEdge, type TreeNode } from '../core/tree/types.ts';
import type { EditorController } from '../state/editor.ts';
import type { AppState } from '../state/types.ts';
import { controlStyles, sectionStyles } from './shared-styles.ts';

const MAX_COL = 64;
const MIN_COL = 34;
const ROW = 64;
const PAD_X = 40;
const PAD_TOP = 34;
const PAD_BOTTOM = 44;

export class BpTreeView extends LitElement {
  static properties = {
    state: { attribute: false },
    editor: { attribute: false },
    editing: { state: true },
    availableWidth: { state: true },
    availableHeight: { state: true },
  };

  declare state: AppState;
  declare editor: EditorController;
  declare editing: string | null;
  declare availableWidth: number;
  declare availableHeight: number;
  private resizeObserver: ResizeObserver | null = null;
  private observedScroll: Element | null = null;

  constructor() {
    super();
    this.editing = null;
    this.availableWidth = 300;
    this.availableHeight = 260;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Measure the scroll box so the tree can be sized to fit it.
    this.resizeObserver = new ResizeObserver(([entry]) => {
      if (!entry) return;
      this.availableWidth = Math.max(120, entry.contentRect.width - 2);
      this.availableHeight = Math.max(120, entry.contentRect.height - 2);
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  static styles = [
    controlStyles,
    sectionStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .seg {
        display: inline-flex;
        border: 1px solid var(--line-strong);
        border-radius: var(--radius-sm);
        overflow: hidden;
      }
      .seg button {
        border: 0;
        border-radius: 0;
        height: 26px;
        font-size: var(--fs-xs);
        padding: 0 var(--space-2);
      }
      .seg button + button {
        border-left: 1px solid var(--line-strong);
      }
      .scroll {
        flex: 1;
        min-height: 180px;
        overflow: auto;
        margin: 0 var(--space-4) var(--space-3);
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
      }
      svg.tree {
        display: block;
        margin: 0 auto;
      }
      .edge {
        stroke: var(--ink);
        stroke-width: 1.6;
        fill: none;
      }
      .edge.river,
      .edge.implicit {
        stroke: var(--river-line);
        stroke-width: 3;
      }
      .edge.implicit {
        stroke-dasharray: 5 4;
      }
      .edge-hit {
        stroke: transparent;
        stroke-width: 14;
        cursor: pointer;
      }
      .edge.selected {
        stroke: var(--accent);
      }
      .len {
        font-size: 10.5px;
        fill: var(--ink-2);
        font-variant-numeric: tabular-nums;
        paint-order: stroke;
        stroke: var(--surface);
        stroke-width: 3px;
      }
      .node {
        cursor: pointer;
      }
      .node circle.dot {
        fill: var(--ink);
        stroke: var(--surface);
        stroke-width: 2;
      }
      .node.leaf circle.dot {
        fill: var(--surface);
        stroke: var(--ink);
        stroke-width: 1.8;
      }
      .node.selected circle.dot {
        fill: var(--accent);
        stroke: var(--accent-ink);
      }
      .node .root-ring {
        fill: none;
        stroke: var(--accent);
        stroke-width: 2.5;
      }
      .node text {
        font-size: 11.5px;
        font-weight: 600;
        fill: var(--ink);
        paint-order: stroke;
        stroke: var(--surface);
        stroke-width: 3px;
      }
      .node text.auto {
        fill: var(--ink-3);
        font-weight: 500;
      }
      .node:focus-visible {
        outline: none;
      }
      .node:focus-visible circle.dot {
        stroke: var(--accent);
        stroke-width: 3;
      }
      .empty {
        padding: var(--space-5) var(--space-4);
        color: var(--ink-3);
        font-size: var(--fs-sm);
        text-align: center;
      }
      foreignObject input {
        height: 24px;
        font-size: 12px;
      }
      .hint {
        font-size: var(--fs-xs);
        color: var(--ink-3);
        padding: 0 var(--space-4) var(--space-3);
      }
    `,
  ];

  private sortKey = (key: string): number => {
    const node = this.state.analysis.tree.nodes.find((n) => n.key === key);
    const f = node?.flapId ? this.state.design.flaps.find((q) => q.id === node.flapId) : null;
    return f ? f.x * 1000 + f.y : 0;
  };

  render() {
    if (!this.state) return nothing;
    const { analysis, ui } = this.state;
    const tree = analysis.tree;
    return html`
      <div class="section-head">
        <h2>Tree</h2>
        <div class="seg" role="group" aria-label="Edge lengths">
          <button aria-pressed=${ui.treeLayout === 'scaled'} @click=${() => this.editor.setTreeLayout('scaled')}>To scale</button>
          <button aria-pressed=${ui.treeLayout === 'depth'} @click=${() => this.editor.setTreeLayout('depth')}>Even rows</button>
        </div>
      </div>
      <div class="scroll">${tree.nodes.length ? this.renderTree() : html`<div class="empty">Add flaps to grow a tree.</div>`}</div>
      <div class="hint">Double-click a node to rename it.</div>
    `;
  }

  private renderTree() {
    const { analysis, ui, design } = this.state;
    const tree = analysis.tree;
    const layout = layoutTree(tree, ui.treeLayout, this.sortKey);
    // Fit the height of the panel where possible; scroll beyond that.
    const fitUnit = (this.availableHeight - PAD_TOP - PAD_BOTTOM) / Math.max(1, layout.height);
    const unit = ui.treeLayout === 'scaled' ? Math.max(8, Math.min(ROW / 2, fitUnit)) : Math.max(40, Math.min(ROW, fitUnit));
    // Shrink columns to fit the panel, down to a readable minimum, then scroll.
    const spans = Math.max(1, layout.columns - 1);
    const col = Math.max(MIN_COL, Math.min(MAX_COL, (this.availableWidth - PAD_X * 2) / spans));
    const pos = (key: string) => {
      const p = layout.positions.get(key)!;
      return { x: PAD_X + p.x * col, y: PAD_TOP + p.y * unit };
    };
    const width = Math.max(PAD_X * 2 + (layout.columns - 1) * col, Math.min(this.availableWidth, PAD_X * 2 + spans * col));
    const height = PAD_TOP + PAD_BOTTOM + layout.height * unit;
    const sel = ui.selection;
    const selectedEdge = (e: TreeEdge) =>
      (sel?.kind === 'river' && e.riverId === sel.id) || (sel?.kind === 'flap' && e.flapId === sel.id);
    const selectedNode = (n: TreeNode) =>
      (sel?.kind === 'node' && sel.key === n.key) || (sel?.kind === 'flap' && n.flapId === sel.id);

    return html`<svg class="tree" width=${width} height=${height} viewBox="0 0 ${width} ${height}" role="tree" aria-label="Tree of ${design.name}">
      ${tree.edges.map((e) => {
        const a = pos(e.from);
        const b = pos(e.to);
        const cls = `edge ${e.kind} ${selectedEdge(e) ? 'selected' : ''}`;
        return svg`<g>
          <line class=${cls} x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y}></line>
          <line class="edge-hit" x1=${a.x} y1=${a.y} x2=${b.x} y2=${b.y} @click=${() => this.selectEdge(e)}></line>
          <text class="len" x=${(a.x + b.x) / 2 + 6} y=${(a.y + b.y) / 2 + 4}>${e.length}</text>
        </g>`;
      })}
      ${tree.nodes.map((n) => {
        const p = pos(n.key);
        const column = layout.positions.get(n.key)!.x;
        const stagger = n.kind === 'leaf' && col < 72 && Math.round(column) % 2 === 1 ? 13 : 0;
        const isRoot = tree.rootKey === n.key;
        const below = n.kind === 'leaf';
        const editing = this.editing === n.key;
        return svg`<g
          class="node ${n.kind} ${selectedNode(n) ? 'selected' : ''}"
          role="treeitem"
          tabindex="0"
          aria-label=${`${nodeDisplayName(n)}${isRoot ? ', root' : ''}`}
          @click=${() => this.selectNode(n)}
          @dblclick=${() => (this.editing = n.key)}
          @keydown=${(e: KeyboardEvent) => this.onNodeKey(e, n)}
        >
          ${isRoot ? svg`<circle class="root-ring" cx=${p.x} cy=${p.y} r="10"></circle>` : nothing}
          <circle class="dot" cx=${p.x} cy=${p.y} r=${n.kind === 'leaf' ? 5 : 6}></circle>
          ${editing
            ? svg`<foreignObject x=${p.x - 60} y=${below ? p.y + 8 : p.y - 34} width="120" height="28">${this.renderEditor(n)}</foreignObject>`
            : svg`<text class=${n.label ? '' : 'auto'} x=${p.x} y=${below ? p.y + 20 + stagger : p.y - 12} text-anchor="middle">${nodeDisplayName(n)}</text>`}
        </g>`;
      })}
    </svg>`;
  }

  private renderEditor(n: TreeNode) {
    const commit = (input: HTMLInputElement) => {
      if (this.editing !== n.key) return;
      this.editing = null;
      this.editor.setNodeLabel(n.key, input.value);
    };
    return html`<input
      type="text"
      aria-label="Node label"
      .value=${n.label}
      placeholder=${n.autoName}
      @keydown=${(e: KeyboardEvent) => {
        e.stopPropagation();
        if (e.key === 'Enter') commit(e.target as HTMLInputElement);
        if (e.key === 'Escape') this.editing = null;
      }}
      @blur=${(e: Event) => commit(e.target as HTMLInputElement)}
    />`;
  }

  protected updated(): void {
    const scroll = this.renderRoot.querySelector('.scroll');
    if (scroll && scroll !== this.observedScroll) {
      if (this.observedScroll) this.resizeObserver?.unobserve(this.observedScroll);
      this.resizeObserver?.observe(scroll);
      this.observedScroll = scroll;
    }
    if (this.editing) {
      const input = this.renderRoot.querySelector('foreignObject input') as HTMLInputElement | null;
      if (input && this.shadowRoot?.activeElement !== input) {
        input.focus();
        input.select();
      }
    }
  }

  private onNodeKey(e: KeyboardEvent, n: TreeNode): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.editing = n.key;
    } else if (e.key === ' ') {
      e.preventDefault();
      this.selectNode(n);
    }
  }

  private selectNode(n: TreeNode): void {
    if (n.kind === 'leaf' && n.flapId) this.editor.select({ kind: 'flap', id: n.flapId });
    else this.editor.select({ kind: 'node', key: n.key });
  }

  private selectEdge(e: TreeEdge): void {
    if (e.riverId) this.editor.select({ kind: 'river', id: e.riverId });
    else if (e.flapId) this.editor.select({ kind: 'flap', id: e.flapId });
  }
}

customElements.define('bp-tree-view', BpTreeView);

declare global {
  interface HTMLElementTagNameMap {
    'bp-tree-view': BpTreeView;
  }
}
