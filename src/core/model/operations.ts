/**
 * Pure, symmetry-aware edits on a Design. Each function returns a new Design
 * (or the same object when nothing changed). UI code never mutates designs
 * directly; it calls these through the EditorController.
 */
import { clamp, EPS, type Point } from '../geometry/point.ts';
import {
  isOrthogonalPolyline,
  mirrorIndex,
  mirrorPolyline,
  offsetPolyline,
  polylineBounds,
  translatePolyline,
} from '../geometry/polyline.ts';
import { isSelfMirror, linkMirrors, makeSymmetric as makeSymmetricDesign, mirrorsInPlace } from '../symmetry/book.ts';
import { normalizeDesign, normalizeFlap, normalizeRiver, symmetryAxis, MAX_GRID, MIN_GRID } from './design.ts';
import { createId } from './ids.ts';
import type { PortKey } from './ports.ts';
import type { Design, ElementRef, Flap, Id, River } from './types.ts';

export interface AddResult {
  readonly design: Design;
  readonly id: Id | null;
}

// ---------------------------------------------------------------- helpers

const replaceFlaps = (d: Design, updates: ReadonlyMap<Id, Flap>): Design =>
  updates.size ? { ...d, flaps: d.flaps.map((f) => updates.get(f.id) ?? f) } : d;

const replaceRivers = (d: Design, updates: ReadonlyMap<Id, River>): Design =>
  updates.size ? { ...d, rivers: d.rivers.map((r) => updates.get(r.id) ?? r) } : d;

function partnerOf<T extends Flap | River>(items: readonly T[], e: T): T | null {
  if (!e.mirrorId || e.mirrorId === e.id) return null;
  return items.find((x) => x.id === e.mirrorId) ?? null;
}

const pointsInPaper = (points: readonly Point[], n: number): boolean =>
  points.every((p) => p.x >= -EPS && p.y >= -EPS && p.x <= n + EPS && p.y <= n + EPS);

/** Apply a new centerline to a river and keep its mirror partner in sync. */
function withRiverPoints(d: Design, river: River, points: Point[], width = river.width): Design {
  const updates = new Map<Id, River>([[river.id, { ...river, points, width }]]);
  const partner = d.symmetry.book ? partnerOf(d.rivers, river) : null;
  if (partner) {
    updates.set(partner.id, {
      ...partner,
      width,
      points: mirrorPolyline(points, symmetryAxis(d)),
    });
  }
  return replaceRivers(d, updates);
}

// ---------------------------------------------------------------- flaps

export function addFlap(d: Design, x: number, y: number, r = 1, label = ''): AddResult {
  const id = createId('f');
  const flap = normalizeFlap({ id, x, y, r, label, mirrorId: null }, d.gridSize);
  if (!d.symmetry.book) return { design: { ...d, flaps: [...d.flaps, flap] }, id };
  const axis = symmetryAxis(d);
  if (Math.abs(flap.x - axis) <= EPS) {
    return { design: { ...d, flaps: [...d.flaps, { ...flap, mirrorId: id }] }, id };
  }
  const partnerId = createId('f');
  const partner: Flap = { ...flap, id: partnerId, label: '', x: d.gridSize - flap.x, mirrorId: id };
  return { design: { ...d, flaps: [...d.flaps, { ...flap, mirrorId: partnerId }, partner] }, id };
}

export function moveFlap(d: Design, id: Id, x: number, y: number): Design {
  const f = d.flaps.find((q) => q.id === id);
  if (!f) return d;
  const n = d.gridSize;
  let nx = clamp(Math.round(x), 0, n);
  const ny = clamp(Math.round(y), 0, n);
  if (d.symmetry.book && isSelfMirror(f)) nx = f.x; // stays on the axis
  if (nx === f.x && ny === f.y) return d;
  const updates = new Map<Id, Flap>([[id, { ...f, x: nx, y: ny }]]);
  const partner = d.symmetry.book ? partnerOf(d.flaps, f) : null;
  if (partner) updates.set(partner.id, { ...partner, x: n - nx, y: ny });
  return replaceFlaps(d, updates);
}

export function resizeFlap(d: Design, id: Id, r: number): Design {
  const f = d.flaps.find((q) => q.id === id);
  if (!f) return d;
  const nr = clamp(Math.round(r), 1, d.gridSize);
  if (nr === f.r) return d;
  const updates = new Map<Id, Flap>([[id, { ...f, r: nr }]]);
  const partner = d.symmetry.book ? partnerOf(d.flaps, f) : null;
  if (partner) updates.set(partner.id, { ...partner, r: nr });
  return replaceFlaps(d, updates);
}

export function setFlapLabel(d: Design, id: Id, label: string): Design {
  const f = d.flaps.find((q) => q.id === id);
  if (!f || f.label === label) return d;
  return replaceFlaps(d, new Map([[id, { ...f, label }]]));
}

// ---------------------------------------------------------------- rivers

export function addRiver(d: Design, points: readonly Point[], width: number, label = ''): AddResult {
  const id = createId('r');
  const river = normalizeRiver({ id, points, width, label, mirrorId: null }, d.gridSize);
  if (!river) return { design: d, id: null };
  if (!d.symmetry.book) return { design: { ...d, rivers: [...d.rivers, river] }, id };
  const mirrored = mirrorPolyline(river.points, symmetryAxis(d));
  const self = { ...river, mirrorId: id };
  const selfSymmetric = linkMirrors({ ...d, rivers: [self] }).rivers[0]!.mirrorId === id;
  if (selfSymmetric) return { design: { ...d, rivers: [...d.rivers, self] }, id };
  const partnerId = createId('r');
  const partner: River = { ...river, id: partnerId, label: '', points: mirrored, mirrorId: id };
  return { design: { ...d, rivers: [...d.rivers, { ...river, mirrorId: partnerId }, partner] }, id };
}

