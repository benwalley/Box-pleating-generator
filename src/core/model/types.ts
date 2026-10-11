import type { Point } from '../geometry/point.ts';

export type Id = string;

/**
 * A flap: one leaf of the tree. Its square is centred on the flap tip (x, y)
 * and has half-side r, so the side length is twice the flap length.
 */
export interface Flap {
  readonly id: Id;
  readonly x: number;
  readonly y: number;
  /** Flap length in grid units (the square's half-side). */
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

export const SCHEMA_VERSION = 1;

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
