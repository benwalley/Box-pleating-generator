import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/core/analyze.ts';
import { fillPaper } from '../src/core/fill/fill.ts';
import { createDesign } from '../src/core/model/design.ts';
import { addFlap } from '../src/core/model/operations.ts';
import { PRESETS } from '../src/core/presets.ts';
import type { Design } from '../src/core/model/types.ts';

function layout(n: number, flaps: Array<[number, number]>, book = false): Design {
  let d = createDesign({ gridSize: n, symmetry: { book } });
  for (const [x, y] of flaps) {
    if (book && x > n / 2) continue; // the partner is added automatically
    d = addFlap(d, x, y, 1).design;
  }
  return d;
}

const errors = (d: Design) => analyze(d).issues.filter((i) => i.severity === 'error');

test('four corner flaps grow into a bird base', () => {
  const res = fillPaper(layout(16, [[0, 0], [16, 0], [0, 16], [16, 16]]));
  assert.deepEqual(res.design.flaps.map((f) => f.r), [8, 8, 8, 8]);
  assert.equal(res.rivers, 0);
  assert.equal(errors(res.design).length, 0);
});

test('two separated columns get a river in the gap', () => {
  const res = fillPaper(layout(16, [[0, 4], [0, 12], [16, 4], [16, 12]]));
  assert.deepEqual(res.design.flaps.map((f) => f.r), [4, 4, 4, 4]);
  assert.equal(res.rivers, 1);
  const river = res.design.rivers[0]!;
  assert.equal(river.width, 8);
  assert.deepEqual(river.points, [{ x: 8, y: 0 }, { x: 8, y: 16 }]); // edge to edge
  const a = analyze(res.design);
  assert.equal(a.issues.filter((i) => i.severity !== 'info').length, 0);
  assert.equal(a.tree.edges.filter((e) => e.kind === 'implicit').length, 0);
});

test('fill keeps book symmetry', () => {
  const res = fillPaper(layout(16, [[0, 0], [8, 0], [16, 0], [0, 16], [8, 16], [16, 16]], true));
  assert.ok(res.design.flaps.every((f) => f.r === 4));
  assert.equal(res.design.rivers.length, 1);
  assert.equal(res.design.rivers[0]!.mirrorId, res.design.rivers[0]!.id); // self-mirrored body river
  assert.equal(errors(res.design).length, 0);
  assert.ok(!analyze(res.design).issues.some((i) => i.code === 'asymmetric'));
});

test('growth stays on the grid: flaps stop where squares meet', () => {
  const res = fillPaper(layout(8, [[0, 0], [8, 0], [0, 8], [8, 8], [4, 4]]));
  assert.ok(res.design.flaps.every((f) => f.r === 2));
  assert.equal(analyze(res.design).tree.circlePairs.length, 0);
});

test('presets are already full', () => {
  for (const id of ['bird', 'river', 'lizard']) {
    const d = PRESETS.find((p) => p.id === id)!.build();
    const res = fillPaper(d);
    assert.equal(res.design, d, id);
  }
});
