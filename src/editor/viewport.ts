/** Pan/zoom state for the canvas. Coordinates are grid units; scale is pixels per unit. */
import type { Point } from '../core/geometry/point.ts';

export interface Viewport {
  readonly centerX: number;
  readonly centerY: number;
  readonly scale: number;
}

export const MIN_SCALE = 4;
export const MAX_SCALE = 240;

export function fitViewport(gridSize: number, widthPx: number, heightPx: number, marginPx = 56): Viewport {
  const usable = Math.max(40, Math.min(widthPx, heightPx) - marginPx * 2);
  return { centerX: gridSize / 2, centerY: gridSize / 2, scale: clampScale(usable / gridSize) };
}

export const clampScale = (s: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export function viewBox(v: Viewport, widthPx: number, heightPx: number): string {
  const w = widthPx / v.scale;
  const h = heightPx / v.scale;
  return `${v.centerX - w / 2} ${v.centerY - h / 2} ${w} ${h}`;
}

/** Zoom by a factor while keeping the grid point under the cursor fixed. */
export function zoomAt(v: Viewport, factor: number, anchor: Point): Viewport {
  const scale = clampScale(v.scale * factor);
  const k = v.scale / scale;
  return {
    scale,
    centerX: anchor.x + (v.centerX - anchor.x) * k,
    centerY: anchor.y + (v.centerY - anchor.y) * k,
  };
}

export function panBy(v: Viewport, dxPx: number, dyPx: number): Viewport {
  return { ...v, centerX: v.centerX - dxPx / v.scale, centerY: v.centerY - dyPx / v.scale };
}
