import { clamp } from '../geometry/point.ts';
import { isOrthogonalPolyline, normalizePolyline, snapRiverPoints } from '../geometry/polyline.ts';
import { portOwner } from './ports.ts';
import { SCHEMA_VERSION, type Design, type Flap, type River } from './types.ts';

export const MIN_GRID = 2;
export const MAX_GRID = 96;
export const DEFAULT_GRID = 16;

export function createDesign(partial: Partial<Design> = {}): Design {
  return normalizeDesign({
    schemaVersion: SCHEMA_VERSION,
    name: 'Untitled design',
    gridSize: DEFAULT_GRID,
    flaps: [],
    rivers: [],
    symmetry: { book: false },
    nodeLabels: {},
    rootPort: null,
    ...partial,
  });
}

/** Book-symmetry axis (x coordinate of the vertical centre line). */
export const symmetryAxis = (design: Design): number => design.gridSize / 2;

export function normalizeFlap(f: Flap, gridSize: number): Flap {
  return {
    ...f,
    x: clamp(Math.round(f.x), 0, gridSize),
    y: clamp(Math.round(f.y), 0, gridSize),
    r: clamp(Math.round(f.r), 1, gridSize),
  };
}

/** Returns null if the river can't be made valid (fewer than two distinct points). */
export function normalizeRiver(r: River, gridSize: number): River | null {
  const width = clamp(Math.round(r.width), 1, gridSize);
  const clamped = r.points.map((p) => ({ x: clamp(p.x, 0, gridSize), y: clamp(p.y, 0, gridSize) }));
  const points = normalizePolyline(snapRiverPoints(normalizePolyline(clamped), width));
  if (!isOrthogonalPolyline(points)) return null;
  return { ...r, width, points };
}

/**
 * Bring any design (including user-imported JSON) into a consistent state:
 * values clamped to the grid, rivers snapped, dangling references removed.
 */
export function normalizeDesign(d: Design): Design {
  const gridSize = clamp(Math.round(d.gridSize) || DEFAULT_GRID, MIN_GRID, MAX_GRID);
  const flaps = d.flaps.map((f) => normalizeFlap(f, gridSize));
  const rivers = d.rivers
    .map((r) => normalizeRiver(r, gridSize))
    .filter((r): r is River => r !== null);
  const ids = new Set([...flaps.map((f) => f.id), ...rivers.map((r) => r.id)]);
  const fixMirror = <T extends Flap | River>(e: T): T =>
    e.mirrorId && !ids.has(e.mirrorId) ? { ...e, mirrorId: null } : e;
  const nodeLabels: Record<string, string> = {};
  for (const [port, label] of Object.entries(d.nodeLabels)) {
    const owner = portOwner(port);
    if (owner && ids.has(owner) && label.trim()) nodeLabels[port] = label;
  }
  const rootOwner = d.rootPort ? portOwner(d.rootPort) : null;
  return {
    ...d,
    schemaVersion: SCHEMA_VERSION,
    gridSize,
    flaps: flaps.map(fixMirror),
    rivers: rivers.map(fixMirror),
    nodeLabels,
    rootPort: rootOwner && ids.has(rootOwner) ? d.rootPort : null,
  };
}
