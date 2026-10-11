import type { Analysis } from '../core/analyze.ts';
import type { Design, Id } from '../core/model/types.ts';
import type { TreeLayoutMode } from '../core/tree/layout.ts';
import type { NodeKey } from '../core/tree/types.ts';

export type ToolId = 'select' | 'flap' | 'river' | 'pan';

/** Structure colours each crease by kind; mountain/valley shows the fold direction. */
export type ViewMode = 'structure' | 'mv';

export type Selection =
  | { readonly kind: 'flap'; readonly id: Id }
  | { readonly kind: 'river'; readonly id: Id }
  | { readonly kind: 'node'; readonly key: NodeKey };

export interface Layers {
  readonly grid: boolean;
  readonly elements: boolean;
  readonly creases: boolean;
  readonly labels: boolean;
  readonly markers: boolean;
}

export type LayerId = keyof Layers;

export interface UiState {
  readonly tool: ToolId;
  readonly selection: Selection | null;
  /** A point the user asked to see (from the checks list); cleared on the next selection. */
  readonly focusPoint: { readonly x: number; readonly y: number } | null;
  readonly viewMode: ViewMode;
  readonly layers: Layers;
  /** Width used for the next river drawn. */
  readonly riverWidth: number;
  readonly treeLayout: TreeLayoutMode;
}

export interface AppState {
  readonly design: Design;
  readonly analysis: Analysis;
  readonly ui: UiState;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export const DEFAULT_UI: UiState = {
  tool: 'select',
  selection: null,
  focusPoint: null,
  viewMode: 'structure',
  layers: { grid: true, elements: true, creases: true, labels: true, markers: true },
  riverWidth: 2,
  treeLayout: 'scaled',
};
