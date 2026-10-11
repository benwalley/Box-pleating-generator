/**
 * The analysis pipeline: Design in, everything derived out. Pure and
 * deterministic, so the UI can recompute it after every edit.
 *
 *   layout checks -> tree inference -> crease generation -> local fold checks
 */
import { generateCreases } from './creases/generate.ts';
import type { CreasePattern } from './creases/types.ts';
import { elementName } from './model/naming.ts';
import type { Design } from './model/types.ts';
import { unpairedElements } from './symmetry/book.ts';
import { riverGeometry, type RiverGeometry } from './tree/contacts.ts';
import { inferTree } from './tree/infer-tree.ts';
import type { TreeModel } from './tree/types.ts';
import { checkLocalFoldability, type FoldabilityReport } from './validation/flat-foldability.ts';
import { sortIssues, type Issue } from './validation/issues.ts';

export interface FlapCounts {
  readonly corner: number;
  readonly edge: number;
  readonly middle: number;
}

export interface Analysis {
  readonly rivers: readonly RiverGeometry[];
  readonly tree: TreeModel;
  /** Null when blocking issues prevent generation. */
  readonly pattern: CreasePattern | null;
  readonly foldability: FoldabilityReport | null;
  readonly issues: readonly Issue[];
  readonly flapCounts: FlapCounts;
}

export function analyze(design: Design): Analysis {
  const issues: Issue[] = [];
  const rivers = design.rivers.map(riverGeometry);
  const n = design.gridSize;

  if (design.flaps.length < 2) {
    issues.push({
      code: 'too-few-flaps',
      severity: 'info',
      message: 'Place at least two flaps to start a tree.',
      refs: [],
    });
  }

  for (const ref of unpairedElements(design)) {
    issues.push({
      code: 'asymmetric',
      severity: 'warning',
      message: `${elementName(design, ref)} has no mirror image. Use "Make symmetric" or add its partner.`,
      refs: [ref],
    });
  }

  const treeResult = inferTree(design, rivers);
  issues.push(...treeResult.issues);

  const blocked = issues.some((i) => i.blocking);
  let pattern: CreasePattern | null = null;
  let foldability: FoldabilityReport | null = null;

  if (!blocked && design.flaps.length > 0) {
    pattern = generateCreases(design, rivers);
    foldability = checkLocalFoldability(pattern.creases, n);

    const conflicts = pattern.creases.filter((c) => c.kind === 'conflict');
    if (conflicts.length) {
      issues.push({
        code: 'parity-conflict',
        severity: 'warning',
        message: `${conflicts.length} crease segment${conflicts.length === 1 ? '' : 's'} where contours don't line up. Shift a flap by one unit, or this spot needs a level shifter.`,
        refs: conflicts.slice(0, 50).map((c) => ({ kind: 'point', x: (c.x1 + c.x2) / 2, y: (c.y1 + c.y2) / 2 })),
      });
    }
    if (pattern.ambiguousCells.length) {
      issues.push({
        code: 'ambiguous-region',
        severity: 'warning',
        message: `${pattern.ambiguousCells.length} grid cell${pattern.ambiguousCells.length === 1 ? ' is' : 's are'} not clearly owned by one flap. Fill the gap with a flap or a river.`,
        refs: pattern.ambiguousCells.slice(0, 50).map((c) => ({ kind: 'point', x: c.x + 0.5, y: c.y + 0.5 })),
      });
    }
    if (foldability.failures.length) {
      issues.push({
        code: 'local-foldability',
        severity: 'warning',
        message: `${foldability.failures.length} ${foldability.failures.length === 1 ? 'vertex' : 'vertices'} fail a local fold check (Kawasaki ${foldability.kawasakiFailures}, Maekawa ${foldability.maekawaFailures}). Some may pass once hinges are assigned.`,
        refs: foldability.failures.slice(0, 50).map((f) => ({ kind: 'point', x: f.x, y: f.y })),
      });
    }
  }

  const flapCounts = { corner: 0, edge: 0, middle: 0 };
  for (const f of design.flaps) {
    const onX = f.x === 0 || f.x === n;
    const onY = f.y === 0 || f.y === n;
    if (onX && onY) flapCounts.corner++;
    else if (onX || onY) flapCounts.edge++;
    else flapCounts.middle++;
  }

  return { rivers, tree: treeResult.tree, pattern, foldability, issues: sortIssues(issues), flapCounts };
}
