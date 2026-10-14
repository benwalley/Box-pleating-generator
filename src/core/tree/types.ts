import type { Point } from '../geometry/point.ts';
import type { PortKey } from '../model/ports.ts';
import type { Id } from '../model/types.ts';

export type NodeKey = string;

export interface TreeNode {
  readonly key: NodeKey;
  readonly kind: 'hub' | 'leaf';
  /** Ports merged into this node; the first is canonical (where its label is stored). */
  readonly ports: readonly PortKey[];
  /** For leaves: the flap whose tip this is. */
  readonly flapId?: Id;
  /** User label, or '' when the node has none. */
  readonly label: string;
  /** Fallback display name such as "n2" or "F3". */
  readonly autoName: string;
}

export type EdgeKind = 'flap' | 'river' | 'implicit';

export interface TreeEdge {
  readonly id: string;
  readonly from: NodeKey;
  readonly to: NodeKey;
  readonly length: number;
  readonly kind: EdgeKind;
  readonly flapId?: Id;
  readonly riverId?: Id;
}

export interface TreeModel {
  readonly nodes: readonly TreeNode[];
  readonly edges: readonly TreeEdge[];
  readonly rootKey: NodeKey | null;
  /** Hub node each flap hangs from. */
  readonly hubOfFlap: ReadonlyMap<Id, NodeKey>;
  /** Number of flap pairs whose path condition holds with equality. */
  readonly activePaths: number;
  /** Flap pairs that only fit as circles (Euclidean, not Chebyshev, path condition). */
  readonly circlePairs: readonly CirclePair[];
  /** Extra tangent-side normals per flap, from circle pairs and river corners. */
  readonly circleNormals: ReadonlyMap<Id, readonly Point[]>;
}

export interface CirclePair {
  readonly a: Id;
  readonly b: Id;
  /** Euclidean distance between the tips. */
  readonly distance: number;
  /** r_a + r_b + tree distance between their hubs. */
  readonly need: number;
  /** True when the circles' path condition holds with equality. */
  readonly active: boolean;
}

export const nodeDisplayName = (n: TreeNode): string => n.label || n.autoName;
