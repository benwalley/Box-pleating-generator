/** Vertical tool picker on the left of the canvas. */
import { LitElement, html, css, nothing } from 'lit';
import { TOOL_ORDER } from '../editor/tools/index.ts';
import type { EditorController } from '../state/editor.ts';
import type { AppState, ToolId } from '../state/types.ts';
import { icons } from './icons.ts';
import { controlStyles } from './shared-styles.ts';

const TOOL_INFO: Record<ToolId, { label: string; key: string }> = {
  select: { label: 'Select and move', key: 'V' },
  flap: { label: 'Add flap', key: 'F' },
  river: { label: 'Draw river', key: 'R' },
  pan: { label: 'Pan', key: 'H' },
};

export class BpToolrail extends LitElement {
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
        flex-direction: column;
        align-items: center;
        gap: var(--space-1);
        padding: var(--space-2) 0;
        background: var(--surface);
        border-right: 1px solid var(--line);
      }
      button {
        width: 40px;
        height: 40px;
        padding: 0;
        justify-content: center;
        border-color: transparent;
        background: transparent;
        position: relative;
      }
      button svg.i {
        width: 20px;
        height: 20px;
      }
      button[aria-pressed='true'] {
        background: var(--ink);
        border-color: var(--ink);
        color: var(--paper);
      }
      .key {
        position: absolute;
        right: 3px;
        bottom: 2px;
        font-size: 9px;
        font-weight: 700;
        opacity: 0.55;
      }
      @media (max-width: 700px) {
        :host {
          flex-direction: row;
          justify-content: center;
          border-right: 0;
          border-bottom: 1px solid var(--line);
        }
      }
    `,
  ];

  render() {
    if (!this.state) return nothing;
    return TOOL_ORDER.map((id) => {
      const info = TOOL_INFO[id];
      return html`<button
        aria-pressed=${this.state.ui.tool === id}
        aria-label=${info.label}
        title="${info.label} (${info.key})"
        @click=${() => this.editor.setTool(id)}
      >
        ${icons[id]}<span class="key" aria-hidden="true">${info.key}</span>
      </button>`;
    });
  }
}

customElements.define('bp-toolrail', BpToolrail);

declare global {
  interface HTMLElementTagNameMap {
    'bp-toolrail': BpToolrail;
  }
}
