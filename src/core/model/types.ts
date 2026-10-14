import type { Point } from '../geometry/point.ts';

export type Id = string;

/**
 * A flap: one leaf of the tree. Its tip is the rectangle from (x, y) to
 * (x + w, y + h); a plain flap has w = h = 0, a point tip. The flap claims
 * every point within r of its tip (L-infinity), so a plain flap is a square
 * of side 2r centred on the tip and a rectangular flap is a box of
 * (w + 2r) x (h + 2r).
 */
export interface Flap {
  readonly id: Id;
  /** Top-left corner of the tip. */
  readonly x: number;
  readonly y: number;
  /** Tip width and height in grid units (0 for a point tip). */
  readonly w: number;
  readonly h: number;
  /** Flap length in grid units (the distance from the tip to the box's edge). */
  readonly r: number;
  readonly label: string;
  /** Book-symmetry partner. Equal to `id` when the flap sits on the axis. */
  readonly mirrorId: Id | null;
}

/**
 * A river: one internal edge of the tree, drawn as a strip of constant width
 * around an orthogonal centerline. Flaps touching bank "a" hang from one end
 * of the edge; flaps touching bank "b" hang from the other.
 */
export interface River {
  readonly id: Id;
  readonly points: readonly Point[];
  /** River width = length of the tree edge it represents. */
  readonly width: number;
  readonly label: string;
  /** Book-symmetry partner. Equal to `id` when the river is its own mirror image. */
  readonly mirrorId: Id | null;
}

export interface SymmetrySettings {
  /** Left/right mirror symmetry about the vertical centre line. */
  readonly book: boolean;
}

/** 2: flaps gained tip width and height (w, h). Version 1 files load with w = h = 0. */
export const SCHEMA_VERSION = 2;

/** Everything a user authors. The tree and crease pattern are derived from this. */
export interface Design {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly name: string;
  /** The paper is gridSize x gridSize units. */
  readonly gridSize: number;
  readonly flaps: readonly Flap[];
  readonly rivers: readonly River[];
  readonly symmetry: SymmetrySettings;
  /**
   * Labels for internal tree nodes, keyed by a port (see ports.ts). Internal
   * nodes are derived on every change, so labels are pinned to the geometry
   * that creates the node rather than to the node itself.
   */
  readonly nodeLabels: Readonly<Record<string, string>>;
  /** Port of the node the tree is drawn from, or null for automatic. */
  readonly rootPort: string | null;
}

export type ElementKind = 'flap' | 'river';

export type ElementRef =
  | { readonly kind: 'flap'; readonly id: Id }
  | { readonly kind: 'river'; readonly id: Id };
