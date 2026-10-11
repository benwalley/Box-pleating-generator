/**
 * Application shell. Owns the EditorController, re-renders on every state
 * change and hands state + editor down to the panels. Global keyboard
 * shortcuts live here.
 */
import { LitElement, html, css } from 'lit';
import type { Design } from '../core/model/types.ts';
import { findPreset } from '../core/presets.ts';
import { EditorController } from '../state/editor.ts';
import { attachAutosave, loadSavedDesign } from '../state/persistence.ts';
import type { AppState } from '../state/types.ts';
import type { BpCanvas } from './bp-canvas.ts';
import './bp-canvas.ts';
import './bp-checks.ts';
import './bp-inspector.ts';
import './bp-toolrail.ts';
import './bp-topbar.ts';
import './bp-tree-view.ts';

const TOOL_KEYS: Record<string, AppState['ui']['tool']> = { v: 'select', f: 'flap', r: 'river', h: 'pan' };

export class BpApp extends LitElement {
  static properties = {
    state: { state: true },
    toast: { state: true },
  };

  declare state: AppState;
  declare toast: string | null;

  readonly editor: EditorController;
  private unsubscribe: (() => void) | null = null;
  private stopAutosave: (() => void) | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    const initial: Design = loadSavedDesign() ?? findPreset('lizard')!.build();
    this.editor = new EditorController(initial);
    this.state = this.editor.state;
    this.toast = null;
  }

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: var(--rail-w) minmax(0, 1fr) var(--sidebar-w);
      grid-template-rows: var(--topbar-h) minmax(0, 1fr);
      grid-template-areas:
        'top top top'
        'rail canvas side';
      height: 100vh;
      height: 100dvh;
      font-family: var(--font);
      color: var(--ink);
      background: var(--panel);
    }
    bp-topbar {
      grid-area: top;
    }
    bp-toolrail {
      grid-area: rail;
    }
    bp-canvas {
      grid-area: canvas;
      min-width: 0;
      min-height: 0;
    }
    aside {
      grid-area: side;
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: var(--panel);
      border-left: 1px solid var(--line);
      overflow: hidden;
    }
    aside > * + * {
      border-top: 1px solid var(--line);
    }
    bp-inspector {
      flex: none;
      max-height: 46%;
      overflow: auto;
    }
    bp-tree-view {
      flex: 1 1 0;
    }
    bp-checks {
      flex: 0 1 auto;
      max-height: 34%;
    }
    .toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      background: var(--ink);
      color: var(--paper);
      padding: 10px 16px;
      border-radius: var(--radius);
      font-size: var(--fs-sm);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
      z-index: 10;
    }

    @media (max-width: 1100px) {
      :host {
        --sidebar-w: 300px;
      }
    }
    @media (max-width: 700px) {
      :host {
        grid-template-columns: 1fr;
        grid-template-rows: var(--topbar-h) auto 60vh auto;
        grid-template-areas: 'top' 'rail' 'canvas' 'side';
        height: auto;
        min-height: 100vh;
      }
      aside {
        border-left: 0;
        overflow: visible;
      }
      bp-inspector,
      bp-checks {
        max-height: none;
      }
      bp-tree-view {
        min-height: 300px;
      }
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    this.unsubscribe = this.editor.subscribe((s) => (this.state = s));
    this.stopAutosave = attachAutosave(this.editor);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKey);
    this.addEventListener('app-toast', this.onToast as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.stopAutosave?.();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKey);
    this.removeEventListener('app-toast', this.onToast as EventListener);
  }

  private get canvas(): BpCanvas | null {
    return this.renderRoot.querySelector('bp-canvas');
  }

  private onToast = (e: CustomEvent<string>) => {
    this.toast = e.detail;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toast = null), 3200);
  };

  /** Keys typed into fields, or Space/Enter on a focused control, belong to that control. */
  private belongsToControl(e: KeyboardEvent): boolean {
    const t = e.composedPath()[0] as HTMLElement | undefined;
    if (!t || !t.tagName) return false;
    const tag = t.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable) return true;
    const activates = e.key === ' ' || e.key === 'Enter';
    return activates && (tag === 'button' || t.hasAttribute('tabindex') || tag === 'a');
  }

  private onKey = (e: KeyboardEvent) => {
    if (this.belongsToControl(e)) return;
    const canvas = this.canvas;
    if (canvas?.handleKey(e)) {
      e.preventDefault();
      return;
    }
    if (e.type !== 'keydown') return;
    const ed = this.editor;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) ed.redo();
      else ed.undo();
      return;
    }
    if (mod && key === 'y') {
      e.preventDefault();
      ed.redo();
      return;
    }
    if (mod) return;

    if (TOOL_KEYS[key] && !e.altKey) {
      ed.setTool(TOOL_KEYS[key]);
      return;
    }
    switch (e.key) {
      case 'Delete':
      case 'Backspace':
        e.preventDefault();
        ed.deleteSelection();
        return;
      case 'Escape':
        canvas?.cancelTool();
        ed.select(null);
        return;
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (!ed.state.ui.selection) return;
        e.preventDefault();
        const step = e.shiftKey ? 4 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        ed.nudgeSelection(dx, dy);
        return;
      }
      case '+':
      case '=':
      case ']':
        ed.growSelection(1);
        return;
      case '-':
      case '_':
      case '[':
        ed.growSelection(-1);
        return;
      case 'm':
      case 'M':
        ed.setViewMode(ed.state.ui.viewMode === 'mv' ? 'structure' : 'mv');
        return;
      case 'b':
      case 'B':
        ed.setBookSymmetry(!ed.design.symmetry.book);
        return;
      case '0':
        canvas?.fitView();
        return;
    }
  };

  render() {
    const s = this.state;
    const e = this.editor;
    return html`
      <bp-topbar .state=${s} .editor=${e}></bp-topbar>
      <bp-toolrail .state=${s} .editor=${e}></bp-toolrail>
      <bp-canvas .state=${s} .editor=${e}></bp-canvas>
      <aside aria-label="Details">
        <bp-inspector .state=${s} .editor=${e}></bp-inspector>
        <bp-tree-view .state=${s} .editor=${e}></bp-tree-view>
        <bp-checks .state=${s} .editor=${e}></bp-checks>
      </aside>
      ${this.toast ? html`<div class="toast" role="status">${this.toast}</div>` : ''}
    `;
  }
}

customElements.define('bp-app', BpApp);

declare global {
  interface HTMLElementTagNameMap {
    'bp-app': BpApp;
  }
}
