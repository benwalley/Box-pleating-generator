/**
 * Infer the tree (stick figure) from a layout of flap squares and rivers.
 *
 * 1. Every flap base and every river bank is a port.
 * 2. Ports of touching elements are merged (union-find); each merged group is
 *    an internal tree node ("hub").
 * 3. Each river becomes an edge between the hubs on its two banks.
 * 4. Groups still disconnected after that are joined by "implicit" rivers,
 *    using the smallest gaps first (Kruskal). This keeps simple designs
 *    working without drawing every river.
 * 5. Each flap becomes a leaf edge of length r from its hub to its tip.
 * 6. Every pair of flaps is checked against the box-pleating path condition:
 *    Chebyshev distance between tips >= tree distance between tips.
 */
import { cheb } from '../geometry/point.ts';
import { flapName, riverName } from '../model/naming.ts';
import { flapBasePort, flapTipPort, parsePort, riverPort, type PortKey } from '../model/ports.ts';
import type { Design, Id } from '../model/types.ts';
import { UnionFind } from '../util/union-find.ts';
import type { Issue } from '../validation/issues.ts';
import { computeContacts, type RiverGeometry } from './contacts.ts';
import type { NodeKey, TreeEdge, TreeModel, TreeNode } from './types.ts';

export interface TreeResult {
  readonly tree: TreeModel;
  readonly issues: readonly Issue[];
}

const hubKeyFor = (canonicalPort: PortKey): NodeKey => `hub:${canonicalPort}`;

export function inferTree(design: Design, rivers: readonly RiverGeometry[]): TreeResult {
  const issues: Issue[] = [];
  const contacts = computeContacts(design, rivers);
  issues.push(...contacts.issues);

  // --- 1-2. merge ports into hubs
  const ports = new UnionFind();
  for (const f of design.flaps) ports.add(flapBasePort(f.id));
  for (const g of rivers) {
    ports.add(riverPort(g.river.id, 'a'));
    ports.add(riverPort(g.river.id, 'b'));
  }
  for (const [a, b] of contacts.unions) ports.union(a, b);

  const groups = ports.groups();
  const hubOfPort = new Map<PortKey, NodeKey>();
  const hubPorts = new Map<NodeKey, string[]>();
  for (const members of groups.values()) {
    const key = hubKeyFor(members[0]!);
    hubPorts.set(key, members);
    for (const p of members) hubOfPort.set(p, key);
  }
  const hubOfFlap = new Map<Id, NodeKey>();
  for (const f of design.flaps) hubOfFlap.set(f.id, hubOfPort.get(flapBasePort(f.id))!);

  // --- 3. river edges (rejecting loops and cycles)
  const edges: TreeEdge[] = [];
  const components = new UnionFind();
  for (const key of hubPorts.keys()) components.add(key);
  for (const g of rivers) {
    const a = hubOfPort.get(riverPort(g.river.id, 'a'))!;
    const b = hubOfPort.get(riverPort(g.river.id, 'b'))!;
    const name = riverName(design, g.river.id);
    if (a === b) {
      issues.push({
        code: 'river-self-loop',
        severity: 'error',
        message: `Both banks of river ${name} connect to the same group, so it can't be a tree edge.`,
        refs: [{ kind: 'river', id: g.river.id }],
      });
      continue;
    }
    if (!components.union(a, b)) {
      issues.push({
        code: 'tree-cycle',
        severity: 'error',
        message: `River ${name} closes a loop. The rivers must form a tree, with exactly one path between any two flaps.`,
        refs: [{ kind: 'river', id: g.river.id }],
      });
      continue;
    }
    edges.push({ id: `river:${g.river.id}`, from: a, to: b, length: g.river.width, kind: 'river', riverId: g.river.id });
  }

  // --- 4. implicit rivers between still-separate groups (smallest gap first)
  const pairs: Array<{ i: number; j: number; gap: number }> = [];
  const flaps = design.flaps;
  for (let i = 0; i < flaps.length; i++) {
    for (let j = i + 1; j < flaps.length; j++) {
      const a = flaps[i]!;
      const b = flaps[j]!;
      pairs.push({ i, j, gap: cheb(a, b) - a.r - b.r });
    }
  }
  pairs.sort((p, q) => p.gap - q.gap || p.i - q.i || p.j - q.j);
  for (const p of pairs) {
    if (p.gap <= 0) continue;
    const a = hubOfFlap.get(flaps[p.i]!.id)!;
    const b = hubOfFlap.get(flaps[p.j]!.id)!;
    if (!components.union(a, b)) continue;
    edges.push({ id: `implicit:${flaps[p.i]!.id}:${flaps[p.j]!.id}`, from: a, to: b, length: p.gap, kind: 'implicit' });
  }

  // --- 5. nodes and leaf edges
  const nodes: TreeNode[] = [];
  let hubIndex = 0;
  for (const [key, members] of hubPorts) {
    const label = members.map((p) => design.nodeLabels[p]?.trim() ?? '').find((l) => l) ?? '';
    nodes.push({ key, kind: 'hub', ports: members, label, autoName: `n${++hubIndex}` });
  }
  for (const f of flaps) {
    const key = flapTipPort(f.id);
    nodes.push({
      key,
      kind: 'leaf',
      ports: [key],
      flapId: f.id,
      label: f.label.trim(),
      autoName: flapName(design, f.id),
    });
    edges.push({ id: `flap:${f.id}`, from: hubOfFlap.get(f.id)!, to: key, length: f.r, kind: 'flap', flapId: f.id });
  }

  // Groups made only of rivers that touch nothing on one bank.
  for (const g of rivers) {
    for (const side of ['a', 'b'] as const) {
      const hub = hubOfPort.get(riverPort(g.river.id, side))!;
      const members = hubPorts.get(hub)!;
      if (members.length === 1) {
        issues.push({
          code: 'river-unattached',
          severity: 'warning',
          message: `Bank ${side.toUpperCase()} of river ${riverName(design, g.river.id)} doesn't touch any flap or river.`,
          refs: [{ kind: 'river', id: g.river.id }],
        });
      }
    }
  }

  // --- 6. path conditions
  const adjacency = buildAdjacency(nodes, edges);
  const hubDistance = new Map<NodeKey, Map<NodeKey, number>>();
  const distFrom = (key: NodeKey) => {
    let m = hubDistance.get(key);
    if (!m) {
      m = distancesFrom(adjacency, key);
      hubDistance.set(key, m);
    }
    return m;
  };
  let activePaths = 0;
  let disconnected = false;
  for (let i = 0; i < flaps.length; i++) {
    for (let j = i + 1; j < flaps.length; j++) {
      const a = flaps[i]!;
      const b = flaps[j]!;
      const d = cheb(a, b);
      if (d < a.r + b.r) continue; // already reported as an overlap
      const between = distFrom(hubOfFlap.get(a.id)!).get(hubOfFlap.get(b.id)!);
      if (between === undefined) {
        disconnected = true;
        continue;
      }
      const need = a.r + b.r + between;
      if (d < need) {
        issues.push({
          code: 'path-too-short',
          severity: 'error',
          message: `${flapName(design, a.id)} and ${flapName(design, b.id)} are ${d} apart on the grid but ${need} apart in the tree. Move them ${need - d} further apart or shorten the path.`,
          refs: [{ kind: 'flap', id: a.id }, { kind: 'flap', id: b.id }],
        });
      } else if (d === need) {
        activePaths++;
      }
    }
  }
  if (disconnected) {
    issues.push({
      code: 'disconnected',
      severity: 'warning',
      message: 'Some parts of the design are not connected to the rest of the tree.',
      refs: [],
    });
  }

  // Hubs with exactly two edges are just bends in a longer edge.
  for (const n of nodes) {
    if (n.kind !== 'hub') continue;
    const degree = adjacency.get(n.key)?.length ?? 0;
    if (degree === 2) {
      issues.push({
        code: 'redundant-node',
        severity: 'info',
        message: `Node ${n.label || n.autoName} joins only two edges, so it acts like one longer edge.`,
        refs: [{ kind: 'node', key: n.key }],
      });
    }
  }

  const rootKey = resolveRoot(design, nodes, adjacency, hubOfPort);
  return { tree: { nodes, edges, rootKey, hubOfFlap, activePaths }, issues };
}

