/** Styles shared by several components: buttons, inputs, panel sections. */
import { css } from 'lit';

export const controlStyles = css`
  :host {
    font-family: var(--font);
    color: var(--ink);
  }

  button {
    font: inherit;
    font-size: var(--fs-sm);
    font-weight: 500;
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    height: 30px;
    padding: 0 var(--space-3);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    white-space: nowrap;
  }
  button:hover:not(:disabled) {
    background: var(--hover);
  }
  button:disabled {
    color: var(--ink-3);
    cursor: default;
    opacity: 0.6;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  [tabindex]:focus-visible {
    outline: none;
    box-shadow: var(--focus);
  }
  button.quiet {
    border-color: transparent;
    background: transparent;
  }
  button.quiet:hover:not(:disabled) {
    background: var(--hover);
  }
  button.icon {
    width: 30px;
    padding: 0;
    justify-content: center;
  }
  button.danger {
    color: var(--error);
  }
  button.primary {
    background: var(--ink);
    border-color: var(--ink);
    color: var(--paper);
  }
  button.primary:hover:not(:disabled) {
    background: var(--ink-2);
  }
  button[aria-pressed='true'] {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: var(--accent-ink);
  }

  input[type='text'],
  input[type='number'],
  select {
    font: inherit;
    font-size: var(--fs-sm);
    color: var(--ink);
    background: var(--surface);
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    height: 30px;
    padding: 0 var(--space-2);
    min-width: 0;
    width: 100%;
  }
  input[type='number'] {
    font-variant-numeric: tabular-nums;
  }

  svg.i {
    width: 18px;
    height: 18px;
    flex: none;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
`;

export const sectionStyles = css`
  .section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4) var(--space-2);
  }
  .section-head h2 {
    margin: 0;
    font-size: var(--fs-md);
    font-weight: 650;
    letter-spacing: -0.005em;
  }
  .section-body {
    padding: 0 var(--space-4) var(--space-4);
  }
  .muted {
    color: var(--ink-3);
  }
  .field {
    display: grid;
    grid-template-columns: 92px 1fr;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-2);
  }
  .field > label,
  .field > .label {
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }
  .row {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    align-items: center;
  }
  .note {
    font-size: var(--fs-sm);
    color: var(--ink-2);
    line-height: 1.45;
    margin: var(--space-2) 0;
    max-width: 60ch;
  }
`;
