/**
 * Tidy layout of the tree for display: the root on top, leaves spread
 * evenly, parents centred over their children. Vertical position is either
 * the depth (uniform rows) or the true distance from the root (to scale).
 */
import { buildAdjacency } from './infer-tree.ts';
import type { NodeKey, TreeModel } from './types.ts';

export type TreeLayoutMode = 'depth' | 'scaled';

export interface TreeLayout {
  readonly positions: ReadonlyMap<NodeKey, { readonly x: number; readonly y: number }>;
  readonly parent: ReadonlyMap<NodeKey, NodeKey | null>;
  /** Number of leaf columns. */
  readonly columns: number;
  /** Largest y value. */
  readonly height: number;
}

export function layoutTree(
  tree: TreeModel,
  mode: TreeLayoutMode,
  /** Used to order siblings left-to-right like they appear on the paper. */
  sortKey: (key: NodeKey) => number,
): TreeLayout {
  const adj = buildAdjacency(tree.nodes, tree.edges);
  const positions = new Map<NodeKey, { x: number; y: number }>();
  const parent = new Map<NodeKey, NodeKey | null>();
  const subtreeKey = new Map<NodeKey, number>();
  let column = 0;
  let height = 0;

  // Mean sort key of the leaves under each node, so whole branches order sensibly.
  const meanKey = (key: NodeKey, from: NodeKey | null): number => {
    const kids = (adj.get(key) ?? []).filter((e) => e.to !== from);
    if (!kids.length) return sortKey(key);
    const vals = kids.map((e) => meanKey(e.to, key));
    return vals.reduce((s, v) => s + v, 0) / vals.length;
  };

  const place = (key: NodeKey, from: NodeKey | null, depth: number, dist: number): number => {
    parent.set(key, from);
    const y = mode === 'depth' ? depth : dist;
    height = Math.max(height, y);
    const kids = (adj.get(key) ?? []).filter((e) => e.to !== from);
    for (const k of kids) subtreeKey.set(k.to, meanKey(k.to, key));
    kids.sort((a, b) => subtreeKey.get(a.to)! - subtreeKey.get(b.to)!);
    let x: number;
    if (!kids.length) {
      x = column++;
    } else {
      const xs = kids.map((k) => place(k.to, key, depth + 1, dist + k.length));
      x = (Math.min(...xs) + Math.max(...xs)) / 2;
    }
    positions.set(key, { x, y });
    return x;
  };

  const roots = tree.rootKey ? [tree.rootKey] : [];
  for (const n of tree.nodes) if (!roots.includes(n.key)) roots.push(n.key);
  for (const r of roots) {
    if (positions.has(r)) continue;
    if (positions.size) column += 0.5; // gap between disconnected pieces
    place(r, null, 0, 0);
  }
  return { positions, parent, columns: Math.max(1, column), height };
}
