import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheb } from '../src/core/geometry/point.ts';
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
