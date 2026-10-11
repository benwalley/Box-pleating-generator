/**
 * Validation results. Each issue explains what is wrong and how to fix it;
 * clicking one selects or points at what it refers to.
 */
import { LitElement, html, css, nothing } from 'lit';
import type { Issue } from '../core/validation/issues.ts';
import type { EditorController } from '../state/editor.ts';
import type { AppState } from '../state/types.ts';
import { icons } from './icons.ts';
import { controlStyles, sectionStyles } from './shared-styles.ts';

export class BpChecks extends LitElement {
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
        display: flex;
        flex-direction: column;
        min-height: 0;
      }
      .counts {
        display: flex;
        gap: var(--space-2);
        font-size: var(--fs-xs);
        font-weight: 600;
      }
      .count {
        display: inline-flex;
        align-items: center;
        gap: 3px;
      }
      .count svg.i {
        width: 14px;
        height: 14px;
      }
      .count.error {
        color: var(--error);
      }
      .count.warning {
        color: var(--warning);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0 var(--space-4) var(--space-2);
        overflow: auto;
        min-height: 0;
        flex: 1;
      }
      li + li {
        margin-top: 6px;
      }
      .issue {
        display: grid;
        grid-template-columns: 18px 1fr;
        gap: var(--space-2);
        width: 100%;
        height: auto;
        text-align: left;
        align-items: start;
        padding: var(--space-2) var(--space-3);
        line-height: 1.4;
        font-weight: 400;
        white-space: normal;
        border-radius: var(--radius);
        border: 1px solid transparent;
      }
      .issue.error {
        background: var(--error-soft);
      }
      .issue.error svg {
        color: var(--error);
      }
      .issue.warning {
        background: var(--warning-soft);
      }
      .issue.warning svg {
        color: var(--warning);
      }
      .issue.info {
        background: var(--info-soft);
      }
      .issue.info svg {
        color: var(--info);
      }
      .issue:hover:not(:disabled) {
        border-color: var(--line-strong);
      }
      .issue:disabled {
        opacity: 1;
        cursor: default;
        color: var(--ink);
      }
      .clean {
        display: flex;
        gap: var(--space-2);
        align-items: center;
        color: var(--ok);
        font-size: var(--fs-sm);
        padding: 0 var(--space-4) var(--space-3);
      }
      .footer {
        border-top: 1px solid var(--line);
        padding: var(--space-2) var(--space-4) var(--space-3);
        font-size: var(--fs-xs);
        color: var(--ink-3);
        line-height: 1.45;
      }
    `,
  ];

  render() {
    if (!this.state) return nothing;
    const { issues, foldability, pattern } = this.state.analysis;
    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;
    return html`
      <div class="section-head">
        <h2>Checks</h2>
        <div class="counts">
          ${errors ? html`<span class="count error">${icons.error}${errors}</span>` : nothing}
          ${warnings ? html`<span class="count warning">${icons.warning}${warnings}</span>` : nothing}
        </div>
      </div>
      ${issues.length
        ? html`<ul>${issues.map((i) => html`<li>${this.renderIssue(i)}</li>`)}</ul>`
        : html`<div class="clean">${icons.check} Layout is valid and every vertex passes the local fold checks.</div>`}
      <div class="footer">
        ${pattern && foldability
          ? html`${foldability.verticesChecked} interior vertices checked. Hinges are left unassigned because their direction depends on how the flaps are flattened.`
          : html`The crease pattern appears once the layout has no overlaps.`}
        These are local checks only; test a real fold before trusting the pattern.
      </div>
    `;
  }

  private renderIssue(issue: Issue) {
    const target = issue.refs[0];
    const icon = issue.severity === 'error' ? icons.error : issue.severity === 'warning' ? icons.warning : icons.info;
    return html`<button class="issue ${issue.severity}" ?disabled=${!target} @click=${() => this.reveal(issue)}>
      ${icon}<span>${issue.message}</span>
    </button>`;
  }

  private reveal(issue: Issue): void {
    const ref = issue.refs[0];
    if (!ref) return;
    if (ref.kind === 'flap' || ref.kind === 'river') this.editor.select({ kind: ref.kind, id: ref.id });
    else if (ref.kind === 'node') this.editor.select({ kind: 'node', key: ref.key });
    else this.editor.focusPoint(ref.x, ref.y);
  }
}

customElements.define('bp-checks', BpChecks);

declare global {
  interface HTMLElementTagNameMap {
    'bp-checks': BpChecks;
  }
}
