import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheb, euclid } from '../src/core/geometry/point.ts';
import { gauge, shapePolygon, sideNormals, tangentNormal, tipCheb, tipElevation, tipEuclid, tipRect } from '../src/core/geometry/flap-shape.ts';
import {
  normalizePolyline,
  offsetPolyline,
  snapRiverPoints,
  stripSegments,
  sideOf,
  isAtCap,
} from '../src/core/geometry/polyline.ts';
import { rectContact, squareAround } from '../src/core/geometry/rect.ts';

test('chebyshev distance', () => {
  assert.equal(cheb({ x: 0, y: 0 }, { x: 3, y: -5 }), 5);
});

test('rectContact distinguishes touch from overlap', () => {
  const a = squareAround({ x: 0, y: 0 }, 2);
  assert.equal(rectContact(a, squareAround({ x: 4, y: 1 }, 2)).kind, 'touch');
  assert.equal(rectContact(a, squareAround({ x: 3, y: 0 }, 2)).kind, 'overlap');
  assert.equal(rectContact(a, squareAround({ x: 5, y: 0 }, 2)).kind, 'none');
  assert.equal(rectContact(a, squareAround({ x: 4, y: 4 }, 2)).kind, 'touch'); // corner point
});

test('normalizePolyline drops duplicates and collinear points', () => {
  const p = normalizePolyline([
    { x: 0, y: 0 },
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 3 },
  ]);
  assert.deepEqual(p, [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }]);
});

test('strip segments have flat caps and filled corners', () => {
  const segs = stripSegments([{ x: 0, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 5 }], 1);
  assert.deepEqual(segs[0]!.rect, { x0: 0, y0: 0, x1: 5, y1: 2 });
  assert.deepEqual(segs[1]!.rect, { x0: 3, y0: 0, x1: 5, y1: 5 });
});

test('sides are consistent around a bend', () => {
  const [s0, s1] = stripSegments([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }], 1);
  // Outer corner point is on the same side for both segments.
  assert.equal(sideOf(s0!, { x: 7, y: -2 }), sideOf(s1!, { x: 7, y: -2 }));
  // Inner corner point too.
  assert.equal(sideOf(s0!, { x: 3, y: 2 }), sideOf(s1!, { x: 3, y: 2 }));
  assert.notEqual(sideOf(s0!, { x: 3, y: 2 }), sideOf(s0!, { x: 3, y: -2 }));
});

test('end caps are detected', () => {
  const [s] = stripSegments([{ x: 0, y: 2 }, { x: 6, y: 2 }], 2);
  assert.equal(isAtCap(s!, { x: 0, y: 3 }), true);
  assert.equal(isAtCap(s!, { x: 6, y: 1 }), true);
  assert.equal(isAtCap(s!, { x: 3, y: 4 }), false);
});

test('offset keeps the polyline orthogonal', () => {
  const p = offsetPolyline([{ x: 0, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 5 }], 0.5);
  assert.deepEqual(p, [{ x: 0, y: 1.5 }, { x: 3.5, y: 1.5 }, { x: 3.5, y: 5 }]);
});

test('snapping puts banks on grid lines', () => {
  // Odd width: centerline on half-integers across, integer ends along.
  assert.deepEqual(snapRiverPoints([{ x: 0, y: 2 }, { x: 6, y: 2 }], 3), [{ x: 0, y: 2.5 }, { x: 6, y: 2.5 }]);
  // Even width: integers.
  assert.deepEqual(snapRiverPoints([{ x: 0.4, y: 2.2 }, { x: 6, y: 2.2 }], 2), [{ x: 0, y: 2 }, { x: 6, y: 2 }]);
});

test('euclidean distance', () => {
  assert.equal(euclid({ x: 0, y: 0 }, { x: 3, y: -4 }), 5);
});

test('a flap shape is its square cut by tangent sides', () => {
  const tip = { x: 0, y: 0 };
  const normals = sideNormals([tangentNormal(tip, { x: 3, y: 4 })]);
  // With only the axis normals the gauge is the Chebyshev distance minus r.
  assert.equal(gauge(tip, 2, sideNormals(), { x: 3, y: -1 }).value, 1);
  // The tangent side toward (3,4) is at distance r along (0.6, 0.8).
  const g = gauge(tip, 2, normals, { x: 1.2, y: 1.6 });
  assert.ok(Math.abs(g.value) < 1e-12);
  assert.deepEqual(g.normal, { x: 0.6, y: 0.8 });
  const corners = shapePolygon(tip, 2, normals).map((p) => [Math.round(p.x * 1000) / 1000, Math.round(p.y * 1000) / 1000]);
  assert.equal(corners.length, 5);
  assert.ok(corners.some(([x, y]) => x === 2 && y === 1));
  assert.ok(corners.some(([x, y]) => x === 0.667 && y === 2));
});

test('distances and elevation between rectangular tips', () => {
  const seg = { x: 4, y: 8, w: 8, h: 0 };
  // Measured from the nearest point of the tip.
  assert.equal(tipCheb(seg, { x: 0, y: 0 }), 8);
  assert.equal(tipCheb(seg, { x: 14, y: 11 }), 3);
  assert.equal(tipEuclid(seg, { x: 15, y: 12 }), 5);
  assert.equal(tipCheb(seg, { x: 8, y: 9 }), 1);
  // Above the segment, elevation runs from its left end; to its right it continues from w.
  const t = tipRect(seg);
  assert.equal(tipElevation(t, { x: 0, y: -1 }, { x: 7, y: 5 }), 3);
  assert.equal(tipElevation(t, { x: 1, y: 0 }, { x: 15, y: 6 }), 10);
  // Point tips keep the distance from the axis line.
  assert.equal(tipElevation(tipRect({ x: 2, y: 2 }), { x: 1, y: 0 }, { x: 5, y: 4 }), 2);
  // The box: the tip grown by r, and its gauge is the L-infinity distance from the tip minus r.
  assert.equal(gauge(seg, 4, sideNormals(), { x: 14, y: 11 }).value, -1);
});
