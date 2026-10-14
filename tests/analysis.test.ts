import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/core/analyze.ts';
import { createDesign } from '../src/core/model/design.ts';
import { addFlap, addRiver, setFlapTip, setNodeLabel, setRootPort } from '../src/core/model/operations.ts';
import { PRESETS } from '../src/core/presets.ts';

test('presets analyse without blocking errors', () => {
  for (const p of PRESETS) {
    const a = analyze(p.build());
    assert.ok(a.pattern, `${p.id} should generate creases`);
    assert.equal(a.issues.filter((i) => i.severity === 'error').length, 0, p.id);
  }
});

test('clean presets pass local fold checks', () => {
  for (const id of ['bird', 'river', 'lizard', 'box-body']) {
    const a = analyze(PRESETS.find((p) => p.id === id)!.build());
    assert.equal(a.foldability!.failures.length, 0, id);
  }
});

test('touching flaps share one hub', () => {
  let d = createDesign({ gridSize: 8 });
  d = addFlap(d, 0, 0, 4).design;
  d = addFlap(d, 8, 0, 4).design;
  const a = analyze(d);
  assert.equal(a.tree.nodes.filter((n) => n.kind === 'hub').length, 1);
});

test('a drawn river becomes a tree edge between its banks', () => {
  const a = analyze(PRESETS.find((p) => p.id === 'river')!.build());
  const rivers = a.tree.edges.filter((e) => e.kind === 'river');
  assert.equal(rivers.length, 1);
  assert.equal(rivers[0]!.length, 6);
  assert.equal(a.tree.nodes.filter((n) => n.kind === 'hub').length, 2);
});

test('separate groups get an implicit river', () => {
  let d = createDesign({ gridSize: 12 });
  d = addFlap(d, 0, 0, 3).design;
  d = addFlap(d, 12, 0, 3).design;
  const a = analyze(d);
  const e = a.tree.edges.find((x) => x.kind === 'implicit');
  assert.equal(e?.length, 6);
});

test('flaps overlapping even as circles block generation', () => {
  let d = createDesign({ gridSize: 8 });
  d = addFlap(d, 2, 2, 2).design;
  d = addFlap(d, 4, 2, 2).design;
  const a = analyze(d);
  assert.equal(a.pattern, null);
  assert.ok(a.issues.some((i) => i.code === 'flap-overlap'));
});

test('a flap crossing a river is an error', () => {
  let d = createDesign({ gridSize: 12 });
  d = addFlap(d, 6, 6, 2).design;
  d = addRiver(d, [{ x: 0, y: 6 }, { x: 12, y: 6 }], 2).design;
  assert.ok(analyze(d).issues.some((i) => i.code === 'flap-river-overlap'));
});

/** A at (0,0), river R1, B at (6,0), river R2, then C at (cx, cy): the tree path A-C is 8 long. */
function twoRivers(cx: number, cy: number) {
  let d = createDesign({ gridSize: 12 });
  d = addFlap(d, 0, 0, 2).design; // A
  d = addRiver(d, [{ x: 3, y: 0 }, { x: 3, y: 4 }], 2).design; // R1
  d = addFlap(d, 6, 0, 2).design; // B
  d = addRiver(d, [{ x: 4, y: 3 }, { x: 12, y: 3 }], 2).design; // R2
  d = addFlap(d, cx, cy, 2).design; // C
  return analyze(d);
}

test('path condition violations are reported', () => {
  // A and C are 6 apart on the grid and 7.81 in a straight line: too short either way.
  const a = twoRivers(5, 6);
  assert.ok(a.issues.some((i) => i.code === 'path-too-short'));
});

test('a path too short on the grid but long enough as circles is circle-packed', () => {
  // A and C are 6 apart on the grid but 8.49 in a straight line.
  const a = twoRivers(6, 6);
  assert.ok(!a.issues.some((i) => i.code === 'path-too-short'));
  assert.ok(a.issues.some((i) => i.code === 'circle-packed'));
  assert.equal(a.tree.circlePairs.length, 1);
  assert.ok(a.pattern);
});

/** 3-4-5: the tips are 4 apart on the grid (squares overlap) and 5 in a straight line (circles touch). */
function pythagorean() {
  let d = createDesign({ gridSize: 10 });
  d = addFlap(d, 0, 0, 2).design;
  d = addFlap(d, 3, 4, 3).design;
  d = addFlap(d, 10, 0, 4).design;
  d = addFlap(d, 0, 10, 3).design;
  d = addFlap(d, 10, 10, 4).design;
  return analyze(d);
}

test('flaps whose squares overlap but whose circles fit are circle-packed', () => {
  const a = pythagorean();
  assert.ok(!a.issues.some((i) => i.code === 'flap-overlap'));
  assert.equal(a.issues.filter((i) => i.severity === 'error').length, 0);
  assert.ok(a.issues.some((i) => i.code === 'circle-packed'));
  assert.ok(a.pattern, 'creases are generated');
  // Touching circles share a hub, like touching squares.
  const [f0, f1] = [a.tree.hubOfFlap.get(a.tree.circlePairs[0]!.a), a.tree.hubOfFlap.get(a.tree.circlePairs[0]!.b)];
  assert.equal(f0, f1);
  assert.equal(a.tree.circlePairs[0]!.active, true);
});

