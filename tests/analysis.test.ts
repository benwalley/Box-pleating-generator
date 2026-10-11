import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/core/analyze.ts';
import { createDesign } from '../src/core/model/design.ts';
import { addFlap, addRiver, setNodeLabel, setRootPort } from '../src/core/model/operations.ts';
import { PRESETS } from '../src/core/presets.ts';

test('presets analyse without blocking errors', () => {
  for (const p of PRESETS) {
    const a = analyze(p.build());
    assert.ok(a.pattern, `${p.id} should generate creases`);
    assert.equal(a.issues.filter((i) => i.severity === 'error').length, 0, p.id);
  }
});

test('clean presets pass local fold checks', () => {
  for (const id of ['bird', 'river', 'lizard']) {
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

test('overlapping flaps block generation', () => {
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

test('path condition violations are reported', () => {
  // A and C are 6 apart on the grid, but the tree path A-R1-B-R2-C is 8 long.
  let d = createDesign({ gridSize: 12 });
  d = addFlap(d, 0, 0, 2).design; // A
  d = addRiver(d, [{ x: 3, y: 0 }, { x: 3, y: 4 }], 2).design; // R1
  d = addFlap(d, 6, 0, 2).design; // B
  d = addRiver(d, [{ x: 4, y: 3 }, { x: 12, y: 3 }], 2).design; // R2
  d = addFlap(d, 6, 6, 2).design; // C
  const a = analyze(d);
  assert.ok(a.issues.some((i) => i.code === 'path-too-short'));
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