type Adjacency = Map<NodeKey, Array<{ to: NodeKey; length: number }>>;

export function buildAdjacency(nodes: readonly TreeNode[], edges: readonly TreeEdge[]): Adjacency {
  const adj: Adjacency = new Map(nodes.map((n) => [n.key, []]));
  for (const e of edges) {
    adj.get(e.from)?.push({ to: e.to, length: e.length });
    adj.get(e.to)?.push({ to: e.from, length: e.length });
  }
  return adj;
}

/** Weighted distances along the tree from one node (a tree has unique paths, so BFS suffices). */
export function distancesFrom(adj: Adjacency, start: NodeKey): Map<NodeKey, number> {
  const dist = new Map<NodeKey, number>([[start, 0]]);
  const queue = [start];
  while (queue.length) {
    const u = queue.shift()!;
    for (const { to, length } of adj.get(u) ?? []) {
      if (dist.has(to)) continue;
      dist.set(to, dist.get(u)! + length);
      queue.push(to);
    }
  }
  return dist;
}

function resolveRoot(
  design: Design,
  nodes: readonly TreeNode[],
  adj: Adjacency,
  hubOfPort: ReadonlyMap<PortKey, NodeKey>,
): NodeKey | null {
  if (design.rootPort) {
    const parsed = parsePort(design.rootPort);
    if (parsed?.kind === 'flap-tip') {
      if (nodes.some((n) => n.key === design.rootPort)) return design.rootPort;
    } else {
      const hub = hubOfPort.get(design.rootPort);
      if (hub) return hub;
    }
  }
  let best: TreeNode | null = null;
  for (const n of nodes) {
    if (n.kind !== 'hub') continue;
    if (!best || (adj.get(n.key)?.length ?? 0) > (adj.get(best.key)?.length ?? 0)) best = n;
  }
  return best?.key ?? nodes[0]?.key ?? null;
}
