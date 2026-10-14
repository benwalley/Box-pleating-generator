/**
 * SVG layers of the canvas, bottom to top. Each function is pure: it takes
 * state and returns an svg template. Coordinates are grid units; `px` is the
 * size of one screen pixel in grid units, for sizing text and handles.
 */
import { svg, nothing, type SVGTemplateResult } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import type { Analysis } from '../../core/analyze.ts';
import type { Crease } from '../../core/creases/types.ts';
import { flapRect, shapePolygon, sideNormals, tipCenter } from '../../core/geometry/flap-shape.ts';
import { flapName, riverName } from '../../core/model/naming.ts';
import type { Design, Flap, River } from '../../core/model/types.ts';
import { flapHandles, riverHandles } from '../../editor/handles.ts';
import type { AppState, Selection, ViewMode } from '../../state/types.ts';

type Layer = SVGTemplateResult | typeof nothing;

export function paperLayer(n: number): Layer {
  return svg`<rect class="paper" x="0" y="0" width=${n} height=${n}></rect>`;
}

export function gridLayer(n: number): Layer {
  const lines: SVGTemplateResult[] = [];
  for (let i = 1; i < n; i++) {
    const major = n % 4 === 0 && i % 4 === 0;
    const cls = major ? 'grid major' : 'grid';
    lines.push(svg`<line class=${cls} x1=${i} y1="0" x2=${i} y2=${n}></line>`);
    lines.push(svg`<line class=${cls} x1="0" y1=${i} x2=${n} y2=${i}></line>`);
  }
  return svg`<g>${lines}</g>`;
}

export function symmetryAxisLayer(design: Design): Layer {
  if (!design.symmetry.book) return nothing;
  const x = design.gridSize / 2;
  return svg`<line class="sym-axis" x1=${x} y1="-0.6" x2=${x} y2=${design.gridSize + 0.6}></line>`;
}

const isSelected = (sel: Selection | null, kind: 'flap' | 'river', id: string) =>
  sel?.kind === kind && sel.id === id;

function partnerOf(sel: Selection | null, design: Design): string | null {
  if (!sel || sel.kind === 'node') return null;
  const items: ReadonlyArray<Flap | River> = sel.kind === 'flap' ? design.flaps : design.rivers;
  const e = items.find((x) => x.id === sel.id);
  return e?.mirrorId && e.mirrorId !== e.id ? e.mirrorId : null;
}

/** Flap shapes (squares, or squares cut by circle tangents) and river strips. */
export function elementsLayer(state: AppState, flapsInError: ReadonlySet<string>): Layer {
  const { design, analysis, ui } = state;
  const sel = ui.selection;
  const partner = partnerOf(sel, design);
  const hubs = analysis.tree.hubOfFlap;
  const hubIndex = new Map<string, number>();
  for (const key of new Set(hubs.values())) hubIndex.set(key, hubIndex.size);
  return svg`<g class="elements">
    ${repeat(design.flaps, (f) => f.id, (f) => {
      const cls = [
        'flap',
        (hubIndex.get(hubs.get(f.id) ?? '') ?? 0) % 2 ? 'alt' : '',
        isSelected(sel, 'flap', f.id) ? 'selected' : '',
        partner === f.id ? 'partner' : '',
        flapsInError.has(f.id) ? 'error' : '',
      ].join(' ');
      const tangents = analysis.tree.circleNormals.get(f.id);
      if (tangents) {
        // Squares cut by tangent sides where the flap only fits as a circle.
        const corners = shapePolygon(f, f.r, sideNormals(tangents));
        return svg`<polygon class=${cls} points=${corners.map((p) => `${p.x},${p.y}`).join(' ')}></polygon>`;
      }
      const box = flapRect(f);
      return svg`<rect class=${cls} x=${box.x0} y=${box.y0} width=${box.x1 - box.x0} height=${box.y1 - box.y0}></rect>`;
    })}
    ${repeat(analysis.rivers, (g) => g.river.id, (g) => {
      const cls = ['river', isSelected(sel, 'river', g.river.id) ? 'selected' : '', partner === g.river.id ? 'partner' : ''].join(' ');
      const path = g.river.points.map((p) => `${p.x},${p.y}`).join(' ');
      return svg`<g class=${cls}>
        ${g.segments.map((s) => svg`<rect x=${s.rect.x0} y=${s.rect.y0} width=${s.rect.x1 - s.rect.x0} height=${s.rect.y1 - s.rect.y0}></rect>`)}
        <polyline class="centerline" points=${path}></polyline>
      </g>`;
    })}
  </g>`;
}

/** The circle each flap claims in circle packing: every point within the flap length of its tip (a rounded box for a rectangular tip). */
export function circlesLayer(state: AppState): Layer {
  const sel = state.ui.selection;
  return svg`<g class="flap-circles">
    ${repeat(state.design.flaps, (f) => f.id, (f) => {
      const cls = isSelected(sel, 'flap', f.id) ? 'flap-circle selected' : 'flap-circle';
      return svg`<rect class=${cls} x=${f.x - f.r} y=${f.y - f.r} width=${f.w + 2 * f.r} height=${f.h + 2 * f.r} rx=${f.r}></rect>`;
    })}
  </g>`;
}

