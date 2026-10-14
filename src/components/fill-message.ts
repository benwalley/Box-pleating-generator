import type { FillResult } from '../core/fill/fill.ts';

/** Toast text after "Fill paper". */
export function fillMessage(r: FillResult): string {
  if (!r.grown && !r.rivers) return 'Nothing to fill: every flap already touches its neighbours.';
  const parts = [];
  if (r.grown) parts.push(`grew ${r.grown} flap${r.grown === 1 ? '' : 's'}`);
  if (r.rivers) parts.push(`added ${r.rivers} river${r.rivers === 1 ? '' : 's'}`);
  const text = parts.join(' and ');
  return `${text[0]!.toUpperCase()}${text.slice(1)}. Undo to go back.`;
}
