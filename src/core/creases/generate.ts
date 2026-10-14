/**
 * Crease generation as an arrangement of candidate lines.
 *
 * Candidates are every line a crease could lie on: the interior grid lines
 * and cell diagonals (all a box-pleated pattern needs), plus, for each flap
 * with tangent sides (circle packing), the contours parallel to each tangent
 * side's normal, the tangent line itself, and the ridges from the tip
 * through the shape's new corners. Every line is split wherever it crosses
 * another, and each piece is classified by sampling the ownership field just
 * either side of it:
 * - Hinge: the two sides lie in different elements (flap shapes, rivers, or open paper).
 * - Axial: both sides want contours along this piece. Elevation is the
 *   distance from the owner's axis line; if the two sides disagree on parity
 *   the piece is a conflict.
 * - Ridge: the contour direction flips across the piece, and the piece
 *   bisects the two directions (contours reflect across it).
 * - Conflict: the direction flips any other way.
 * On a box-pleated design the pieces are exactly the unit grid segments and
 * half cell diagonals, so this reduces to sampling the grid.
 *
 * Mountain/valley follows Lang's parity rule: even elevation = mountain,
 * odd = valley; a ridge between elevations e and e+1 is a valley when e is
 * even. Hinges stay unassigned because they depend on how flaps are flattened.
 */
import { normalsByAngle, shapeCorner, support, supportCorner } from '../geometry/flap-shape.ts';
import { add, cross, dot, isInteger, normalize, perp, scale, sub, type Point } from '../geometry/point.ts';
import type { Design, Id } from '../model/types.ts';
import type { RiverGeometry } from '../tree/contacts.ts';
import { OwnershipField, elevationAt, parallel, type Owner } from './field.ts';
import { mergeCreases } from './merge.ts';
import type { Assignment, Crease, CreasePattern } from './types.ts';

const parityMV = (elevation: number): Assignment => (elevation % 2 === 0 ? 'M' : 'V');
/** How far either side of a unit grid segment the field is sampled. */
const OFFSET = 0.25;
/** Sampling distance next to off-grid pieces. */
const FINE = 1e-4;
const T_EPS = 1e-9;

const isAxisDir = (d: Point) => d.x === 0 || d.y === 0;
const isGridSegment = (p: Point, q: Point) =>
  Number.isInteger(p.x) && Number.isInteger(p.y) && Number.isInteger(q.x) && Number.isInteger(q.y) && Math.abs(q.x - p.x) + Math.abs(q.y - p.y) === 1;

