import { css } from 'lit';

export const canvasStyles = css`
  :host {
    position: relative;
    display: block;
    overflow: hidden;
    background: var(--mat);
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }

  /* The cutting mat: a 1 cm-style grid that does not follow zoom. */
  .mat {
    position: absolute;
    inset: 0;
    background-color: var(--mat);
    background-image:
      linear-gradient(var(--mat-line-major) 1px, transparent 1px),
      linear-gradient(90deg, var(--mat-line-major) 1px, transparent 1px),
      linear-gradient(var(--mat-line) 1px, transparent 1px),
      linear-gradient(90deg, var(--mat-line) 1px, transparent 1px);
    background-size: 120px 120px, 120px 120px, 24px 24px, 24px 24px;
    background-position: -1px -1px;
  }

  svg.stage {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .stage * {
    vector-effect: non-scaling-stroke;
  }

  .paper {
    fill: var(--paper);
    filter: drop-shadow(0 10px 24px rgba(6, 22, 18, 0.45));
  }
  .paper-edge {
    fill: none;
    stroke: var(--paper-edge);
    stroke-width: 1.6px;
    pointer-events: none;
  }
  .grid {
    stroke: rgba(120, 112, 90, 0.16);
    stroke-width: 1px;
  }
  .grid.major {
    stroke: rgba(120, 112, 90, 0.28);
  }
  .sym-axis {
    stroke: var(--accent);
    stroke-width: 1.5px;
    stroke-dasharray: 6 5;
    pointer-events: none;
  }

  /* Layout */
  .flap {
    fill: var(--flap-fill);
    stroke: #b7c3cd;
    stroke-width: 1px;
  }
  .flap.alt {
    fill: var(--flap-fill-alt);
    stroke: #c3c7b2;
  }
  .flap.partner {
    stroke: var(--accent);
    stroke-dasharray: 4 3;
    stroke-width: 1.4px;
  }
  .flap.selected {
    fill: var(--accent-soft);
    stroke: var(--accent);
    stroke-width: 2px;
  }
  .flap.error {
    fill: var(--error-soft);
    stroke: var(--error);
  }
  .river rect {
    fill: var(--river-fill);
    stroke: none;
  }
  .river .centerline {
    fill: none;
    stroke: var(--river-line);
    stroke-width: 1px;
    stroke-dasharray: 3 4;
  }
  .river.selected rect {
    fill: #f3dcae;
  }
  .river.selected .centerline {
    stroke: var(--accent-ink);
  }
  .river.partner rect {
    fill: #e2e9d9;
  }

  .flap-circle {
    fill: none;
    stroke: #6f8fa6;
    stroke-width: 1.2px;
    stroke-dasharray: 5 4;
    pointer-events: none;
  }
  .flap-circle.selected {
    stroke: var(--accent-ink);
    stroke-width: 1.8px;
  }

  .ambiguous rect {
    fill: url(#hatch);
  }
  .hatch-line {
    stroke: #e2a12b;
    stroke-width: 2px;
    opacity: 0.6;
  }

  /* Creases */
  .crease {
    stroke-linecap: round;
    fill: none;
    pointer-events: none;
  }
  .crease.hinge {
    stroke: var(--c-hinge);
    stroke-width: 1.8px;
  }
  .crease.ridge {
    stroke: var(--c-ridge);
    stroke-width: 1.6px;
  }
  .crease.axis {
    stroke: var(--c-axis);
    stroke-width: 1.6px;
  }
  .crease.axial {
    stroke: var(--c-axial);
    stroke-width: 1.1px;
  }
  .crease.conflict {
    stroke: var(--c-conflict);
    stroke-width: 2.4px;
    stroke-dasharray: 4 3;
  }
  .crease.m {
    stroke: var(--c-mountain);
    stroke-width: 1.6px;
  }
  .crease.v {
    stroke: var(--c-valley);
    stroke-width: 1.6px;
    stroke-dasharray: 5 3;
  }
  .crease.u {
    stroke: var(--c-unassigned);
    stroke-width: 1.2px;
    stroke-dasharray: 1.5 3;
  }
  /* In the mountain/valley view the layout steps back. */
  .stage.mv .flap,
  .stage.mv .flap.alt {
    fill: var(--paper);
    stroke: none;
  }
  .stage.mv .river rect {
    fill: #eef3f6;
  }

  /* Markers */
  .fail {
    fill: none;
    stroke-width: 2px;
  }
  .fail.k {
    stroke: var(--c-conflict);
  }
  .fail.m {
    stroke: #7a3cc2;
  }
  .focus {
    fill: none;
    stroke: var(--accent);
    stroke-width: 3px;
    animation: pulse 1.2s ease-out 2;
  }
  @keyframes pulse {
    from {
      stroke-width: 8px;
      opacity: 0.3;
    }
    to {
      stroke-width: 3px;
      opacity: 1;
    }
  }

  /* Labels */
  .tip circle {
    fill: var(--ink);
  }
  .tip.selected circle {
    fill: var(--accent-ink);
  }
  .tip .tip-shape {
    fill: none;
    stroke: var(--ink);
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .tip.selected .tip-shape {
    stroke: var(--accent-ink);
  }
  .tip .root-ring {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2px;
  }
  .labels text {
    font-family: var(--font);
    font-weight: 600;
    fill: var(--ink);
    paint-order: stroke;
    stroke: var(--paper);
    stroke-width: 3px;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .labels .river-label {
    fill: #2f5f80;
  }

  /* Handles */
  .handles rect {
    fill: var(--surface);
    stroke: var(--accent-ink);
    stroke-width: 1.5px;
  }
  .handles .segment {
    fill: var(--accent);
  }
  .handles .width-handle rect {
    fill: var(--accent);
    stroke: var(--accent-ink);
  }

  /* Tool overlays */
  .ghost rect {
    fill: rgba(226, 161, 43, 0.12);
    stroke: var(--accent);
    stroke-width: 1px;
    stroke-dasharray: 3 3;
  }
  .ghost circle {
    fill: var(--accent-ink);
  }
  .river-draft rect {
    fill: rgba(93, 143, 179, 0.28);
    stroke: var(--river-line);
    stroke-width: 1px;
  }
  .river-draft polyline {
    fill: none;
    stroke: var(--accent-ink);
    stroke-width: 1.5px;
  }
  .river-draft circle {
    fill: var(--accent-ink);
  }

  /* Floating chrome on the mat */
  .zoom,
  .legend,
  .status {
    position: absolute;
    background: rgba(251, 250, 246, 0.94);
    border: 1px solid rgba(30, 36, 34, 0.12);
    border-radius: var(--radius);
    box-shadow: 0 4px 14px rgba(6, 22, 18, 0.25);
    font-size: var(--fs-xs);
    color: var(--ink-2);
  }
  .zoom {
    right: var(--space-3);
    bottom: var(--space-3);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 3px;
  }
  .zoom button {
    height: 26px;
    width: 26px;
    border: 0;
    background: transparent;
  }
  .zoom-value {
    min-width: 42px;
    text-align: center;
    font-variant-numeric: tabular-nums;
  }
  .legend {
    left: var(--space-3);
    bottom: var(--space-3);
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding: 7px var(--space-3);
    max-width: calc(100% - 220px);
  }
  .legend .key {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
  .legend svg {
    width: 22px;
    height: 6px;
  }
  .legend .crease {
    vector-effect: none;
  }
  .status {
    left: var(--space-3);
    top: var(--space-3);
    display: flex;
    gap: var(--space-3);
    align-items: center;
    padding: 6px var(--space-3);
    max-width: calc(100% - 24px);
  }
  .coords {
    font-weight: 600;
    color: var(--ink);
    font-variant-numeric: tabular-nums;
    min-width: 46px;
  }
  .hint {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (max-width: 700px) {
    .legend {
      display: none;
    }
    .hint {
      display: none;
    }
  }
`;
