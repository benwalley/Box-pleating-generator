import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDesign } from '../src/core/model/design.ts';
import {
  addFlap,
  addRiver,
  deleteElements,
  makeSymmetric,
  moveFlap,
  resizeFlap,
  setBookSymmetry,
  setRiverWidth,
  translateRiver,
  moveRiverVertices,
  setNodeLabel,
} from '../src/core/model/operations.ts';
import { unpairedElements } from '../src/core/symmetry/book.ts';

const sym = () => createDesign({ gridSize: 12, symmetry: { book: true } });

test('adding a flap with book symmetry creates its mirror', () => {
  const { design, id } = addFlap(sym(), 2, 3, 2);
  assert.equal(design.flaps.length, 2);
  const [a, b] = design.flaps;
  assert.equal(a!.id, id);
  assert.equal(b!.x, 10);
  assert.equal(a!.mirrorId, b!.id);
  assert.equal(b!.mirrorId, a!.id);
});

test('a flap on the axis mirrors to itself and stays on the axis', () => {
  const { design, id } = addFlap(sym(), 6, 3, 2);
  assert.equal(design.flaps.length, 1);
  const moved = moveFlap(design, id!, 2, 5);
  assert.equal(moved.flaps[0]!.x, 6);
  assert.equal(moved.flaps[0]!.y, 5);
});

test('move, resize and delete follow the mirror partner', () => {
  let { design, id } = addFlap(sym(), 2, 3, 2);
  design = moveFlap(design, id!, 1, 4);
  design = resizeFlap(design, id!, 3);
  const partner = design.flaps.find((f) => f.id !== id)!;
  assert.deepEqual([partner.x, partner.y, partner.r], [11, 4, 3]);
  assert.equal(deleteElements(design, [{ kind: 'flap', id: id! }]).flaps.length, 0);
});

test('turning symmetry on links existing mirror images', () => {
  let d = createDesign({ gridSize: 10 });
  d = addFlap(d, 1, 1, 1).design;
  d = addFlap(d, 9, 1, 1).design;
  d = addFlap(d, 2, 7, 1).design;
  d = setBookSymmetry(d, true);
  assert.equal(unpairedElements(d).length, 1);
  d = makeSymmetric(d);
  assert.equal(unpairedElements(d).length, 0);
  assert.equal(d.flaps.length, 4);
});

test('rivers mirror, and a river along the axis is its own mirror', () => {
  let d = sym();
  const vertical = addRiver(d, [{ x: 6, y: 0 }, { x: 6, y: 12 }], 2);
  assert.equal(vertical.design.rivers.length, 1);
  assert.equal(vertical.design.rivers[0]!.mirrorId, vertical.id);
  const side = addRiver(d, [{ x: 2, y: 0 }, { x: 2, y: 12 }], 2);
  assert.equal(side.design.rivers.length, 2);
  assert.equal(side.design.rivers[1]!.points[0]!.x, 10);
  d = translateRiver(side.design, side.id!, -1, 0);
  assert.equal(d.rivers[1]!.points[0]!.x, 11);
});

test('river width changes keep bank A fixed', () => {
  let { design, id } = addRiver(createDesign({ gridSize: 12 }), [{ x: 0, y: 4 }, { x: 12, y: 4 }], 2);
  design = setRiverWidth(design, id!, 3);
  const r = design.rivers[0]!;
  assert.equal(r.width, 3);
  // Bank A (y + 1 before) stays at y = 5; centerline moves to 3.5.
  assert.equal(r.points[0]!.y, 3.5);
});

test('axis river widens symmetrically in steps of two', () => {
  let { design, id } = addRiver(sym(), [{ x: 6, y: 0 }, { x: 6, y: 12 }], 2);
  design = setRiverWidth(design, id!, 3);
  assert.equal(design.rivers[0]!.width, 4);
  assert.equal(design.rivers[0]!.points[0]!.x, 6);
});

test('dragging a segment of a self-symmetric river stays symmetric', () => {
  const pts = [{ x: 0, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 6 }, { x: 12, y: 6 }];
  let { design, id } = addRiver(sym(), pts, 2);
  assert.equal(design.rivers.length, 1);
  design = moveRiverVertices(design, id!, [1, 2], -1, 0); // left vertical segment
  assert.deepEqual(design.rivers[0]!.points.map((p) => p.x), [0, 3, 3, 9, 9, 12]);
});

test('node labels are stored on one port only', () => {
  let d = createDesign({ nodeLabels: {} });
  d = addFlap(d, 0, 0, 2).design;
  const port = `flap:${d.flaps[0]!.id}`;
  d = setNodeLabel(d, [port, 'other'], 'Body');
  assert.deepEqual(d.nodeLabels, { [port]: 'Body' });
  d = setNodeLabel(d, [port], '');
  assert.deepEqual(d.nodeLabels, {});
});