export function generateCreases(
  design: Design,
  rivers: readonly RiverGeometry[],
  circleNormals: ReadonlyMap<Id, readonly Point[]> = new Map(),
): CreasePattern {
  const n = design.gridSize;
  const field = new OwnershipField(design.flaps, rivers, circleNormals);
  const pool = new PointPool();
  const lines = candidateLines(n, field);
  splitAtCrossings(lines, pool);

  const creases: Crease[] = [];
  const cellCache = new Map<string, Map<Diagonal, Crease> | null>();
  const ambiguous = new Set<string>();
  const markAmbiguous = (p: Point) => {
    const x = Math.floor(p.x);
    const y = Math.floor(p.y);
    if (x >= 0 && y >= 0 && x < n && y < n) ambiguous.add(`${x},${y}`);
  };

  const circleFlaps = new Set(field.flapShapes.filter((s) => s.normals.length > 4).map((s) => s.flap.id));
  for (const line of lines) {
    const normal = perp(line.d);
    for (let k = 0; k + 1 < line.splits.length; k++) {
      const p = line.splits[k]!.q;
      const q = line.splits[k + 1]!.q;
      const mid = scale(add(p, q), 0.5);
      // Side A is the upper side (or the left side of a vertical piece).
      const flip = normal.y > T_EPS || (Math.abs(normal.y) <= T_EPS && normal.x > 0);
      const sample = (eps: number) => {
        const sa = add(mid, scale(normal, flip ? -eps : eps));
        const sb = add(mid, scale(normal, flip ? eps : -eps));
        return { sa, sb, a: field.ownerAt(sa.x, sa.y), b: field.ownerAt(sb.x, sb.y) };
      };
      // Unit grid segments are sampled a quarter unit away, clear of
      // half-unit ties. Off-grid wedges near a tip can be much narrower than
      // that, so other pieces, and grid segments next to a tangent side, are
      // sampled right next to the piece.
      const gridSegment = isGridSegment(p, q);
      let s = sample(gridSegment ? OFFSET : FINE);
      if (gridSegment && [s.a, s.b].some((o) => o && circleFlaps.has(o.flap.id))) {
        const fine = sample(FINE);
        if ([s.a, s.b, fine.a, fine.b].some((o) => o && !isAxisDir(o.dir))) s = fine;
      }
      const { sa, sb, a, b } = s;
      if (!a || !b) continue;
      // The inside of a rectangular tip is the flat top of the box: no creases.
      if (field.elementAt(mid.x, mid.y)?.startsWith('t:')) continue;
      if (a.ambiguous) markAmbiguous(sa);
      if (b.ambiguous) markAmbiguous(sb);
      const cell = halfDiagonalCell(p, q);
      let ridges: Map<Diagonal, Crease> | null = null;
      if (cell) {
        const key = `${cell.x},${cell.y}`;
        if (!cellCache.has(key)) cellCache.set(key, cellRidges(field, cell.x, cell.y));
        ridges = cellCache.get(key)!;
      }
      const crease = ridges
        ? ridges.get(line.d.x * line.d.y > 0 ? '\\' : '/')
        : classify(p, q, line.d, a, b, field.elementAt(sa.x, sa.y), field.elementAt(sb.x, sb.y));
      if (crease) creases.push({ ...crease, x1: p.x, y1: p.y, x2: q.x, y2: q.y });
    }
  }

  balanceInteriorTips(design, creases);

  return {
    creases,
    lines: mergeCreases(creases),
    ambiguousCells: [...ambiguous].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x!, y: y! };
    }),
  };
}

/**
 * A piece running from a cell corner to the cell centre: half of one of the
 * cell's diagonals. Returns the cell, or null for any other piece.
 */
function halfDiagonalCell(p: Point, q: Point): { x: number; y: number } | null {
  const [c, h] = Number.isInteger(p.x) && Number.isInteger(p.y) ? [p, q] : [q, p];
  if (!Number.isInteger(c.x) || !Number.isInteger(c.y)) return null;
  if (Math.abs(Math.abs(h.x - c.x) - 0.5) > T_EPS || Math.abs(Math.abs(h.y - c.y) - 0.5) > T_EPS) return null;
  return { x: Math.floor(h.x), y: Math.floor(h.y) };
}

type Diagonal = '\\' | '/';

/**
 * On-grid cells decide ridges for the whole cell at once, from four samples
 * near the middle of its edges (north, east, south, west): if the contour
 * direction flips across one diagonal (north = east != south = west, or
 * north = west != south = east), that diagonal is a ridge, with the lower
 * elevation of its two ends. Returns the ridge per diagonal, or null when the
 * cell is off the grid (some owner there has a tangent side), in which case
 * its pieces are classified one by one.
 */
function cellRidges(field: OwnershipField, x: number, y: number): Map<Diagonal, Crease> | null {
  const out = new Map<Diagonal, Crease>();
  const north = field.ownerAt(x + 0.5, y + 0.2);
  const east = field.ownerAt(x + 0.8, y + 0.5);
  const south = field.ownerAt(x + 0.5, y + 0.8);
  const west = field.ownerAt(x + 0.2, y + 0.5);
  if (!north || !east || !south || !west) return out;
  if (![north, east, south, west].every((o) => isAxisDir(o.dir))) return null;
  const h = (o: Owner) => o.dir.y === 0;
  let d: [number, number, number, number] | null = null;
  if (h(north) === h(east) && h(south) === h(west) && h(north) !== h(south)) d = [x, y, x + 1, y + 1];
  else if (h(north) === h(west) && h(south) === h(east) && h(north) !== h(south)) d = [x + 1, y, x, y + 1];
  if (!d) return out;
  // The lower of the elevations under the two directions that meet here.
  const elev = (px: number, py: number) => elevationAt(north, { x: px, y: py });
  const e = Math.min(elev(d[0], d[1]), elev(d[2], d[3]));
  out.set(d[0] === x ? '\\' : '/', { x1: d[0], y1: d[1], x2: d[2], y2: d[3], kind: 'ridge', mv: e % 2 === 0 ? 'V' : 'M', elevation: e });
  return out;
}

