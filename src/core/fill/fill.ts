/**
 * Fill the paper: grow flaps until they meet, then draw rivers in the gaps
 * that are left between groups of flaps.
 *
 * 1. Grow. In rounds, every flap (shortest first) tries to grow by one unit.
 *    A step is kept only if the layout gets no worse: no new errors (path
 *    conditions only within groups already joined, see evaluate), no new
 *    warnings from the tree, no new circle-packed pairs and no new square
 *    overlaps (growth stays on the grid). Rounds repeat until no flap can grow, so flaps competing for
 *    the same space grow at the same rate, like a uniform scale-up.
 * 2. Rivers. Each implied river left in the tree (a gap between two groups,
 *    joined by the nearest pair of flaps) becomes a drawn river: a straight
 *    strip filling the gap between those two flaps' squares, extended along
 *    its length as far as it stays clear, ideally edge to edge. It is kept
 *    only if it really replaces the implied edge and the layout gets no worse.
 * 3. Grow again, in case a river ended short and freed space.
 *
 * Everything goes through the normal symmetry-aware operations, so mirror
 * partners grow together and rivers get their mirror images.
 */
import { rect, rectContact, squareAround, type Rect } from '../geometry/rect.ts';
import { addRiver, resizeFlap } from '../model/operations.ts';
import type { Design, Flap } from '../model/types.ts';
import { riverGeometry, type RiverGeometry } from '../tree/contacts.ts';
import { inferTree, type TreeResult } from '../tree/infer-tree.ts';
import { UnionFind } from '../util/union-find.ts';
import type { IssueRef } from '../validation/issues.ts';

export interface FillResult {
  readonly design: Design;
  /** Flaps whose length increased (mirror partners counted separately). */
  readonly grown: number;
  /** Rivers drawn (a river and its mirror image count as one). */
  readonly rivers: number;
}

interface Score {
  readonly errors: number;
  readonly warnings: number;
  readonly circlePairs: number;
  /** Flap squares overlapping other squares or rivers (allowed only as circles). */
  readonly squareOverlaps: number;
  readonly implicit: number;
}

function squareOverlaps(d: Design, rivers: readonly RiverGeometry[]): number {
  let count = 0;
  const squares = d.flaps.map((f) => squareAround(f, f.r));
  for (let i = 0; i < squares.length; i++) {
    for (let j = i + 1; j < squares.length; j++) if (rectContact(squares[i]!, squares[j]!).kind === 'overlap') count++;
    for (const g of rivers) if (g.segments.some((s) => rectContact(squares[i]!, s.rect).kind === 'overlap')) count++;
  }
  return count;
}

/**
 * How good a layout is. With `connectedOnly`, path-too-short errors and
 * circle pairs count only between flaps already joined by touching or drawn
 * rivers: groups that
 * are still apart are joined by implied rivers, whose star-shaped guess at
 * the tree overstates distances when three or more groups meet, and growing
 * apart groups only needs them not to overlap.
 */
function evaluate(d: Design, connectedOnly = false): { score: Score; tree: TreeResult } {
  const rivers = d.rivers.map(riverGeometry);
  const tree = inferTree(d, rivers);
  let errors = tree.issues.filter((i) => i.severity === 'error');
  let circlePairs = tree.tree.circlePairs;
  if (connectedOnly) {
    const groups = new UnionFind();
    for (const n of tree.tree.nodes) groups.add(n.key);
    for (const e of tree.tree.edges) if (e.kind !== 'implicit') groups.union(e.from, e.to);
    const joined = (a: string, b: string) => {
      const ha = tree.tree.hubOfFlap.get(a);
      const hb = tree.tree.hubOfFlap.get(b);
      return ha !== undefined && hb !== undefined && groups.find(ha) === groups.find(hb);
    };
    const flapId = (ref: IssueRef) => (ref.kind === 'flap' ? ref.id : '');
    errors = errors.filter((i) => i.code !== 'path-too-short' || joined(flapId(i.refs[0]!), flapId(i.refs[1]!)));
    circlePairs = circlePairs.filter((c) => joined(c.a, c.b));
  }
  return {
    tree,
    score: {
      errors: errors.length,
      warnings: tree.issues.filter((i) => i.severity === 'warning').length,
      circlePairs: circlePairs.length,
      squareOverlaps: squareOverlaps(d, rivers),
      implicit: tree.tree.edges.filter((e) => e.kind === 'implicit').length,
    },
  };
}

const noWorse = (next: Score, base: Score) =>
  next.errors <= base.errors &&
  next.warnings <= base.warnings &&
  next.circlePairs <= base.circlePairs &&
  next.squareOverlaps <= base.squareOverlaps;

