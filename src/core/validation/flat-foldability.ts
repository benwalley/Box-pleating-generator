/**
 * Local flat-foldability checks at every interior vertex:
 * - Kawasaki: alternating sector angles sum to 180 degrees (uses all creases).
 * - Maekawa: |M - V| = 2 (only where every crease is assigned).
 * These are necessary, not sufficient: deciding global flat-foldability is
 * NP-complete even for box pleating.
 */
import type { Crease } from '../creases/types.ts';

export interface VertexFailure {
  readonly x: number;
  readonly y: number;
  readonly kawasaki: boolean;
  readonly maekawa: boolean;
}

export interface FoldabilityReport {
  readonly verticesChecked: number;
  readonly fullyAssigned: number;
  readonly kawasakiFailures: number;
  readonly maekawaFailures: number;
  readonly failures: readonly VertexFailure[];
}

const TAU = Math.PI * 2;

export function checkLocalFoldability(creases: readonly Crease[], gridSize: number): FoldabilityReport {
  const vertices = new Map<string, { x: number; y: number; rays: Array<{ angle: number; mv: Crease['mv'] }> }>();
  const addRay = (x: number, y: number, angle: number, mv: Crease['mv']) => {
    // Crease endpoints come from one canonical point per vertex, so exact keys are safe.
    const key = `${x},${y}`;
    let v = vertices.get(key);
    if (!v) {
      v = { x, y, rays: [] };
      vertices.set(key, v);
    }
    v.rays.push({ angle: ((angle % TAU) + TAU) % TAU, mv });
  };
  for (const c of creases) {
    const a = Math.atan2(c.y2 - c.y1, c.x2 - c.x1);
    addRay(c.x1, c.y1, a, c.mv);
    addRay(c.x2, c.y2, a + Math.PI, c.mv);
  }

  const failures: VertexFailure[] = [];
  let verticesChecked = 0;
  let fullyAssigned = 0;
  let kawasakiFailures = 0;
  let maekawaFailures = 0;

  for (const v of vertices.values()) {
    if (v.x <= 0 || v.y <= 0 || v.x >= gridSize || v.y >= gridSize) continue;
    verticesChecked++;
    const angles = v.rays.map((r) => r.angle).sort((a, b) => a - b);
    let kawasaki = angles.length % 2 === 0;
    if (kawasaki) {
      let alt = 0;
      for (let i = 0; i < angles.length; i++) {
        const next = i + 1 < angles.length ? angles[i + 1]! : angles[0]! + TAU;
        alt += (i % 2 ? -1 : 1) * (next - angles[i]!);
      }
      kawasaki = Math.abs(alt) < 1e-6;
    }
    let maekawa = true;
    if (v.rays.every((r) => r.mv !== 'U')) {
      fullyAssigned++;
      const m = v.rays.filter((r) => r.mv === 'M').length;
      maekawa = Math.abs(2 * m - v.rays.length) === 2;
    }
    if (!kawasaki) kawasakiFailures++;
    if (!maekawa) maekawaFailures++;
    if (!kawasaki || !maekawa) failures.push({ x: v.x, y: v.y, kawasaki: !kawasaki, maekawa: !maekawa });
  }
  return { verticesChecked, fullyAssigned, kawasakiFailures, maekawaFailures, failures };
}