function classify(p: Point, q: Point, d: Point, a: Owner, b: Owner, elementA: string | null, elementB: string | null): Crease | null {
  const seg = { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
  if (elementA !== elementB) return { ...seg, kind: 'hinge', mv: 'U' };
  if (parallel(a.dir, b.dir)) {
    const mid = scale(add(p, q), 0.5);
    // A segment tip: the two opposite sides of one flap meet along the tip
    // itself, where the paper folds over. Contours cross it, so like any
    // ridge it alternates valley and mountain with elevation.
    if (a.flap === b.flap && dot(a.dir, b.dir) < 0 && !parallel(d, a.dir)) {
      const e = Math.floor(Math.min(elevationAt(a, p), elevationAt(a, q)) + 1e-6);
      return { ...seg, kind: 'ridge', mv: e % 2 === 0 ? 'V' : 'M', elevation: e };
    }
    if (!parallel(d, a.dir)) return null;
    const ea = elevationAt(a, mid);
    const eb = elevationAt(b, mid);
    const ia = isInteger(ea, 1e-6);
    const ib = isInteger(eb, 1e-6);
    if (!ia && !ib) return null; // not on a contour of either owner
    if (ia !== ib || Math.round(ea) % 2 !== Math.round(eb) % 2) return { ...seg, kind: 'conflict', mv: 'U' };
    const e = Math.round(ea);
    return { ...seg, kind: 'axial', mv: parityMV(e), elevation: e };
  }
  // The direction flips across this piece. It is a ridge if contours reflect
  // across it: the reflection of one direction in the piece is the other.
  const reflected = sub(scale(d, 2 * dot(a.dir, d)), a.dir);
  if (!parallel(reflected, b.dir)) return { ...seg, kind: 'conflict', mv: 'U' };
  const elev = (pt: Point) => elevationAt(a, pt);
  const e = Math.floor(Math.min(elev(p), elev(q)) + 1e-6);
  return { ...seg, kind: 'ridge', mv: e % 2 === 0 ? 'V' : 'M', elevation: e };
}

interface Line {
  /** The point of the line nearest the origin, and its unit direction. */
  readonly p: Point;
  readonly d: Point;
  /** The part of the line in play, as distances along d from p. */
  t0: number;
  t1: number;
  /** Bounding box of that part, for skipping pairs that can't cross. */
  box: { x0: number; y0: number; x1: number; y1: number };
  /** Split points along the line, sorted by t once splitAtCrossings has run. */
  splits: Array<{ t: number; q: Point }>;
}

/** A half-plane (p - o) . m >= 0. */
type HalfPlane = { readonly o: Point; readonly m: Point };

function candidateLines(n: number, field: OwnershipField): Line[] {
  const lines = new Map<string, Line>();
  const addLine = (through: Point, dir: Point, clip: readonly HalfPlane[] = []) => {
    let d = normalize(dir);
    if (d.x < -T_EPS || (Math.abs(d.x) <= T_EPS && d.y < 0)) d = scale(d, -1);
    const p = sub(through, scale(d, dot(through, d)));
    const range = clipLine(p, d, n, clip);
    if (!range) return;
    const key = `${Math.round(d.x * 1e7)},${Math.round(d.y * 1e7)},${Math.round(cross(d, p) * 1e7)}`;
    const same = lines.get(key);
    if (same) {
      // The same line from another flap: cover both parts.
      same.t0 = Math.min(same.t0, range[0]);
      same.t1 = Math.max(same.t1, range[1]);
      same.box = boxOf(p, d, same.t0, same.t1);
      return;
    }
    lines.set(key, { p, d, t0: range[0], t1: range[1], box: boxOf(p, d, range[0], range[1]), splits: [] });
  };

  for (let i = 1; i < n; i++) {
    addLine({ x: 0, y: i }, { x: 1, y: 0 });
    addLine({ x: i, y: 0 }, { x: 0, y: 1 });
  }
  for (let c = -(n - 1); c <= n - 1; c++) addLine({ x: c, y: 0 }, { x: 1, y: 1 }); // x - y = c
  for (let c = 1; c <= 2 * n - 1; c++) addLine({ x: c, y: 0 }, { x: 1, y: -1 }); // x + y = c

  // Off-grid lines for flaps with tangent sides.
  const reach = Math.ceil(n * Math.SQRT2) + 1;
  for (const { flap, normals, tip } of field.flapShapes) {
    if (normals.length <= 4) continue;
    const sorted = normalsByAngle(normals);
    const extra = normals.slice(4);
    for (let i = 0; i < sorted.length; i++) {
      const u = sorted[i]!;
      const prev = sorted[(i + sorted.length - 1) % sorted.length]!;
      const next = sorted[(i + 1) % sorted.length]!;
      if (extra.includes(u)) {
        // Contours parallel to u, only inside the wedge where this side is
        // nearest (between the ridges to its two corners).
        const wedge = [prev, next].map((v) => {
          const ridge = add(u, v);
          let m = perp(ridge);
          if (dot(m, u) < 0) m = scale(m, -1);
          return { o: shapeCorner(flap, flap.r, u, v), m };
        });
        // Contours sit at integer distances from the line through the supporting corner.
        const across = perp(u);
        const { corner } = supportCorner(tip, u);
        for (let k = -reach; k <= reach; k++) addLine(add(corner, scale(across, k)), u, wedge);
        addLine(scale(u, support(tip, u) + flap.r), across); // the tangent side (a hinge)
      }
      // The ridge through a new corner, from the tip.
      if (extra.includes(u) || extra.includes(next)) addLine(shapeCorner(flap, flap.r, u, next), add(u, next));
    }
  }
  return [...lines.values()];
}

function boxOf(p: Point, d: Point, t0: number, t1: number) {
  const ax = p.x + t0 * d.x, ay = p.y + t0 * d.y, bx = p.x + t1 * d.x, by = p.y + t1 * d.y;
  return { x0: Math.min(ax, bx), y0: Math.min(ay, by), x1: Math.max(ax, bx), y1: Math.max(ay, by) };
}

/** Parameter range of the line p + t d inside the paper and the half-planes, or null if empty. */
function clipLine(p: Point, d: Point, n: number, clip: readonly HalfPlane[]): [number, number] | null {
  let t0 = -Infinity;
  let t1 = Infinity;
  const constrain = (offset: number, rate: number) => {
    // offset + t * rate >= 0
    if (Math.abs(rate) <= T_EPS) {
      if (offset < -T_EPS) t1 = -Infinity;
    } else if (rate > 0) t0 = Math.max(t0, -offset / rate);
    else t1 = Math.min(t1, -offset / rate);
  };
  constrain(p.x, d.x);
  constrain(n - p.x, -d.x);
  constrain(p.y, d.y);
  constrain(n - p.y, -d.y);
  for (const h of clip) constrain(dot(sub(p, h.o), h.m), dot(d, h.m));
  return t1 - t0 > 1e-7 ? [t0, t1] : null;
}

function splitAtCrossings(lines: Line[], pool: PointPool): void {
  const at = (l: Line, t: number) => pool.get(l.p.x + t * l.d.x, l.p.y + t * l.d.y);
  for (const l of lines) l.splits.push({ t: l.t0, q: at(l, l.t0) }, { t: l.t1, q: at(l, l.t1) });
  for (let i = 0; i < lines.length; i++) {
    const li = lines[i]!;
    const bi = li.box;
    for (let j = i + 1; j < lines.length; j++) {
      const lj = lines[j]!;
      const bj = lj.box;
      if (bj.x0 > bi.x1 + T_EPS || bj.x1 < bi.x0 - T_EPS || bj.y0 > bi.y1 + T_EPS || bj.y1 < bi.y0 - T_EPS) continue;
      const denom = li.d.x * lj.d.y - li.d.y * lj.d.x;
      if (Math.abs(denom) < 1e-12) continue;
      const wx = lj.p.x - li.p.x;
      const wy = lj.p.y - li.p.y;
      const ti = (wx * lj.d.y - wy * lj.d.x) / denom;
      if (ti < li.t0 - T_EPS || ti > li.t1 + T_EPS) continue;
      const tj = (wx * li.d.y - wy * li.d.x) / denom;
      if (tj < lj.t0 - T_EPS || tj > lj.t1 + T_EPS) continue;
      const q = at(li, ti);
      li.splits.push({ t: (q.x - li.p.x) * li.d.x + (q.y - li.p.y) * li.d.y, q });
      lj.splits.push({ t: (q.x - lj.p.x) * lj.d.x + (q.y - lj.p.y) * lj.d.y, q });
    }
  }
  for (const l of lines) {
    l.splits.sort((a, b) => a.t - b.t);
    l.splits = l.splits.filter((s, k, all) => k === 0 || s.q !== all[k - 1]!.q);
  }
}

/**
 * Canonical points, so that creases meeting at a vertex share exactly the
 * same coordinates even when the vertex was computed from different line
 * pairs. Coordinates within a hair of a multiple of 1/2 (grid points and
 * cell centres) snap to it.
 */
const snapHalf = (v: number, tol: number) => (Math.abs(2 * v - Math.round(2 * v)) < 2 * tol ? Math.round(2 * v) / 2 : v);

class PointPool {
  private static readonly CELL = 1e-5;
  private static readonly TOL = 1e-7;
  /** Points on the half-unit lattice, by exact key. */
  private readonly lattice = new Map<number, Point>();
  /** Other points, bucketed by CELL. */
  private readonly buckets = new Map<number, Point[]>();

  get(x: number, y: number): Point {
    const sx = snapHalf(x, PointPool.TOL);
    const sy = snapHalf(y, PointPool.TOL);
    if (Number.isInteger(2 * sx) && Number.isInteger(2 * sy)) {
      const key = (2 * sx + 2) * 65536 + (2 * sy + 2);
      let p = this.lattice.get(key);
      if (!p) {
        p = { x: sx, y: sy };
        this.lattice.set(key, p);
      }
      return p;
    }
    const kx = Math.round(sx / PointPool.CELL);
    const ky = Math.round(sy / PointPool.CELL);
    const keyOf = (i: number, j: number) => (i + 2) * 67108864 + (j + 2);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const p of this.buckets.get(keyOf(kx + dx, ky + dy)) ?? []) {
          if (Math.abs(p.x - sx) < PointPool.TOL && Math.abs(p.y - sy) < PointPool.TOL) return p;
        }
      }
    }
    const p = { x: sx, y: sy };
    const key = keyOf(kx, ky);
    const bucket = this.buckets.get(key);
    if (bucket) bucket.push(p);
    else this.buckets.set(key, [p]);
    return p;
  }
}