export function translateRiver(d: Design, id: Id, dx: number, dy: number): Design {
  const r = d.rivers.find((q) => q.id === id);
  if (!r) return d;
  const b = polylineBounds(r.points);
  let tx = clamp(Math.round(dx), -b.x0, d.gridSize - b.x1);
  const ty = clamp(Math.round(dy), -b.y0, d.gridSize - b.y1);
  if (d.symmetry.book && isSelfMirror(r)) tx = 0;
  if (tx === 0 && ty === 0) return d;
  return withRiverPoints(d, r, translatePolyline(r.points, tx, ty));
}

/**
 * Move some centerline vertices by an integer delta. Used for dragging a
 * segment sideways (both of its vertices) or an end point along its segment.
 * Rejected (returns d unchanged) if the result would not be orthogonal or
 * would leave the paper. A self-symmetric river moves its mirrored vertices too.
 */
export function moveRiverVertices(d: Design, id: Id, indices: readonly number[], dx: number, dy: number): Design {
  const r = d.rivers.find((q) => q.id === id);
  if (!r) return d;
  const axis = symmetryAxis(d);
  const deltas = new Map<number, Point>();
  let tx = Math.round(dx);
  const ty = Math.round(dy);
  const selfSym = d.symmetry.book && isSelfMirror(r);
  if (selfSym && indices.some((i) => mirrorIndex(r.points, i, axis) === i)) tx = 0;
  for (const i of indices) {
    deltas.set(i, { x: tx, y: ty });
    if (selfSym) {
      const j = mirrorIndex(r.points, i, axis);
      if (j >= 0 && j !== i) deltas.set(j, { x: -tx, y: ty });
    }
  }
  const points = r.points.map((p, i) => {
    const m = deltas.get(i);
    return m ? { x: p.x + m.x, y: p.y + m.y } : p;
  });
  if (!isOrthogonalPolyline(points) || !pointsInPaper(points, d.gridSize)) return d;
  return withRiverPoints(d, r, points);
}

/**
 * Change a river's width. Bank "a" stays put and bank "b" moves, except for a
 * river lying along the symmetry axis, which grows evenly from its centre in
 * steps that keep both banks on the grid.
 */
export function setRiverWidth(d: Design, id: Id, width: number): Design {
  const r = d.rivers.find((q) => q.id === id);
  if (!r) return d;
  let w = clamp(Math.round(width), 1, d.gridSize);
  if (w === r.width) return d;
  let points: Point[];
  if (d.symmetry.book && isSelfMirror(r) && mirrorsInPlace(r.points, d.gridSize)) {
    if ((w - r.width) % 2 !== 0) w += Math.sign(w - r.width);
    w = clamp(w, 1, d.gridSize);
    if (w === r.width || (w - r.width) % 2 !== 0) return d;
    points = [...r.points];
  } else {
    points = offsetPolyline(r.points, (r.width - w) / 2);
  }
  const normalized = normalizeRiver({ ...r, points, width: w }, d.gridSize);
  if (!normalized) return d;
  return withRiverPoints(d, r, [...normalized.points], w);
}

/** Tidy a river after a drag: merge collinear points, re-snap. */
export function normalizeRiverById(d: Design, id: Id): Design {
  const r = d.rivers.find((q) => q.id === id);
  if (!r) return d;
  const n = normalizeRiver(r, d.gridSize);
  if (!n) return deleteElements(d, [{ kind: 'river', id }]);
  return withRiverPoints(d, r, [...n.points], n.width);
}

export function setRiverLabel(d: Design, id: Id, label: string): Design {
  const r = d.rivers.find((q) => q.id === id);
  if (!r || r.label === label) return d;
  return replaceRivers(d, new Map([[id, { ...r, label }]]));
}

// ---------------------------------------------------------------- shared

/** Delete elements; with book symmetry on, their mirror partners go too. */
export function deleteElements(d: Design, refs: readonly ElementRef[]): Design {
  const ids = new Set(refs.map((r) => r.id));
  if (d.symmetry.book) {
    for (const e of [...d.flaps, ...d.rivers]) if (ids.has(e.id) && e.mirrorId) ids.add(e.mirrorId);
  }
  if (!ids.size) return d;
  return normalizeDesign({
    ...d,
    flaps: d.flaps.filter((f) => !ids.has(f.id)),
    rivers: d.rivers.filter((r) => !ids.has(r.id)),
  });
}

export function setGridSize(d: Design, size: number): Design {
  const gridSize = clamp(Math.round(size), MIN_GRID, MAX_GRID);
  if (gridSize === d.gridSize) return d;
  return linkMirrors(normalizeDesign({ ...d, gridSize }));
}

export function setBookSymmetry(d: Design, on: boolean): Design {
  if (d.symmetry.book === on) return d;
  return linkMirrors({ ...d, symmetry: { ...d.symmetry, book: on } });
}

export const makeSymmetric = (d: Design): Design => makeSymmetricDesign(d);

export function setName(d: Design, name: string): Design {
  return name === d.name ? d : { ...d, name };
}

/**
 * Label an internal tree node. The label is stored on the node's first port
 * and cleared from its other ports so merged nodes never carry two labels.
 */
export function setNodeLabel(d: Design, ports: readonly PortKey[], label: string): Design {
  if (!ports.length) return d;
  const nodeLabels = { ...d.nodeLabels };
  for (const p of ports) delete nodeLabels[p];
  if (label.trim()) nodeLabels[ports[0]!] = label.trim();
  return { ...d, nodeLabels };
}

export function setRootPort(d: Design, port: PortKey | null): Design {
  return port === d.rootPort ? d : { ...d, rootPort: port };
}
