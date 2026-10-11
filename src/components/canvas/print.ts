/**
 * Print the crease pattern on its own: just the paper square and the creases,
 * coloured as in the current view mode, filling the printable page.
 */
import type { AppState } from '../../state/types.ts';
import { creaseClass, sortedCreases } from './layers.ts';

/** Stroke styles per crease class, in print px (1/96 in); colours come from the theme tokens. */
const STROKES: Record<string, { color: string; width: number; dash?: string }> = {
  hinge: { color: '--c-hinge', width: 1.2 },
  ridge: { color: '--c-ridge', width: 1.1 },
  axis: { color: '--c-axis', width: 1.1 },
  axial: { color: '--c-axial', width: 0.8 },
  conflict: { color: '--c-conflict', width: 1.6, dash: '4 3' },
  m: { color: '--c-mountain', width: 1.1 },
  v: { color: '--c-valley', width: 1.1, dash: '5 3' },
  u: { color: '--c-unassigned', width: 0.8, dash: '1.5 3' },
};

const escapeXml = (s: string) => s.replace(/[<>&"]/g, (c) => `&#${c.charCodeAt(0)};`);

export function creasePatternSvg(state: AppState): string {
  const { design, analysis, ui } = state;
  const n = design.gridSize;
  const tokens = getComputedStyle(document.documentElement);
  const css = Object.entries(STROKES)
    .map(([cls, s]) => {
      const dash = s.dash ? `stroke-dasharray:${s.dash};` : '';
      return `.${cls}{stroke:${tokens.getPropertyValue(s.color).trim() || '#000'};stroke-width:${s.width}px;${dash}}`;
    })
    .join('');
  const lines = sortedCreases(analysis)
    .map((c) => `<line class="${creaseClass(c, ui.viewMode).replace('crease ', '')}" x1="${c.x1}" y1="${c.y1}" x2="${c.x2}" y2="${c.y2}"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}">
<style>*{vector-effect:non-scaling-stroke;fill:none;stroke-linecap:round}.edge{stroke:#000;stroke-width:1.5px}${css}</style>
${lines}<rect class="edge" x="0" y="0" width="${n}" height="${n}"/>
</svg>`;
}

/** Open the browser's print dialog for the crease pattern, via a hidden iframe. */
export function printCreasePattern(state: AppState): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.append(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(state.design.name)}</title>
<style>
  @page { margin: 10mm; }
  html, body { margin: 0; height: 100%; }
  body { display: flex; align-items: center; justify-content: center; }
  svg { width: min(100vw, 100vh); height: min(100vw, 100vh); display: block; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style></head><body>${creasePatternSvg(state)}</body></html>`);
  doc.close();
  const win = frame.contentWindow!;
  win.addEventListener('afterprint', () => setTimeout(() => frame.remove(), 0));
  win.focus();
  win.print();
}
