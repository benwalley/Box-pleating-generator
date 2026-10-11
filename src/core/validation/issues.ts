import type { Id } from '../model/types.ts';

export type Severity = 'error' | 'warning' | 'info';

/** What an issue points at, so the UI can highlight or select it. */
export type IssueRef =
  | { readonly kind: 'flap'; readonly id: Id }
  | { readonly kind: 'river'; readonly id: Id }
  | { readonly kind: 'node'; readonly key: string }
  | { readonly kind: 'point'; readonly x: number; readonly y: number };

export type IssueCode =
  | 'too-few-flaps'
  | 'flap-overlap'
  | 'flap-river-overlap'
  | 'river-overlap'
  | 'river-cap-contact'
  | 'river-self-loop'
  | 'tree-cycle'
  | 'river-unattached'
  | 'disconnected'
  | 'path-too-short'
  | 'redundant-node'
  | 'parity-conflict'
  | 'ambiguous-region'
  | 'asymmetric'
  | 'local-foldability';

export interface Issue {
  readonly code: IssueCode;
  readonly severity: Severity;
  readonly message: string;
  readonly refs: readonly IssueRef[];
  /** Blocking issues stop the crease pattern from being generated. */
  readonly blocking?: boolean;
}

export const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function sortIssues(issues: readonly Issue[]): Issue[] {
  return [...issues].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
