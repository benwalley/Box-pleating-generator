/**
 * Ports are stable handles on the places where tree nodes come from.
 *
 * - Every flap has a base port (where it attaches to its hub) and a tip.
 * - Every river has one port per bank (the two ends of its tree edge).
 *
 * Touching elements merge their ports into one internal tree node. Because
 * ports belong to user-authored elements, they survive edits, so labels and
 * the root choice can be attached to them.
 */
import type { Side } from '../geometry/polyline.ts';
import type { Id } from './types.ts';

export type PortKey = string;

export const flapBasePort = (flapId: Id): PortKey => `flap:${flapId}`;
export const flapTipPort = (flapId: Id): PortKey => `tip:${flapId}`;
export const riverPort = (riverId: Id, side: Side): PortKey => `river:${riverId}:${side}`;

export type ParsedPort =
  | { kind: 'flap-base'; flapId: Id }
  | { kind: 'flap-tip'; flapId: Id }
  | { kind: 'river'; riverId: Id; side: Side };

export function parsePort(key: PortKey): ParsedPort | null {
  const [kind, id, side] = key.split(':');
  if (!id) return null;
  if (kind === 'flap') return { kind: 'flap-base', flapId: id };
  if (kind === 'tip') return { kind: 'flap-tip', flapId: id };
  if (kind === 'river' && (side === 'a' || side === 'b')) return { kind: 'river', riverId: id, side };
  return null;
}

/** Element id a port belongs to (used to drop stale labels when elements are deleted). */
export function portOwner(key: PortKey): Id | null {
  const p = parsePort(key);
  if (!p) return null;
  return p.kind === 'river' ? p.riverId : p.flapId;
}
