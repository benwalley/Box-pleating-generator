import type { Design, ElementRef, Flap, Id, River } from './types.ts';

/** Display name for a flap: its label, or F1, F2... by creation order. */
export function flapName(design: Design, id: Id): string {
  const i = design.flaps.findIndex((f) => f.id === id);
  const f = design.flaps[i];
  return f?.label.trim() || `F${i + 1}`;
}

export function riverName(design: Design, id: Id): string {
  const i = design.rivers.findIndex((r) => r.id === id);
  const r = design.rivers[i];
  return r?.label.trim() || `R${i + 1}`;
}

export function elementName(design: Design, ref: ElementRef): string {
  return ref.kind === 'flap' ? flapName(design, ref.id) : riverName(design, ref.id);
}

export const findFlap = (design: Design, id: Id): Flap | undefined =>
  design.flaps.find((f) => f.id === id);

export const findRiver = (design: Design, id: Id): River | undefined =>
  design.rivers.find((r) => r.id === id);
