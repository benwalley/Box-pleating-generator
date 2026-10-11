/**
 * Crease generation on the integer grid.
 *
 * For each unit grid segment and each cell diagonal we sample the ownership
 * field just either side of it:
 * - Hinge: the two sides lie in different elements (squares, rivers, or open paper).
 * - Axial: both sides want axis-parallel creases along this segment's direction.
 *   Elevation is the distance from the owner's axis line; if the two sides
 *   disagree on parity the segment is a conflict.
 * - Ridge: the orientation flips across a cell diagonal.
 *
 * Mountain/valley follows Lang's parity rule: even elevation = mountain,
 * odd = valley; a ridge between elevations e and e+1 is a valley when e is
 * even. Hinges stay unassigned because they depend on how flaps are flattened.
 */
import type { Design, Flap } from '../model/types.ts';
import type { RiverGeometry } from '../tree/contacts.ts';
import { OwnershipField, type Owner } from './field.ts';
import { mergeCreases } from './merge.ts';
import type { Assignment, Crease, CreasePattern } from './types.ts';

const parityMV = (elevation: number): Assignment => (elevation % 2 === 0 ? 'M' : 'V');
const OFFSET = 0.25;

export function generateCreases(design: Design, rivers: readonly RiverGeometry[]): CreasePattern {
  const n = design.gridSize;
  const field = new OwnershipField(design.flaps, rivers);
  const creases: Crease[] = [];
  const ambiguous = new Set<string>();
  const markAmbiguous = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < n && y < n) ambiguous.add(`${x},${y}`);
  };

  // Horizontal grid segments (y = const).
  for (let y = 1; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const mx = x + 0.5;
      const above = field.ownerAt(mx, y - OFFSET);
      const below = field.ownerAt(mx, y + OFFSET);
      if (!above || !below) continue;
      if (above.ambiguous) markAmbiguous(x, y - 1);
      if (below.ambiguous) markAmbiguous(x, y);
      const crease = gridSegment(
        { x1: x, y1: y, x2: x + 1, y2: y },
        'H',
        above,
        below,
        field.elementAt(mx, y - OFFSET),
        field.elementAt(mx, y + OFFSET),
        (f) => Math.abs(y - f.y),
      );
      if (crease) creases.push(crease);
    }
  }

  // Vertical grid segments (x = const).
  for (let x = 1; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const my = y + 0.5;
      const left = field.ownerAt(x - OFFSET, my);
      const right = field.ownerAt(x + OFFSET, my);
      if (!left || !right) continue;
      if (left.ambiguous) markAmbiguous(x - 1, y);
      if (right.ambiguous) markAmbiguous(x, y);
      const crease = gridSegment(
        { x1: x, y1: y, x2: x, y2: y + 1 },
        'V',
        left,
        right,
        field.elementAt(x - OFFSET, my),
        field.elementAt(x + OFFSET, my),
        (f) => Math.abs(x - f.x),
      );
      if (crease) creases.push(crease);
    }
  }

  // Cell diagonals (ridges).
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const north = field.ownerAt(x + 0.5, y + 0.2);
      const east = field.ownerAt(x + 0.8, y + 0.5);
      const south = field.ownerAt(x + 0.5, y + 0.8);
      const west = field.ownerAt(x + 0.2, y + 0.5);
      if (!north || !east || !south || !west) continue;
      if (north.ambiguous || east.ambiguous || south.ambiguous || west.ambiguous) markAmbiguous(x, y);
      let d: [number, number, number, number] | null = null;
      if (north.orientation === east.orientation && south.orientation === west.orientation && north.orientation !== south.orientation) {
        d = [x, y, x + 1, y + 1];
      } else if (north.orientation === west.orientation && south.orientation === east.orientation && north.orientation !== south.orientation) {
        d = [x + 1, y, x, y + 1];
      }
      if (!d) continue;
      const f = north.flap;
      const elev = (px: number, py: number) => Math.min(Math.abs(px - f.x), Math.abs(py - f.y));
      const e = Math.min(elev(d[0], d[1]), elev(d[2], d[3]));
      creases.push({ x1: d[0], y1: d[1], x2: d[2], y2: d[3], kind: 'ridge', mv: e % 2 === 0 ? 'V' : 'M', elevation: e });
    }
  }

  balanceInteriorTips(design, creases);

  return {
    creases,
    lines: mergeCreases(creases),
    ambiguousCells: [...ambiguous].map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x: x!, y: y! };
    }),
  };
}

function gridSegment(
  seg: { x1: number; y1: number; x2: number; y2: number },
  along: 'H' | 'V',
  sideA: Owner,
  sideB: Owner,
  elementA: string | null,
  elementB: string | null,
  elevationOf: (f: Flap) => number,
): Crease | null {
  if (elementA !== elementB) return { ...seg, kind: 'hinge', mv: 'U' };
  if (sideA.orientation === along && sideB.orientation === along) {
    const ea = elevationOf(sideA.flap);
    const eb = elevationOf(sideB.flap);
    if (ea % 2 !== eb % 2) return { ...seg, kind: 'conflict', mv: 'U' };
    return { ...seg, kind: 'axial', mv: parityMV(ea), elevation: ea };
  }
  if (sideA.orientation !== sideB.orientation) return { ...seg, kind: 'conflict', mv: 'U' };
  return null;
}

/**
 * At an interior flap tip, four valley ridges meet four mountain axial rays
 * (M = V = 4), which breaks Maekawa's |M - V| = 2. Turning the axial ray that
 * runs right from the tip into a valley fixes it.
 */
function balanceInteriorTips(design: Design, creases: Crease[]): void {
  const n = design.gridSize;
  for (const f of design.flaps) {
    if (f.x <= 0 || f.y <= 0 || f.x >= n || f.y >= n) continue;
    for (let i = 0; i < creases.length; i++) {
      const c = creases[i]!;
      if (
        c.kind === 'axial' &&
        c.elevation === 0 &&
        c.y1 === f.y &&
        c.y2 === f.y &&
        Math.min(c.x1, c.x2) >= f.x &&
        Math.max(c.x1, c.x2) <= f.x + f.r
      ) {
        creases[i] = { ...c, mv: 'V' };
      }
    }
  }
}