/**
 * At an interior flap tip, valley ridges and mountain axial rays alternate
 * in equal numbers (M = V), which breaks Maekawa's |M - V| = 2. Turning one
 * axial ray from the tip into a valley fixes it: the one running right, or
 * if there is none (the left end of a horizontal segment tip), the first of
 * down, left, up. A segment tip has this vertex at both ends. A tip with
 * both width and height has hinges at its corners, so it is left alone.
 */
function balanceInteriorTips(design: Design, creases: Crease[]): void {
  const n = design.gridSize;
  const rays = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }];
  for (const f of design.flaps) {
    if (f.w > 0 && f.h > 0) continue;
    const vertices = [{ x: f.x, y: f.y }];
    if (f.w > 0 || f.h > 0) vertices.push({ x: f.x + f.w, y: f.y + f.h });
    for (const v of vertices) {
      if (v.x <= 0 || v.y <= 0 || v.x >= n || v.y >= n) continue;
      for (const dir of rays) {
        // Axial creases at elevation 0 on the ray from v along dir, within r.
        const on = (x: number, y: number) => {
          const t = (x - v.x) * dir.x + (y - v.y) * dir.y;
          return Math.abs(cross(dir, { x: x - v.x, y: y - v.y })) < 1e-9 && t >= -1e-9 && t <= f.r + 1e-9;
        };
        const hits = creases.flatMap((c, i) => (c.kind === 'axial' && c.elevation === 0 && on(c.x1, c.y1) && on(c.x2, c.y2) ? [i] : []));
        if (!hits.length) continue;
        for (const i of hits) creases[i] = { ...creases[i]!, mv: 'V' };
        break;
      }
    }
  }
}