export function ambiguousLayer(analysis: Analysis): Layer {
  const cells = analysis.pattern?.ambiguousCells ?? [];
  if (!cells.length) return nothing;
  return svg`<g class="ambiguous">${cells.map((c) => svg`<rect x=${c.x} y=${c.y} width="1" height="1"></rect>`)}</g>`;
}

export function creaseClass(c: Crease, mode: ViewMode): string {
  if (mode === 'mv') return c.mv === 'M' ? 'crease m' : c.mv === 'V' ? 'crease v' : 'crease u';
  if (c.kind === 'axial') return c.elevation === 0 ? 'crease axis' : 'crease axial';
  return `crease ${c.kind}`;
}

/** Hinges first so ridges and contours sit on top of them. */
export function sortedCreases(analysis: Analysis): Crease[] {
  const order = { hinge: 0, axial: 1, ridge: 2, conflict: 3 } as const;
  return [...(analysis.pattern?.lines ?? [])].sort((a, b) => order[a.kind] - order[b.kind]);
}

export function creaseLayer(analysis: Analysis, mode: ViewMode): Layer {
  const sorted = sortedCreases(analysis);
  return svg`<g class="creases">${sorted.map(
    (c) => svg`<line class=${creaseClass(c, mode)} x1=${c.x1} y1=${c.y1} x2=${c.x2} y2=${c.y2}></line>`,
  )}</g>`;
}

export function markersLayer(state: AppState, px: number): Layer {
  const failures = state.analysis.foldability?.failures ?? [];
  const focus = state.ui.focusPoint;
  return svg`<g class="markers">
    ${failures.map((f) => svg`<circle class=${f.kawasaki ? 'fail k' : 'fail m'} cx=${f.x} cy=${f.y} r=${7 * px}></circle>`)}
    ${focus ? svg`<circle class="focus" cx=${focus.x} cy=${focus.y} r=${14 * px}></circle>` : nothing}
  </g>`;
}

export function labelsLayer(state: AppState, px: number): Layer {
  const { design, analysis, ui } = state;
  const sel = ui.selection;
  const fs = 12 * px;
  const rootFlap = analysis.tree.nodes.find((n) => n.key === analysis.tree.rootKey)?.flapId;
  return svg`<g class="labels">
    ${repeat(design.flaps, (f) => f.id, (f) => {
      const selected = isSelected(sel, 'flap', f.id);
      const name = `${flapName(design, f.id)}  ${f.r}${f.w || f.h ? `  (${f.w} × ${f.h} tip)` : ''}`;
      const c = tipCenter(f);
      return svg`<g class=${selected ? 'tip selected' : 'tip'}>
        ${f.w || f.h ? svg`<rect class="tip-shape" x=${f.x} y=${f.y} width=${f.w} height=${f.h}></rect>` : nothing}
        <circle cx=${c.x} cy=${c.y} r=${(selected ? 5 : 4) * px}></circle>
        ${rootFlap === f.id ? svg`<circle class="root-ring" cx=${c.x} cy=${c.y} r=${8 * px}></circle>` : nothing}
        <text x=${f.x + f.w + 7 * px} y=${f.y - 7 * px} font-size=${fs}>${name}</text>
      </g>`;
    })}
    ${repeat(design.rivers, (r) => r.id, (r) => {
      const a = r.points[0]!;
      const b = r.points[1]!;
      return svg`<text class="river-label" x=${(a.x + b.x) / 2 + 6 * px} y=${(a.y + b.y) / 2 - 6 * px} font-size=${fs}>${riverName(design, r.id)}  ${r.width}</text>`;
    })}
  </g>`;
}

export function handlesLayer(state: AppState, px: number): Layer {
  const sel = state.ui.selection;
  const s = 9 * px;
  if (sel?.kind === 'flap') {
    const f = state.design.flaps.find((q) => q.id === sel.id);
    if (!f) return nothing;
    return svg`<g class="handles">${flapHandles(f).map(
      (h) => svg`<rect x=${h.x - s / 2} y=${h.y - s / 2} width=${s} height=${s}></rect>`,
    )}</g>`;
  }
  if (sel?.kind === 'river') {
    const r = state.design.rivers.find((q) => q.id === sel.id);
    if (!r || r.points.length < 2) return nothing;
    const h = riverHandles(r);
    return svg`<g class="handles">
      ${h.segments.map((m) => svg`<rect class="segment" x=${m.x - s / 2} y=${m.y - s / 2} width=${s} height=${s} rx=${s / 2}></rect>`)}
      ${h.ends.map((e) => svg`<rect x=${e.x - s / 2} y=${e.y - s / 2} width=${s} height=${s}></rect>`)}
      <g class="width-handle">
        <rect x=${h.width.x - s * 0.7} y=${h.width.y - s * 0.7} width=${s * 1.4} height=${s * 1.4} transform="rotate(45 ${h.width.x} ${h.width.y})"></rect>
      </g>
    </g>`;
  }
  return nothing;
}