export function fillPaper(design: Design): FillResult {
  const original = design;
  let d = grow(design);
  let rivers = 0;
  ({ design: d, rivers } = addGapRivers(d));
  if (rivers) d = grow(d);
  const before = new Map(original.flaps.map((f) => [f.id, f.r]));
  const grown = d.flaps.filter((f) => f.r > (before.get(f.id) ?? f.r)).length;
  return { design: grown || rivers ? d : original, grown, rivers };
}

/** Grow flaps one unit at a time, in fair rounds, while the layout stays as good. */
export function grow(design: Design): Design {
  let d = design;
  let base = evaluate(d, true).score;
  for (let changed = true; changed; ) {
    changed = false;
    const done = new Set<string>();
    const order = [...d.flaps].sort((a, b) => a.r - b.r);
    for (const f of order) {
      if (done.has(f.id)) continue;
      done.add(f.id);
      if (f.mirrorId) done.add(f.mirrorId); // grows with this one
      const current = d.flaps.find((q) => q.id === f.id)!;
      if (current.r >= d.gridSize) continue;
      const next = resizeFlap(d, f.id, current.r + 1);
      if (next === d) continue;
      const score = evaluate(next, true).score;
      if (!noWorse(score, base)) continue;
      d = next;
      base = score;
      changed = true;
    }
  }
  return d;
}

/** Replace implied rivers with drawn ones where a straight strip fits. */
export function addGapRivers(design: Design): { design: Design; rivers: number } {
  let d = design;
  let rivers = 0;
  const tried = new Set<string>();
  for (;;) {
    const { score, tree } = evaluate(d);
    const edge = tree.tree.edges.find((e) => e.kind === 'implicit' && !tried.has(e.id));
    if (!edge) break;
    tried.add(edge.id);
    if (!Number.isInteger(edge.length)) continue; // a circle-packed gap: no grid river fits
    const [, aId, bId] = edge.id.split(':');
    const a = d.flaps.find((f) => f.id === aId);
    const b = d.flaps.find((f) => f.id === bId);
    if (!a || !b) continue;
    for (const strip of gapStrips(d, a, b, edge.length)) {
      const res = addRiver(d, strip.points, edge.length);
      if (!res.id) continue;
      const next = evaluate(res.design).score;
      if (next.implicit < score.implicit && noWorse(next, score)) {
        d = res.design;
        rivers++;
        break;
      }
    }
  }
  return { design: d, rivers };
}

/**
 * Straight strips of width w filling the gap between two flaps' squares,
 * as river centerlines: vertical when the gap runs along x, horizontal when
 * along y (both when the tips are diagonal). Each strip covers both squares'
 * facing sides and is then extended along its length while it stays clear
 * of every flap square and river.
 */
function gapStrips(d: Design, a: Flap, b: Flap, w: number): Array<{ points: Array<{ x: number; y: number }> }> {
  const n = d.gridSize;
  const obstacles: Rect[] = [
    ...d.flaps.map((f) => squareAround(f, f.r)),
    ...d.rivers.flatMap((r) => riverGeometry(r).segments.map((s) => s.rect)),
  ];
  const clear = (r: Rect) => obstacles.every((o) => rectContact(r, o).kind !== 'overlap');
  const out: Array<{ points: Array<{ x: number; y: number }> }> = [];

  for (const axis of ['x', 'y'] as const) {
    const across = axis === 'x' ? 'y' : 'x';
    const [lo, hi] = a[axis] <= b[axis] ? [a, b] : [b, a];
    const b0 = lo[axis] + lo.r;
    const b1 = hi[axis] - hi.r;
    if (b1 - b0 !== w) continue; // the gap doesn't run along this axis
    // Along the strip: span both squares' facing sides if that is clear,
    // otherwise just the part where they face each other.
    const strip = (t0: number, t1: number) => (axis === 'x' ? rect(b0, t0, b1, t1) : rect(t0, b0, t1, b1));
    const seeds: Array<[number, number]> = [
      [Math.min(lo[across] - lo.r, hi[across] - hi.r), Math.max(lo[across] + lo.r, hi[across] + hi.r)],
      [Math.max(lo[across] - lo.r, hi[across] - hi.r), Math.min(lo[across] + lo.r, hi[across] + hi.r)],
    ];
    const seed = seeds
      .map(([t0, t1]): [number, number] => [Math.max(0, t0), Math.min(n, t1)])
      .find(([t0, t1]) => t1 > t0 && clear(strip(t0, t1)));
    if (!seed) continue;
    let [s0, s1] = seed;
    while (s0 > 0 && clear(strip(s0 - 1, s1))) s0--;
    while (s1 < n && clear(strip(s0, s1 + 1))) s1++;
    const c = (b0 + b1) / 2;
    out.push({
      points: axis === 'x' ? [{ x: c, y: s0 }, { x: c, y: s1 }] : [{ x: s0, y: c }, { x: s1, y: c }],
    });
  }
  return out;
}
