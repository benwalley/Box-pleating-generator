import { LitElement, html, css } from 'lit';
import { controlStyles } from './shared-styles.ts';
import { icons } from './icons.ts';

/**
 * Integer input with step buttons. Fires `value-change` with the new value
 * (already clamped) when the user commits a change.
 */
export class BpNumberField extends LitElement {
  static properties = {
    value: { type: Number },
    min: { type: Number },
    max: { type: Number },
    step: { type: Number },
    label: { type: String },
    disabled: { type: Boolean },
  };

  declare value: number;
  declare min: number;
  declare max: number;
  declare step: number;
  declare label: string;
  declare disabled: boolean;

  constructor() {
    super();
    this.value = 0;
    this.min = -Infinity;
    this.max = Infinity;
    this.step = 1;
    this.label = '';
    this.disabled = false;
  }

  static styles = [
    controlStyles,
    css`
      :host {
        display: inline-flex;
        width: 100%;
      }
      .wrap {
        display: grid;
        grid-template-columns: 30px 1fr 30px;
        width: 100%;
      }
      input {
        text-align: center;
        border-radius: 0;
        border-left: 0;
        border-right: 0;
        -moz-appearance: textfield;
      }
      input::-webkit-outer-spin-button,
      input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      button {
        padding: 0;
        justify-content: center;
      }
      button:first-child {
        border-radius: var(--radius-sm) 0 0 var(--radius-sm);
      }
      button:last-child {
        border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
      }
      svg.i {
        width: 14px;
        height: 14px;
      }
    `,
  ];

  private emit(v: number): void {
    const next = Math.min(this.max, Math.max(this.min, Math.round(v)));
    if (Number.isNaN(next)) return;
    if (next !== this.value) {
      this.dispatchEvent(new CustomEvent('value-change', { detail: next, bubbles: true, composed: true }));
    }
    this.requestUpdate();
  }

  render() {
    return html`<div class="wrap">
      <button type="button" aria-label="Decrease ${this.label}" ?disabled=${this.disabled || this.value <= this.min} @click=${() => this.emit(this.value - this.step)}>${icons.minus}</button>
      <input
        type="number"
        aria-label=${this.label}
        .value=${String(this.value)}
        min=${this.min}
        max=${this.max}
        ?disabled=${this.disabled}
        @change=${(e: Event) => this.emit(Number((e.target as HTMLInputElement).value))}
        @keydown=${(e: KeyboardEvent) => e.stopPropagation()}
      />
      <button type="button" aria-label="Increase ${this.label}" ?disabled=${this.disabled || this.value >= this.max} @click=${() => this.emit(this.value + this.step)}>${icons.plus}</button>
    </div>`;
  }
}

customElements.define('bp-number-field', BpNumberField);

declare global {
  interface HTMLElementTagNameMap {
    'bp-number-field': BpNumberField;
  }
}
