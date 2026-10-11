/** App bar: file menu, undo/redo, symmetry, view mode and layers. */
import { LitElement, html, css, nothing } from 'lit';
import { PRESETS } from '../core/presets.ts';
import type { EditorController } from '../state/editor.ts';
import { downloadText, fileNameFor, pickTextFile } from '../state/persistence.ts';
import type { AppState, LayerId } from '../state/types.ts';
import { printCreasePattern } from './canvas/print.ts';
import { icons } from './icons.ts';
import { controlStyles } from './shared-styles.ts';

const LAYERS: ReadonlyArray<[LayerId, string]> = [
  ['grid', 'Grid'],
  ['elements', 'Flaps and rivers'],
  ['circles', 'Flap circles'],
  ['creases', 'Creases'],
  ['labels', 'Labels'],
  ['markers', 'Problem markers'],
];

export class BpTopbar extends LitElement {
  static properties = {
    state: { attribute: false },
    editor: { attribute: false },
  };

  declare state: AppState;
  declare editor: EditorController;

  static styles = [
    controlStyles,
    css`
      :host {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: 0 var(--space-3);
        height: var(--topbar-h);
        background: var(--surface);
        border-bottom: 1px solid var(--line);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        margin-right: var(--space-2);
      }
      .logo {
        width: 24px;
        height: 24px;
      }
      .wordmark {
        font-size: var(--fs-lg);
        font-weight: 700;
        letter-spacing: -0.02em;
      }
      .name {
        color: var(--ink-3);
        font-size: var(--fs-sm);
        max-width: 22ch;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .divider {
        width: 1px;
        align-self: stretch;
        margin: 12px var(--space-1);
        background: var(--line);
      }
      .spacer {
        flex: 1;
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
      }
      .seg button + button {
        border-left: 1px solid var(--line-strong);
      }

      [popover] {
        inset: auto;
        margin: 0;
        padding: var(--space-1);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: var(--surface);
        box-shadow: 0 10px 30px rgba(20, 30, 26, 0.18);
        min-width: 220px;
        font-family: var(--font);
        color: var(--ink);
      }
      .menu button {
        width: 100%;
        border: 0;
        justify-content: flex-start;
        background: transparent;
        height: auto;
        min-height: 32px;
        padding: 6px var(--space-2);
      }
      .menu button:hover {
        background: var(--hover);
      }
      .menu .group {
        font-size: var(--fs-xs);
        color: var(--ink-3);
        padding: var(--space-2) var(--space-2) 2px;
      }
      .menu hr {
        border: 0;
        border-top: 1px solid var(--line);
        margin: var(--space-1) 0;
      }
      .preset {
        display: grid !important;
        text-align: left;
        gap: 1px;
        white-space: normal !important;
      }
      .preset small {
        color: var(--ink-3);
        font-weight: 400;
      }
      label.check {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        padding: 6px var(--space-2);
        font-size: var(--fs-sm);
        border-radius: var(--radius-sm);
        cursor: pointer;
      }
      label.check:hover {
        background: var(--hover);
      }
      label.check input {
        accent-color: var(--ink);
      }

      @media (max-width: 900px) {
        .name,
        .label-text {
          display: none;
        }
      }
    `,
  ];

  /** Place a popover under the button that opened it. */
  private positionPopover(e: Event): void {
    const pop = e.target as HTMLElement;
    if ((e as ToggleEvent).newState !== 'open') return;
    const trigger = this.renderRoot.querySelector(`[popovertarget="${pop.id}"]`) as HTMLElement | null;
    if (!trigger) return;
    const r = trigger.getBoundingClientRect();
    const left = pop.offsetWidth ? Math.min(r.left, window.innerWidth - pop.offsetWidth - 8) : r.left;
    pop.style.left = `${Math.max(8, left)}px`;
    pop.style.top = `${r.bottom + 6}px`;
  }