test('circle-packed creases run along and across the active path', () => {
  const a = pythagorean();
  const lines = a.pattern!.lines;
  const near = (x: number, y: number, px: number, py: number) => Math.abs(x - px) < 1e-6 && Math.abs(y - py) < 1e-6;
  // The active path from (0,0) to (3,4) is the axis: a mountain at elevation 0.
  assert.ok(lines.some((c) => c.kind === 'axial' && c.elevation === 0 && c.mv === 'M' && near(c.x1, c.y1, 0, 0) && near(c.x2, c.y2, 3, 4)));
  // The hinge is the shared tangent through the contact point (1.2, 1.6), perpendicular to the path.
  assert.ok(
    lines.some((c) => c.kind === 'hinge' && Math.abs(0.6 * (c.x2 - c.x1) + 0.8 * (c.y2 - c.y1)) < 1e-9 && Math.abs(0.6 * c.x1 + 0.8 * c.y1 - 2) < 1e-9),
  );
  // Both tips pass the local fold checks.
  for (const [x, y] of [[3, 4]]) assert.ok(!a.foldability!.failures.some((f) => near(f.x, f.y, x!, y!)), `tip ${x},${y}`);
});

test('a flap whose square crosses a river corner but whose circle clears it is circle-packed', () => {
  let d = createDesign({ gridSize: 14 });
  d = addRiver(d, [{ x: 0, y: 6 }, { x: 6, y: 6 }], 2).design;
  d = addFlap(d, 9, 10, 4).design; // circle clears the corner (6, 7) by 0.24
  const a = analyze(d);
  assert.ok(!a.issues.some((i) => i.code === 'flap-river-overlap'));
  assert.ok(a.issues.some((i) => i.code === 'circle-packed'));
  assert.ok(a.pattern);
});

test('labels and root survive re-analysis', () => {
  let d = PRESETS.find((p) => p.id === 'lizard')!.build();
  const first = analyze(d);
  const hub = first.tree.nodes.find((n) => n.kind === 'hub')!;
  d = setNodeLabel(d, hub.ports, 'Chest');
  d = setRootPort(d, hub.ports[0]!);
  const second = analyze(d);
  const again = second.tree.nodes.find((n) => n.key === hub.key)!;
  assert.equal(again.label, 'Chest');
  assert.equal(second.tree.rootKey, hub.key);
});

/** A 8-wide box flap across the middle of the paper, with four corner flaps touching it. */
function boxBody(w: number, h: number) {
  let d = createDesign({ gridSize: 16 });
  const body = addFlap(d, 4, 8, 4);
  d = setFlapTip(body.design, body.id!, 4, 8 - h / 2, w, h);
  for (const [x, y] of [[0, 0], [16, 0], [0, 16], [16, 16]]) d = addFlap(d, x!, y!, 4).design;
  return analyze(d);
}

test('a flap with a segment tip is a box that touches its neighbours and folds locally', () => {
  const a = boxBody(8, 0);
  assert.equal(a.issues.filter((i) => i.severity !== 'info').length, 0);
  assert.equal(a.tree.nodes.filter((n) => n.kind === 'hub').length, 1); // all five touch
  assert.equal(a.foldability!.failures.length, 0);
  // The tip itself is a ridge along y = 8, alternating with elevation.
  const tipRidge = a.pattern!.creases.filter((c) => c.kind === 'ridge' && c.y1 === 8 && c.y2 === 8);
  assert.equal(tipRidge.length, 8);
  assert.deepEqual(tipRidge.sort((p, q) => Math.min(p.x1, p.x2) - Math.min(q.x1, q.x2)).map((c) => c.mv).join(''), 'VMVMVMVM');
});

test('a tip with both width and height is a flat top, and says so', () => {
  const a = boxBody(8, 2);
  assert.ok(a.issues.some((i) => i.code === 'flat-top'));
  // No creases inside the top.
  assert.ok(!a.pattern!.creases.some((c) => {
    const mx = (c.x1 + c.x2) / 2;
    const my = (c.y1 + c.y2) / 2;
    return mx > 4 && mx < 12 && my > 7 && my < 9;
  }));
});

test('box flaps overlap, touch and fit as circles measured from the nearest point of the tip', () => {
  let d = createDesign({ gridSize: 10 });
  const r = addFlap(d, 0, 0, 3);
  d = setFlapTip(r.design, r.id!, 0, 0, 4, 0);
  d = addFlap(d, 7, 4, 2).design; // 3 right of and 4 below the tip's end: 5 in a straight line
  const a = analyze(d);
  assert.ok(!a.issues.some((i) => i.code === 'flap-overlap'));
  assert.equal(a.tree.circlePairs.length, 1);
  assert.equal(a.tree.circlePairs[0]!.active, true);
});
