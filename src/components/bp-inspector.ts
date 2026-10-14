/**
 * Properties of whatever is selected: a flap, a river, a tree node, or (with
 * nothing selected) the design itself.
 */
import { LitElement, html, css, nothing } from 'lit';
import { MAX_GRID, MIN_GRID } from '../core/model/design.ts';
import { flapName, riverName } from '../core/model/naming.ts';
import { riverPort } from '../core/model/ports.ts';
import type { Flap, River } from '../core/model/types.ts';
import { unpairedElements } from '../core/symmetry/book.ts';
import { nodeDisplayName, type TreeNode } from '../core/tree/types.ts';
import type { EditorController } from '../state/editor.ts';
import type { AppState } from '../state/types.ts';
import { icons } from './icons.ts';
import { controlStyles, sectionStyles } from './shared-styles.ts';
import './bp-number-field.ts';

export class BpInspector extends LitElement {
  static properties = {
    state: { attribute: false },
    editor: { attribute: false },
  };

  declare state: AppState;
  declare editor: EditorController;

  static styles = [
    controlStyles,
    sectionStyles,
    css`
      :host {
        display: block;
      }
      .kind {
        font-size: var(--fs-xs);
        color: var(--ink-3);
        font-weight: 500;
      }
      .facts {
        display: grid;
        grid-template-columns: 92px 1fr;
        gap: 4px var(--space-2);
        margin: var(--space-3) 0;
        font-size: var(--fs-sm);
      }
      .facts dt {
        color: var(--ink-2);
      }
      .facts dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
      .xy {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-2);
      }
      .switch {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        cursor: pointer;
        font-size: var(--fs-sm);
      }
      .switch input {
        appearance: none;
        width: 32px;
        height: 18px;
        border-radius: 9px;
        background: var(--line-strong);
        position: relative;
        margin: 0;
        cursor: pointer;
        transition: background 0.15s;
      }
      .switch input::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: var(--surface);
        transition: transform 0.15s;
      }
      .switch input:checked {
        background: var(--accent);
      }
      .switch input:checked::after {
        transform: translateX(14px);
      }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--fs-xs);
        font-weight: 600;
        color: var(--accent-ink);
        background: var(--accent-soft);
        border-radius: 10px;
        padding: 1px 8px;
      }
      .actions {
        display: flex;
        gap: var(--space-2);
        flex-wrap: wrap;
        margin-top: var(--space-3);
      }
    `,
  ];

  render() {
    if (!this.state) return nothing;
    const sel = this.state.ui.selection;
    if (sel?.kind === 'flap') {
      const f = this.state.design.flaps.find((q) => q.id === sel.id);
      if (f) return this.renderFlap(f);
    }
    if (sel?.kind === 'river') {
      const r = this.state.design.rivers.find((q) => q.id === sel.id);
      if (r) return this.renderRiver(r);
    }
    if (sel?.kind === 'node') {
      const n = this.state.analysis.tree.nodes.find((q) => q.key === sel.key);
      if (n) return this.renderNode(n);
    }
    return this.renderDesign();
  }

  private head(title: string, kind: string) {
    return html`<div class="section-head">
      <h2>${title}</h2>
      <span class="kind">${kind}</span>
    </div>`;
  }

  private labelField(value: string, placeholder: string, onCommit: (v: string) => void) {
    return html`<div class="field">
      <label for="label">Label</label>
      <input
        id="label"
        type="text"
        .value=${value}
        placeholder=${placeholder}
        @change=${(e: Event) => onCommit((e.target as HTMLInputElement).value)}
        @keydown=${(e: KeyboardEvent) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </div>`;
  }

  private mirrorText(e: Flap | River, name: (id: string) => string): string {
    if (!this.state.design.symmetry.book) return 'Symmetry off';
    if (!e.mirrorId) return 'No mirror image';
    if (e.mirrorId === e.id) return 'On the axis';
    return `Mirrors ${name(e.mirrorId)}`;
  }

  private hubName(key: string | undefined): string {
    const n = this.state.analysis.tree.nodes.find((q) => q.key === key);
    return n ? nodeDisplayName(n) : '—';
  }

  // ------------------------------------------------------------ flap