  private close(id: string): void {
    (this.renderRoot.querySelector(`#${id}`) as HTMLElement | null)?.hidePopover?.();
  }

  private async openFile(): Promise<void> {
    this.close('file-menu');
    const text = await pickTextFile();
    if (text === null) return;
    const error = this.editor.importJson(text);
    this.toast(error ?? 'Design opened.');
  }

  private saveFile(): void {
    this.close('file-menu');
    downloadText(fileNameFor(this.state.design), this.editor.exportJson());
  }

  private print(): void {
    this.close('file-menu');
    printCreasePattern(this.state);
  }

  private toast(message: string): void {
    this.dispatchEvent(new CustomEvent('app-toast', { detail: message, bubbles: true, composed: true }));
  }

  render() {
    if (!this.state) return nothing;
    const { design, ui, canUndo, canRedo } = this.state;
    return html`
      <div class="brand">
        ${icons.logo}
        <span class="wordmark">Pleatsmith</span>
      </div>
      <button class="quiet" popovertarget="file-menu">${icons.file}<span class="label-text">File</span>${icons.chevron}</button>
      <div id="file-menu" popover class="menu" @beforetoggle=${this.positionPopover} @toggle=${this.positionPopover}>
        <button @click=${() => (this.close('file-menu'), this.editor.newDesign())}>New design</button>
        <button @click=${() => this.openFile()}>${icons.upload} Open file…</button>
        <button @click=${() => this.saveFile()}>${icons.download} Save file</button>
        <button @click=${() => this.print()}>${icons.print} Print crease pattern…</button>
        <hr />
        <div class="group">Examples</div>
        ${PRESETS.map(
          (p) => html`<button class="preset" @click=${() => (this.close('file-menu'), this.editor.loadPreset(p.id))}>
            <span>${p.name}</span><small>${p.description}</small>
          </button>`,
        )}
      </div>
      <span class="name" title=${design.name}>${design.name}</span>
      <div class="divider"></div>
      <button class="icon quiet" title="Undo (Ctrl+Z)" aria-label="Undo" ?disabled=${!canUndo} @click=${() => this.editor.undo()}>${icons.undo}</button>
      <button class="icon quiet" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" ?disabled=${!canRedo} @click=${() => this.editor.redo()}>${icons.redo}</button>
      <div class="spacer"></div>
      <button class="icon quiet" title="Print crease pattern (Ctrl+P)" aria-label="Print crease pattern" @click=${() => this.print()}>${icons.print}</button>
      <button
        aria-pressed=${design.symmetry.book}
        title="Book symmetry: mirror left and right (B)"
        @click=${() => this.editor.setBookSymmetry(!design.symmetry.book)}
      >
        ${icons.mirror}<span class="label-text">Symmetry</span>
      </button>
      <div class="seg" role="group" aria-label="Crease colours">
        <button aria-pressed=${ui.viewMode === 'structure'} title="Colour creases by kind (M toggles)" @click=${() => this.editor.setViewMode('structure')}>Structure</button>
        <button aria-pressed=${ui.viewMode === 'mv'} title="Colour creases by fold direction (M toggles)" @click=${() => this.editor.setViewMode('mv')}>Mountain/valley</button>
      </div>
      <button class="quiet" popovertarget="layers-menu" title="Layers">${icons.layers}<span class="label-text">Layers</span></button>
      <div id="layers-menu" popover class="menu" @beforetoggle=${this.positionPopover} @toggle=${this.positionPopover}>
        ${LAYERS.map(
          ([id, label]) => html`<label class="check">
            <input type="checkbox" .checked=${ui.layers[id]} @change=${() => this.editor.toggleLayer(id)} />${label}
          </label>`,
        )}
      </div>
    `;
  }
}

customElements.define('bp-topbar', BpTopbar);

declare global {
  interface HTMLElementTagNameMap {
    'bp-topbar': BpTopbar;
  }
}
