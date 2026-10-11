/** Inline stroke icons, drawn on a 20x20 grid. */
import { svg, type SVGTemplateResult } from 'lit';

const icon = (body: SVGTemplateResult) =>
  svg`<svg class="i" viewBox="0 0 20 20" aria-hidden="true">${body}</svg>`;

export const icons = {
  select: icon(svg`<path d="M5 3.5l10 6-4.4 1.2L8.4 15z"/>`),
  flap: icon(svg`<rect x="3.5" y="3.5" width="13" height="13"/><path d="M3.5 3.5l13 13M16.5 3.5l-13 13" opacity=".45"/><circle cx="10" cy="10" r="1.4" fill="currentColor" stroke="none"/>`),
  river: icon(svg`<path d="M2.5 7h9.5v9.5M2.5 12.5H6.5v4"/><path d="M2.5 9.75h7v6.75" stroke-dasharray="1.6 1.6" opacity=".6"/>`),
  pan: icon(svg`<path d="M10 2.5v15M2.5 10h15M10 2.5l-2 2M10 2.5l2 2M10 17.5l-2-2M10 17.5l2-2M2.5 10l2-2M2.5 10l2 2M17.5 10l-2-2M17.5 10l-2 2"/>`),
  undo: icon(svg`<path d="M7.5 5L4 8.5 7.5 12"/><path d="M4 8.5h7.5a4.5 4.5 0 010 9H8"/>`),
  redo: icon(svg`<path d="M12.5 5L16 8.5 12.5 12"/><path d="M16 8.5H8.5a4.5 4.5 0 000 9H12"/>`),
  mirror: icon(svg`<path d="M10 2.5v15" stroke-dasharray="1.8 1.8"/><path d="M7.5 5.5L3 10l4.5 4.5zM12.5 5.5L17 10l-4.5 4.5z"/>`),
  trash: icon(svg`<path d="M4 5.5h12M8 5.5V3.5h4v2M5.5 5.5l.8 11h7.4l.8-11"/>`),
  root: icon(svg`<circle cx="10" cy="6" r="2.5"/><path d="M10 8.5v4M10 12.5l-5 4M10 12.5l5 4M10 12.5v4"/>`),
  plus: icon(svg`<path d="M10 4.5v11M4.5 10h11"/>`),
  minus: icon(svg`<path d="M4.5 10h11"/>`),
  fit: icon(svg`<path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/><rect x="7" y="7" width="6" height="6"/>`),
  file: icon(svg`<path d="M5 2.5h6.5L15 6v11.5H5z"/><path d="M11.5 2.5V6H15"/>`),
  layers: icon(svg`<path d="M10 3l7 3.8-7 3.8-7-3.8zM3 10.4l7 3.8 7-3.8M3 13.8l7 3.8 7-3.8"/>`),
  download: icon(svg`<path d="M10 3v10M6 9.5l4 4 4-4M4 16.5h12"/>`),
  print: icon(svg`<path d="M5.5 7.5v-5h9v5M5.5 14H3V8h14v6h-2.5"/><rect x="5.5" y="11.5" width="9" height="6"/>`),
  upload: icon(svg`<path d="M10 14V4M6 7.5l4-4 4 4M4 16.5h12"/>`),
  chevron: icon(svg`<path d="M6 8l4 4 4-4"/>`),
  error: icon(svg`<circle cx="10" cy="10" r="7"/><path d="M10 6.5v4.2M10 13.3v.2"/>`),
  warning: icon(svg`<path d="M10 3l7.5 13.5h-15z"/><path d="M10 8v3.6M10 14v.2"/>`),
  info: icon(svg`<circle cx="10" cy="10" r="7"/><path d="M10 9v4.5M10 6.5v.2"/>`),
  check: icon(svg`<path d="M4.5 10.5l3.5 3.5 7.5-8"/>`),
  logo: svg`<svg viewBox="0 0 24 24" aria-hidden="true" class="logo">
    <rect x="2" y="2" width="20" height="20" rx="1.5" fill="var(--paper)" stroke="var(--ink)" stroke-width="1.6"/>
    <path d="M2 2l20 20M22 2L12 12" stroke="var(--c-mountain)" stroke-width="1.4"/>
    <path d="M12 12L2 22M12 2v20" stroke="var(--c-valley)" stroke-width="1.4" stroke-dasharray="2 1.6"/>
  </svg>`,
};