  private renderFlap(f: Flap) {
    const { design, analysis } = this.state;
    const n = design.gridSize;
    const name = flapName(design, f.id);
    const onX = f.x === 0 || f.x + f.w === n;
    const onY = f.y === 0 || f.y + f.h === n;
    const type = onX && onY ? 'Corner flap' : onX || onY ? 'Edge flap' : 'Middle flap';
    const circleSides = analysis.tree.circleNormals.get(f.id)?.length ?? 0;
    const rectangular = f.w > 0 || f.h > 0;
    const shape = circleSides
      ? `${rectangular ? 'Box' : 'Square'} cut by ${circleSides} tangent side${circleSides === 1 ? '' : 's'} (circle packing)`
      : `${rectangular ? 'Box' : 'Square'}, ${f.w + f.r * 2} × ${f.h + f.r * 2}`;
    const tipKey = `tip:${f.id}`;
    const isRoot = analysis.tree.rootKey === tipKey;
    const lockX = design.symmetry.book && f.mirrorId === f.id;
    return html`
      ${this.head(name, type)}
      <div class="section-body">
        ${this.labelField(f.label, `F${design.flaps.indexOf(f) + 1}`, (v) => this.editor.setFlapLabel(f.id, v))}
        <div class="field">
          <span class="label">${rectangular ? 'Tip corner' : 'Tip'}</span>
          <div class="xy">
            <bp-number-field label="x" .value=${f.x} min="0" max=${n - f.w} ?disabled=${lockX} @value-change=${(e: CustomEvent<number>) => this.editor.moveFlap(f.id, e.detail, f.y)}></bp-number-field>
            <bp-number-field label="y" .value=${f.y} min="0" max=${n - f.h} @value-change=${(e: CustomEvent<number>) => this.editor.moveFlap(f.id, f.x, e.detail)}></bp-number-field>
          </div>
        </div>
        <div class="field">
          <span class="label" title="Width and height of the tip. 0 × 0 is a square flap; a width or height makes a rectangular box.">Tip size</span>
          <div class="xy">
            <bp-number-field label="w" .value=${f.w} min="0" max=${n} @value-change=${(e: CustomEvent<number>) => this.editor.setFlapTip(f.id, f.x, f.y, e.detail, f.h)}></bp-number-field>
            <bp-number-field label="h" .value=${f.h} min="0" max=${n} @value-change=${(e: CustomEvent<number>) => this.editor.setFlapTip(f.id, f.x, f.y, f.w, e.detail)}></bp-number-field>
          </div>
        </div>
        <div class="field">
          <label>Length</label>
          <bp-number-field label="Flap length" .value=${f.r} min="1" max=${n} @value-change=${(e: CustomEvent<number>) => this.editor.resizeFlap(f.id, e.detail)}></bp-number-field>
        </div>
        <dl class="facts">
          <dt>Shape</dt>
          <dd>${shape}</dd>
          <dt>Hangs from</dt>
          <dd>${this.hubName(analysis.tree.hubOfFlap.get(f.id))}</dd>
          <dt>Symmetry</dt>
          <dd>${this.mirrorText(f, (id) => flapName(design, id))}</dd>
        </dl>
        <div class="actions">
          ${isRoot
            ? html`<span class="badge">${icons.root} Root</span>`
            : html`<button @click=${() => this.editor.setRoot(tipKey)}>${icons.root} Make root</button>`}
          <button class="danger" @click=${() => this.editor.deleteSelection()}>${icons.trash} Delete</button>
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------ river

  private renderRiver(r: River) {
    const { design, analysis } = this.state;
    const name = riverName(design, r.id);
    const hubOf = (side: 'a' | 'b') => analysis.tree.nodes.find((x) => x.ports.includes(riverPort(r.id, side)));
    const a = hubOf('a');
    const b = hubOf('b');
    return html`
      ${this.head(name, 'River')}
      <div class="section-body">
        ${this.labelField(r.label, `R${design.rivers.indexOf(r) + 1}`, (v) => this.editor.setRiverLabel(r.id, v))}
        <div class="field">
          <label>Width</label>
          <bp-number-field label="River width" .value=${r.width} min="1" max=${design.gridSize} @value-change=${(e: CustomEvent<number>) => this.editor.setRiverWidth(r.id, e.detail)}></bp-number-field>
        </div>
        <dl class="facts">
          <dt>Bank A joins</dt>
          <dd>${a ? html`<a href="#" @click=${(e: Event) => this.selectNode(e, a.key)}>${nodeDisplayName(a)}</a>` : '—'}</dd>
          <dt>Bank B joins</dt>
          <dd>${b ? html`<a href="#" @click=${(e: Event) => this.selectNode(e, b.key)}>${nodeDisplayName(b)}</a>` : '—'}</dd>
          <dt>Bends</dt>
          <dd>${Math.max(0, r.points.length - 2)}</dd>
          <dt>Symmetry</dt>
          <dd>${this.mirrorText(r, (id) => riverName(design, id))}</dd>
        </dl>
        <p class="note">Widening keeps bank A in place. Drag the diamond handle to change the width, the round handles to move a segment, and the end handles to lengthen it.</p>
        <div class="actions">
          <button class="danger" @click=${() => this.editor.deleteSelection()}>${icons.trash} Delete</button>
        </div>
      </div>
    `;
  }

  private selectNode(e: Event, key: string): void {
    e.preventDefault();
    this.editor.select({ kind: 'node', key });
  }

  // ------------------------------------------------------------ node

  private renderNode(n: TreeNode) {
    const { analysis, design } = this.state;
    if (n.kind === 'leaf' && n.flapId) {
      const f = design.flaps.find((q) => q.id === n.flapId);
      if (f) return this.renderFlap(f);
    }
    const isRoot = analysis.tree.rootKey === n.key;
    const edges = analysis.tree.edges.filter((e) => e.from === n.key || e.to === n.key);
    const flaps = edges.filter((e) => e.kind === 'flap').map((e) => flapName(design, e.flapId!));
    const rivers = edges.filter((e) => e.kind !== 'flap');
    return html`
      ${this.head(nodeDisplayName(n), 'Tree node')}
      <div class="section-body">
        ${this.labelField(n.label, n.autoName, (v) => this.editor.setNodeLabel(n.key, v))}
        <dl class="facts">
          <dt>Edges</dt>
          <dd>${edges.length}</dd>
          <dt>Flaps</dt>
          <dd>${flaps.length ? flaps.join(', ') : '—'}</dd>
          <dt>Rivers</dt>
          <dd>${rivers.length ? rivers.map((e) => (e.riverId ? riverName(design, e.riverId) : `implied (${e.length})`)).join(', ') : '—'}</dd>
        </dl>
        <div class="actions">
          ${isRoot
            ? html`<span class="badge">${icons.root} Root</span>
                ${design.rootPort ? html`<button @click=${() => this.editor.setRoot(null)}>Choose root automatically</button>` : nothing}`
            : html`<button @click=${() => this.editor.setRoot(n.key)}>${icons.root} Make root</button>`}
        </div>
      </div>
    `;
  }

  // ------------------------------------------------------------ design

  private renderDesign() {
    const { design, analysis, ui } = this.state;
    const unpaired = unpairedElements(design).length;
    const c = analysis.flapCounts;
    return html`
      ${this.head('Design', 'Nothing selected')}
      <div class="section-body">
        <div class="field">
          <label for="name">Name</label>
          <input
            id="name"
            type="text"
            .value=${design.name}
            @change=${(e: Event) => this.editor.setName((e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => e.stopPropagation()}
          />
        </div>
        <div class="field">
          <label>Grid</label>
          <bp-number-field label="Grid size" .value=${design.gridSize} min=${MIN_GRID} max=${MAX_GRID} @value-change=${(e: CustomEvent<number>) => this.editor.setGridSize(e.detail)}></bp-number-field>
        </div>
        <div class="field">
          <span class="label">Symmetry</span>
          <label class="switch">
            <input type="checkbox" .checked=${design.symmetry.book} @change=${(e: Event) => this.editor.setBookSymmetry((e.target as HTMLInputElement).checked)} />
            Book (left/right)
          </label>
        </div>
        ${design.symmetry.book && unpaired
          ? html`<p class="note">${unpaired} element${unpaired === 1 ? ' has' : 's have'} no mirror image.</p>
              <button @click=${() => this.editor.makeSymmetric()}>${icons.mirror} Make symmetric</button>`
          : nothing}
        <div class="field" style="margin-top: var(--space-3)">
          <label>New rivers</label>
          <bp-number-field label="New river width" .value=${ui.riverWidth} min="1" max=${design.gridSize} @value-change=${(e: CustomEvent<number>) => this.editor.setRiverDrawWidth(e.detail)}></bp-number-field>
        </div>
        <dl class="facts">
          <dt>Flaps</dt>
          <dd>${design.flaps.length} (${c.corner} corner, ${c.edge} edge, ${c.middle} middle)</dd>
          <dt>Rivers</dt>
          <dd>${design.rivers.length} drawn, ${analysis.tree.edges.filter((e) => e.kind === 'implicit').length} implied</dd>
          <dt>Active paths</dt>
          <dd>${analysis.tree.activePaths}</dd>
        </dl>
      </div>
    `;
  }
}

customElements.define('bp-inspector', BpInspector);

declare global {
  interface HTMLElementTagNameMap {
    'bp-inspector': BpInspector;
  }
}
